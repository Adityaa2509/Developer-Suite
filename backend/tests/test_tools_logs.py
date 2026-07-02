"""Tests for debug_logs.py tool."""
from app.tools.debug_logs import get_debug_logs, _extract_relevant_lines


def test_extract_relevant_lines_finds_exception():
    log = "line1\nEXCEPTION: NullPointer\nline3\nrandom line"
    result = _extract_relevant_lines(log, "FAKE123")
    assert "EXCEPTION" in result
    print(f"\n✅ Exception line extracted: {result[:60]}")


def test_extract_relevant_lines_finds_record_id():
    log = "flow started\nprocessing record 500ABC123\ncomplete"
    result = _extract_relevant_lines(log, "500ABC123")
    assert "500ABC123" in result
    print(f"\n✅ Record ID line extracted: {result[:80]}")


def test_extract_relevant_lines_nothing_relevant():
    result = _extract_relevant_lines("just some log lines here", "NOTHERE")
    assert "No lines" in result
    print(f"\n✅ No-match handled: {result[:60]}")


def test_get_debug_logs_returns_string():
    result = get_debug_logs.invoke({"record_id": "500FAKE", "hours_back": 1})
    assert isinstance(result, str)
    assert len(result) > 0
    print(f"\n✅ Debug logs tool: {result[:100]}")
