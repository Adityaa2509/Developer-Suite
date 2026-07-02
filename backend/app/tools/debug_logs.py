"""
debug_logs.py — HULK
─────────────────────
Reads debug logs and extracts actionable information:
  - Actual Salesforce error messages and validation rule names
  - Exception details with stack traces
  - DML operations showing which records were modified
  - Flow and trigger execution markers
  - Specifically searches for the record ID
"""

import re
import urllib.parse
from langchain.tools import tool
from datetime import datetime, timedelta
from app.salesforce.client import get_sf_client
from app.core.logger import get_logger

logger = get_logger(__name__)

MAX_LOG_CHARS  = 80_000   # 80KB per log
MAX_LOGS_READ  = 5


def _extract_validation_errors(log_body: str) -> list[str]:
    """Extracts validation rule error messages from log."""
    errors = []
    for m in re.finditer(
        r'VALIDATION_FAIL\|([^\n]+)', log_body
    ):
        errors.append(f"VALIDATION FAIL: {m.group(1).strip()}")

    for m in re.finditer(
        r'VALIDATION_ERROR\|([^\n]+)', log_body
    ):
        errors.append(f"VALIDATION ERROR: {m.group(1).strip()}")

    # Also look for addError patterns in log output
    for m in re.finditer(
        r'addError.*?([^\n]+)', log_body, re.IGNORECASE
    ):
        errors.append(f"Field Error: {m.group(1).strip()[:100]}")

    return list(dict.fromkeys(errors))[:10]


def _extract_exceptions(log_body: str) -> list[str]:
    """Extracts exception/error lines."""
    errors = []
    for m in re.finditer(
        r'(FATAL_ERROR|EXCEPTION_THROWN)\|([^\n]+)', log_body
    ):
        errors.append(f"{m.group(1)}: {m.group(2).strip()[:150]}")
    return errors[:10]


def _extract_dml_operations(log_body: str) -> list[str]:
    """Extracts DML operations showing what records were written."""
    ops = []
    for m in re.finditer(
        r'(DML_BEGIN|DML_END)\|([^\n]+)', log_body
    ):
        ops.append(f"{m.group(1)}: {m.group(2).strip()[:100]}")
    return ops[:10]


def _extract_flow_execution(log_body: str) -> list[str]:
    """Extracts Flow execution events."""
    events = []
    for m in re.finditer(
        r'(FLOW_START_INTERVIEW_BEGIN|FLOW_START_INTERVIEW_END|'
        r'FLOW_INTERVIEW_FINISHED|FLOW_ELEMENT_ERROR|'
        r'FLOW_RULE_DETAIL)\|([^\n]+)',
        log_body
    ):
        events.append(f"{m.group(1)}: {m.group(2).strip()[:120]}")
    return events[:15]


def _extract_trigger_execution(log_body: str) -> list[str]:
    """Extracts trigger execution events."""
    events = []
    for m in re.finditer(
        r'(CODE_UNIT_STARTED|CODE_UNIT_FINISHED)\|[^\|]+\|([^\n]+)',
        log_body
    ):
        unit = m.group(2).strip()
        if 'trigger' in unit.lower() or 'Trigger' in unit:
            events.append(f"{m.group(1)}: {unit[:100]}")
    return events[:10]


def _extract_relevant_lines(log_body: str, record_id: str) -> str:
    """Extract lines related to the record ID or containing errors."""
    lines  = log_body.split("\n")
    result = []

    for i, line in enumerate(lines):
        if (
            record_id in line
            or "EXCEPTION" in line.upper()
            or "VALIDATION_FAIL" in line
            or "VALIDATION_ERROR" in line
            or "FATAL_ERROR" in line
            or "DML_BEGIN" in line
            or "FLOW_ELEMENT_ERROR" in line
            or "addError" in line
        ):
            start = max(0, i - 1)
            end   = min(len(lines), i + 3)
            result.extend(lines[start:end])
            result.append("---")

    return "\n".join(result[:120]) if result else f"No lines mentioning {record_id} or errors found."


