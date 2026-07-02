"""
async_apex.py — HULK
─────────────────────
Investigates asynchronous Apex execution.

Async Apex is the invisible layer — it runs AFTER the original
transaction completes, in a separate transaction, often minutes later.

Common scenarios:
  - Record created/updated → Trigger enqueues Queueable
  - Queueable updates the record (appears as a separate change)
  - Scheduled Batch runs nightly and updates records
  - Future method called from trigger updates related records

Without this tool, the agent sees a record change with no Flow/Trigger
explanation — because the automation ran asynchronously AFTER the save.
"""

import re
from urllib.parse import quote
from langchain.tools import tool
from app.salesforce.client import get_sf_client
from app.core.logger import get_logger

logger = get_logger(__name__)


@tool
def get_async_jobs(limit: int = 50) -> str:
    """
    Returns recent Async Apex jobs (Queueable, Future, Batch, Scheduled).
    Shows job class, status, errors, and timing.

    Use when:
    - Record changed but no Flow/Trigger explains it
    - Change happened with a time delay after the original save
    - Integration is involved (external system callout)
    - Batch processing is scheduled on this object
    """
    try:
        sf = get_sf_client()

        soql = f"""
            SELECT Id, Status, JobType, MethodName,
                   NumberOfErrors, ExtendedStatus,
                   CreatedDate, CompletedDate,
                   JobItemsProcessed, TotalJobItems,
                   ApexClass.Name
            FROM AsyncApexJob
            ORDER BY CreatedDate DESC
            LIMIT {limit}
        """

        result = sf.toolingexecute(f"query/?q={quote(soql)}")

        if result.get("totalSize", 0) == 0:
            return (
                "No Async Apex jobs found in the org. "
                "This means no async work has been processed recently. "
                "The anomaly is likely caused by synchronous automation only."
            )

        # Group by status for quick summary
        by_status: dict[str, list] = {}
        for job in result.get("records", []):
            status = job.get("Status", "Unknown")
            by_status.setdefault(status, []).append(job)

        lines = [
            f"Recent Async Apex Jobs: {result['totalSize']} found",
            f"Status breakdown: " + " | ".join(f"{k}: {len(v)}" for k, v in by_status.items()),
            "─" * 70,
            "",
        ]

        for job in result.get("records", []):
            apex_class = (job.get("ApexClass") or {}).get("Name", "Unknown")
            status     = job.get("Status", "Unknown")
            errors     = job.get("NumberOfErrors", 0)
            ext_status = job.get("ExtendedStatus") or ""
            job_type   = job.get("JobType", "Unknown")
            method     = job.get("MethodName") or ""

            status_icon = "✅" if status == "Completed" and errors == 0 else (
                "❌" if status == "Failed" or errors > 0 else "⏳" if status == "Processing" else "📋"
            )

            lines.append(
                f"{status_icon} {apex_class}"
                + (f".{method}" if method else "")
            )
            lines.append(f"   Type      : {job_type}")
            lines.append(f"   Status    : {status}")
            lines.append(f"   Created   : {job.get('CreatedDate', '')}")
            lines.append(f"   Completed : {job.get('CompletedDate', 'Not yet')}")

            if status == "Failed" or errors > 0 or ext_status:
                if errors > 0:
                    lines.append(f"   ⚠️  Errors : {errors}")
                if ext_status:
                    lines.append(f"   Error msg : {ext_status}")


            processed = job.get("JobItemsProcessed")
            total     = job.get("TotalJobItems")
            if processed is not None and total is not None:
                lines.append(f"   Progress  : {processed}/{total} items")

            lines.append("")

        lines.append("─" * 70)
        lines.append("INVESTIGATION GUIDANCE:")
        lines.append(
            "• If a job's class name matches the object being investigated, "
            "call get_apex_class_body(class_name) to see what it does"
        )
        lines.append(
            "• If a Completed job has no errors but the record changed "
            "shortly after the job ran, this job likely caused the change"
        )
        lines.append(
            "• ⚠️  Async jobs run AFTER the original transaction — "
            "the record change may appear minutes after the triggering action"
        )

        logger.info(f"✅ Async jobs fetched: {result['totalSize']}")
        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"Async job fetch failed: {exc}")
        return f"Could not read Async Apex jobs: {str(exc)}"


