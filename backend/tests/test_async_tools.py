# tests/test_tools_async.py

from app.tools.async_apex import (
    get_async_jobs,
    get_scheduled_jobs,
    get_apex_class_body,
    investigate_async_execution,
)


def test_get_async_jobs():
    result = get_async_jobs.invoke({"limit": 10})

    assert isinstance(result, str)

    print(f"\n✅ Async jobs:\n{result[:500]}")


def test_get_scheduled_jobs():
    result = get_scheduled_jobs.invoke({})

    assert isinstance(result, str)

    print(f"\n✅ Scheduled jobs:\n{result[:500]}")


def test_get_apex_class_body_existing_class():
    """
    Replace with a real class from your org.
    """

    result = get_apex_class_body.invoke({
        "class_name": "Upload_controller_EM"
    })

    assert isinstance(result, str)

    print(f"\n✅ Apex class body:\n{result[:500]}")


def test_get_apex_class_body_fake_class():
    result = get_apex_class_body.invoke({
        "class_name": "DefinitelyFakeClass123"
    })

    assert isinstance(result, str)

    print(f"\n✅ Fake class handled:\n{result[:200]}")


def test_investigate_async_execution():
    result = investigate_async_execution.invoke({
        "record_id": "500d200000jquQ5AAI",
        "hours_back": 24,
    })

    assert isinstance(result, str)

    print(f"\n✅ Async investigation:\n{result[:1000]}")