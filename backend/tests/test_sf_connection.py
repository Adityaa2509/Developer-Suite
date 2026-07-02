from app.salesforce.client import get_sf_client


def test_sf_connects():
    sf = get_sf_client()
    assert sf is not None
    assert sf.sf_instance is not None
    print(f"\n✅ Connected: {sf.sf_instance}")


def test_sf_rest_api():
    sf = get_sf_client()
    result = sf.query("SELECT Id, Name FROM Account LIMIT 1")
    assert "totalSize" in result
    print(f"\n✅ REST API OK — Account query returned")


def test_sf_tooling_api():
    sf = get_sf_client()

    result = sf.toolingexecute(
        "query/?q=SELECT+Id,+Name+FROM+ApexClass+LIMIT+3"
    )

    assert result["records"]

    print(
        f"\n✅ Tooling API OK — returned {len(result['records'])} Apex classes"
    )


def test_sf_describe():
    sf = get_sf_client()
    result = sf.Case.describe()
    fields = [f["name"] for f in result["fields"]]
    assert "Status" in fields
    print(f"\n✅ Describe OK — Case has {len(result['fields'])} fields")


def test_sf_user_query():
    """Needed for permission/profile investigation tool on Day 2."""
    sf = get_sf_client()
    result = sf.query(
        "SELECT Id, Username, ProfileId FROM User WHERE IsActive = true LIMIT 1"
    )
    assert result["totalSize"] >= 1
    print(f"\n✅ User query OK — active user found")