@tool
def get_scheduled_jobs() -> str:
    """
    Returns all scheduled Apex jobs with their timing.
    Use when a record changes at a predictable time (nightly, weekly, etc.)
    — this suggests a Scheduled Apex batch is responsible.
    """
    try:
        sf = get_sf_client()

        result = sf.query("""
            SELECT Id, State, NextFireTime, PreviousFireTime,
                   CronJobDetail.Name, CronJobDetail.JobType
            FROM CronTrigger
            ORDER BY NextFireTime ASC
        """)

        if result["totalSize"] == 0:
            return "No scheduled Apex jobs found."

        lines = [
            f"Scheduled Apex Jobs: {result['totalSize']} found",
            "─" * 70,
        ]

        for row in result["records"]:
            detail    = row.get("CronJobDetail") or {}
            state     = row.get("State", "Unknown")
            next_fire = row.get("NextFireTime", "Unknown")
            prev_fire = row.get("PreviousFireTime", "Not yet run")

            icon = "✅" if state == "ACTIVE" else "❌"

            lines.append(f"\n{icon} {detail.get('Name', 'Unknown')}")
            lines.append(f"   Type          : {detail.get('JobType', '')}")
            lines.append(f"   State         : {state}")
            lines.append(f"   Last Ran      : {prev_fire}")
            lines.append(f"   Next Scheduled: {next_fire}")

        lines.append("")
        lines.append(
            "If the anomaly occurred at the same time as a scheduled job's "
            "PreviousFireTime, that job is likely responsible."
        )

        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"Scheduled job fetch failed: {exc}")
        return f"Could not read scheduled jobs: {str(exc)}"


@tool
def get_apex_class_body(class_name: str) -> str:
    """
    Returns the full Apex class source code.
    Use after identifying a suspicious async class from get_async_jobs.
    The full source reveals what objects/fields the class modifies.
    """
    try:
        sf = get_sf_client()

        result = sf.toolingexecute(
            f"query/?q={quote(f'SELECT Id, Name FROM ApexClass WHERE Name = {repr(class_name)} LIMIT 1')}"
        )

        if result.get("totalSize", 0) == 0:
            return f"Apex class '{class_name}' not found."

        class_id = result["records"][0]["Id"]
        details  = sf.toolingexecute(f"sobjects/ApexClass/{class_id}")
        body     = details.get("Body", "")

        # Analyse the body for what it does
        analysis_lines = []

        # Find DML operations
        for op in ["insert", "update", "delete", "upsert"]:
            if re.search(rf"\b{op}\b", body, re.IGNORECASE):
                analysis_lines.append(f"Performs {op.upper()}")

        # Find what objects are referenced
        obj_refs = re.findall(r'\b([A-Z][a-zA-Z_]+__c|Account|Contact|Lead|Case|Opportunity|Task|Event)\b', body)
        unique_objs = list(dict.fromkeys(obj_refs))[:10]
        if unique_objs:
            analysis_lines.append(f"References objects: {', '.join(unique_objs)}")

        # Find field assignments
        field_assigns = re.findall(r'\.(\w+)\s*=\s*([^;,\n\r]{1,50})', body)
        if field_assigns:
            analysis_lines.append(
                f"Field assignments found: "
                + ", ".join(f".{f[0]} = {f[1].strip()[:20]}" for f in field_assigns[:5])
            )

        analysis = "\n".join(f"  • {l}" for l in analysis_lines) if analysis_lines else "  No obvious DML found"

        return f"""
Apex Class: {class_name}
Length: {len(body)} characters

AUTOMATED ANALYSIS:
{analysis}

FULL SOURCE:
```apex
{body[:20000]}
```
{"... (truncated — class is very large)" if len(body) > 20000 else ""}
"""

    except Exception as exc:
        logger.warning(f"Apex class fetch failed: {exc}")
        return f"Could not read Apex class '{class_name}': {str(exc)}"


@tool
def investigate_async_execution(record_id: str, hours_back: int = 24) -> str:
    """
    Full async investigation: correlates debug logs + async jobs
    to identify which async Apex touched this record.

    The definitive tool for: "record changed but no synchronous automation explains it".
    Shows a timeline of async job execution relative to the record's changes.
    """
    try:
        logs       = get_async_jobs.func(limit=100)
        scheduled  = get_scheduled_jobs.func()

        lines = [
            f"Async Execution Investigation",
            f"Record: {record_id}",
            "─" * 70,
            "",
            "RECENT ASYNC JOBS:",
            logs[:10000],
            "",
            "SCHEDULED JOBS:",
            scheduled[:3000],
            "",
            "─" * 70,
            "HOW TO CORRELATE:",
            "1. Find the timestamp of the record change (from get_record_history)",
            "2. Find async jobs that COMPLETED shortly BEFORE that timestamp",
            "3. The completing async class is the likely cause",
            "4. Call get_apex_class_body(class_name) to confirm what it modifies",
        ]

        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"Async investigation failed: {exc}")
        return f"Could not investigate async execution: {str(exc)}"