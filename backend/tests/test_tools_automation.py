"""Tests for all automation tools."""
import pytest
from app.tools.triggers import get_triggers_for_object
from app.tools.flows import get_flows_for_object
from app.tools.validation_rules import get_validation_rules_for_object
from app.tools.assignment_rules import get_assignment_rules_for_object
from app.tools.approval_processes import (
    get_approval_processes_for_object,
    get_approval_instance_for_record,
)


def test_get_triggers_returns_string():
    result = get_triggers_for_object.invoke({"object_type": "Lead"})
    assert isinstance(result, str)
    assert len(result) > 0
    print(f"\n✅ Case triggers: {result[:100]}")


def test_get_flows_returns_string():
    result = get_flows_for_object.invoke({"object_type": "Lead"})
    assert isinstance(result, str)
    assert len(result) > 0
    print(f"\n✅ Case flows: {result[:100]}")


def test_get_validation_rules_returns_string():
    result = get_validation_rules_for_object.invoke({"object_type": "Account"})
    assert isinstance(result, str)
    print(f"\n✅ Case VRs: {result[:100]}")


def test_assignment_rules_case():
    result = get_assignment_rules_for_object.invoke({"object_type": "Case"})
    assert isinstance(result, str)
    print(f"\n✅ Case assignment rules: {result[:100]}")


def test_assignment_rules_unsupported_object():
    result = get_assignment_rules_for_object.invoke({"object_type": "Contact"})
    assert "Assignment Rules are only available" in result
    print(f"\n✅ Unsupported object handled correctly")


def test_approval_processes_returns_string():
    result = get_approval_processes_for_object.invoke({"object_type": "Opportunity"})
    assert isinstance(result, str)
    print(f"\n✅ Opportunity approval processes: {result[:100]}")


def test_approval_instance_fake_record():
    result = get_approval_instance_for_record.invoke({"record_id": "500FAKE123"})
    assert isinstance(result, str)
    print(f"\n✅ Fake record approval check: {result[:80]}")
