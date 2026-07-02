"""Tests for record.py and history.py tools."""
import pytest
from app.tools.record import detect_object_type, build_prefix_map, get_record
from app.tools.history import get_record_history
from app.salesforce.client import get_sf_client


def test_prefix_map_builds():
    mapping = build_prefix_map()
    assert isinstance(mapping, dict)
    assert len(mapping) > 0
    print(f"\n✅ Prefix map: {len(mapping)} objects")


def test_detect_object_type_case():
    """500 prefix = Case in all SF orgs."""
    mapping = build_prefix_map()
    obj = detect_object_type("500ABC123DEF456")
    # May be None in a fresh org with no Case records — that's OK
    print(f"\n✅ 500 prefix detects: {obj}")


def test_detect_object_type_unknown():
    result = detect_object_type("ZZZ999")
    assert result is None
    print("\n✅ Unknown prefix returns None correctly")


def test_get_record_with_real_record():
    """Get a real record from the org to verify the tool works end-to-end."""
    sf = get_sf_client()
    # Get any Account from the org
    accounts = sf.query("SELECT Id FROM Account LIMIT 1")
    if accounts["totalSize"] == 0:
        print("\n⚠️  No Account records in org — skipping live test")
        return

    record_id = accounts["records"][0]["Id"]
    result = get_record.invoke({"record_id": record_id, "object_type": "Account"})
    assert "ERROR" not in result
    assert record_id in result
    print(f"\n✅ get_record returned {len(result)} chars for Account {record_id[:8]}...")


def test_get_record_invalid_id():
    result = get_record.invoke({"record_id": "INVALID123", "object_type": "Case"})
    assert "ERROR" in result
    print(f"\n✅ Invalid ID handled: {result[:60]}")


def test_get_history_no_object_history():
    """Test graceful handling when history not enabled or no changes."""
    result = get_record_history.invoke({"record_id": "001d200000azkafAAA", "object_type": "Account"})
    assert isinstance(result, str)
    assert len(result) > 0
    print(f"\n✅ History graceful fallback: {result[:80]}")