@tool
def get_debug_logs(record_id: str, hours_back: int = 24) -> str:
    """
    Searches recent debug logs for entries related to the given record ID.
    Extracts: validation errors, exceptions, DML ops, flow execution, trigger runs.
    Shows the ACTUAL Salesforce error messages — not just log metadata.

    Note: Logs only exist if debug logging was enabled BEFORE the issue occurred.
    If no logs found → automation still ran, just wasn't captured.
    """
    try:
        sf = get_sf_client()

        # Calculate time window (fix the {since} bug with proper formatting)
        since_dt  = datetime.utcnow() - timedelta(hours=hours_back)
        since_str = since_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        # Query log metadata using toolingexecute (avoids SFType issue)
        q = urllib.parse.quote(
            f"SELECT Id, LogUser.Name, StartTime, DurationMilliseconds, "
            f"Status, LogLength, Operation "
            f"FROM ApexLog "
            f"WHERE StartTime >= {since_str} "
            f"ORDER BY StartTime DESC LIMIT 20"
        )
        logs_meta = sf.toolingexecute(f"query/?q={q}")

        if logs_meta.get("totalSize", 0) == 0:
            return (
                f"No debug logs found in the last {hours_back} hours.\n"
                f"This is COMMON — logs require a debug log configuration to be "
                f"enabled BEFORE the issue occurs.\n"
                f"Absence of logs does NOT mean automation did not run.\n"
                f"To enable logging: Setup → Debug Logs → add the relevant user."
            )

        lines = [
            f"Debug Logs — last {hours_back} hours: {logs_meta['totalSize']} logs found",
            "─" * 70,
        ]

        logs_read     = 0
        found_record  = False
        found_errors  = []
        found_flows   = []
        found_triggers = []
        found_dml     = []

        for log in logs_meta.get("records", []):
            log_id   = log["Id"]
            user     = (log.get("LogUser") or {}).get("Name", "unknown")
            size     = log.get("LogLength", 0)
            op       = log.get("Operation", "")
            duration = log.get("DurationMilliseconds", 0)

            lines.append(
                f"\nLog: {log_id[:15]}... | "
                f"User: {user} | {op} | {duration}ms | {size} chars"
            )

            if logs_read >= MAX_LOGS_READ:
                lines.append("  (max logs read — skipping remaining)")
                continue

            if size > MAX_LOG_CHARS * 2:
                lines.append(f"  (log too large: {size} chars — skipping body)")
                continue

            try:
                body = sf.toolingexecute(f"sobjects/ApexLog/{log_id}/Body")
                if isinstance(body, bytes):
                    body = body.decode("utf-8", errors="replace")
                body_text = str(body)[:MAX_LOG_CHARS]
                logs_read += 1

                # Extract structured information
                val_errors = _extract_validation_errors(body_text)
                exceptions = _extract_exceptions(body_text)
                dml_ops    = _extract_dml_operations(body_text)
                flow_evts  = _extract_flow_execution(body_text)
                trigger_evts = _extract_trigger_execution(body_text)

                found_errors.extend(val_errors)
                found_flows.extend(flow_evts)
                found_triggers.extend(trigger_evts)
                found_dml.extend(dml_ops)

                if record_id in body_text:
                    found_record = True
                    lines.append(f"  ✅ Record {record_id} FOUND in this log")

                if val_errors:
                    lines.append(f"  🚨 VALIDATION ERRORS ({len(val_errors)}):")
                    for e in val_errors:
                        lines.append(f"     {e}")

                if exceptions:
                    lines.append(f"  🔴 EXCEPTIONS ({len(exceptions)}):")
                    for e in exceptions:
                        lines.append(f"     {e}")

                if not val_errors and not exceptions and record_id not in body_text:
                    lines.append(f"  (Record {record_id} not in this log, no errors)")
                elif not val_errors and not exceptions:
                    excerpt = _extract_relevant_lines(body_text, record_id)
                    lines.append("  Relevant excerpt:")
                    lines.append(excerpt[:500])

            except Exception as e:
                lines.append(f"  (Could not read log body: {e})")

        # Summary
        lines.append("\n" + "─" * 70)
        lines.append("LOG ANALYSIS SUMMARY:")

        if found_record:
            lines.append(f"✅ Record {record_id} found in logs")
        else:
            lines.append(f"⚠️  Record {record_id} NOT found in any log body")

        if found_errors:
            lines.append("🚨 VALIDATION ERRORS FOUND:")
            for e in list(dict.fromkeys(found_errors))[:5]:
                lines.append(f"   → {e}")

        if found_flows:
            lines.append(f"🔄 FLOWS EXECUTED: {len(found_flows)} flow events found")
            for f in found_flows[:5]:
                lines.append(f"   {f}")

        if found_triggers:
            lines.append(f"⚡ TRIGGERS RAN: {len(found_triggers)} trigger events")
            for t in found_triggers[:5]:
                lines.append(f"   {t}")

        if not found_record and not found_errors:
            lines.append(
                "\nNo matching logs found for this record. "
                "The issue likely occurred when logging was not enabled, "
                "OR the record ID is slightly different in the logs."
            )

        logger.info(f"✅ Debug logs: {logs_meta['totalSize']} found, {logs_read} read")
        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"Debug log fetch failed: {exc}")
        return f"Could not read debug logs: {str(exc)}"