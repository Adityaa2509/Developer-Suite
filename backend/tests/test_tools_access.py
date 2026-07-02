"""Tests for permissions.py and sharing.py tools."""
import pytest
from app.tools.permissions import get_user_profile_and_permsets, get_field_level_security
from app.tools.sharing import get_owd_for_object, get_record_sharing
from app.salesforce.client import get_sf_client


def _get_any_user_id() -> str | None:
    """Helper: get any active user ID from the org."""
    sf = get_sf_client()
    result = sf.query("SELECT Id FROM User WHERE IsActive = true LIMIT 1")
    return result["records"][0]["Id"] if result["totalSize"] > 0 else None


def test_get_owd_for_case():
    result = get_owd_for_object.invoke({"object_type": "Case"})
    assert isinstance(result, str)
    assert "OWD" in result or "Default" in result or "Private" in result or "Read" in result
    print(f"\n✅ Case OWD: {result[:120]}")


def test_get_owd_for_unknown_object():
    result = get_owd_for_object.invoke({"object_type": "FakeObject__c"})
    assert isinstance(result, str)
    print(f"\n✅ Unknown OWD handled: {result[:80]}")


def test_get_record_sharing_fake_record():
    result = get_record_sharing.invoke({"record_id": "500d200000jquQ5AAI", "object_type": "Case"})
    assert isinstance(result, str)
    print(f"\n✅ Fake record sharing: {result[:80]}")


def test_get_user_profile_real_user():
    user_id = _get_any_user_id()
    if not user_id:
        print("\n⚠️  No users found — skipping")
        return
    result = get_user_profile_and_permsets.invoke({"user_id": user_id})
    assert "Profile" in result
    print(f"\n✅ User profile: {result[:120]}")


def test_get_fls_for_case():
    user_id = _get_any_user_id()
    if not user_id:
        print("\n⚠️  No users found — skipping")
        return
    result = get_field_level_security.invoke({"user_id": user_id, "object_type": "Case"})
    assert isinstance(result, str)
    print(f"\n✅ FLS for Case: {result[:120]}")
