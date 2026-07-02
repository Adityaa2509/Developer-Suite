"""
sharing.py
──────────
Reads Organization-Wide Defaults (OWD) and sharing settings
for a Salesforce object.

OWD determines the baseline access level. If OWD is Private,
users outside the record ownership chain cannot see or edit records
unless explicitly granted via sharing rules or manual shares.
"""

from langchain.tools import tool
from app.salesforce.client import get_sf_client
from app.core.logger import get_logger

logger = get_logger(__name__)

ACCESS_FIELD_MAP = {
    "Account": "AccountAccessLevel",
    "Case": "CaseAccessLevel",
    "Contact": "ContactAccessLevel",
    "Lead": "LeadAccessLevel",
    "Opportunity": "OpportunityAccessLevel",
}

SHARE_PARENT_FIELD_MAP = {
    "Account": "AccountId",
    "Case": "CaseId",
    "Contact": "ContactId",
    "Lead": "LeadId",
    "Opportunity": "OpportunityId",
}

# Human-readable OWD descriptions
OWD_DESCRIPTIONS = {
    "ReadWrite"           : "Public Read/Write — everyone can read and edit",
    "Read"                : "Public Read Only — everyone can read, only owner can edit",
    "Private"             : "Private — only owner and above can access",
    "ControlledByParent"  : "Controlled by Parent — access follows parent record",
    "ReadWriteTransfer"   : "Public Read/Write/Transfer (Lead/Case specific)",
    "FullAccess"          : "Full Access — all users have complete access",
}


@tool
def get_owd_for_object(object_type: str) -> str:
    """
    Returns the Organization-Wide Default (OWD) sharing setting for the object.
    OWD is the BASELINE access level for all users.
    If OWD is Private, records are only visible to the owner by default.
    Use this when investigating why a user cannot see or edit a record.
    """
    try:
        sf = get_sf_client()
        result = sf.query(f"""
                        SELECT QualifiedApiName,
                        InternalSharingModel,
                          ExternalSharingModel
                        FROM EntityDefinition
                        WHERE QualifiedApiName = '{object_type}'
        """)

        if result["totalSize"] == 0:
            return f"Object '{object_type}' not found in EntityDefinition."

        r = result["records"][0]
        internal = r.get("InternalSharingModel", "Unknown")
        external = r.get("ExternalSharingModel", "Unknown")

        internal_desc = OWD_DESCRIPTIONS.get(internal, internal)
        external_desc = OWD_DESCRIPTIONS.get(external, external)

        lines = [
            f"Organization-Wide Defaults for {object_type}",
            "─" * 60,
            f"  Internal OWD : {internal}",
            f"    → {internal_desc}",
            f"  External OWD : {external}",
            f"    → {external_desc}",
        ]

        if internal == "Private":
            lines.append(
                f"\n⚠️  PRIVATE OWD: Users can only access records they own "
                f"or that are shared explicitly via sharing rules or manual shares."
            )
        elif internal == "Read":
            lines.append(
                f"\n⚠️  READ-ONLY OWD: Users can view all records but only "
                f"owners (and above in the role hierarchy) can edit."
            )

        logger.info(f"✅ OWD fetched for {object_type}: internal={internal}")
        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"OWD fetch failed: {exc}")
        return f"Could not read OWD for {object_type}: {str(exc)}"


@tool
def get_record_sharing(record_id: str, object_type: str) -> str:
    """
    Lists explicit sharing entries for a record.

    Shows:
    - Who has access
    - Access level
    - Why access was granted

    Useful when OWD is Private and a user unexpectedly
    can or cannot see a record.
    """

    try:
        sf = get_sf_client()

        access_field = ACCESS_FIELD_MAP.get(object_type)

        if not access_field:
            return (
                f"Sharing inspection is not currently supported "
                f"for object '{object_type}'."
            )

        share_object = f"{object_type}Share"
        parent_field = SHARE_PARENT_FIELD_MAP.get(object_type)
        soql = f"""
            SELECT Id,
                   UserOrGroupId,
                   RowCause,
                   {access_field},
                   IsDeleted
            FROM {share_object}
            WHERE {parent_field} = '{record_id}'
            AND IsDeleted = false
        """

        result = sf.query(soql)

        if result["totalSize"] == 0:
            return (
                f"No explicit sharing entries found for {record_id}. "
                f"Access is likely determined by OWD, role hierarchy, "
                f"or implicit sharing."
            )

        lines = [
            f"Sharing entries for {object_type} {record_id}",
            f"Total entries: {result['totalSize']}",
            "─" * 60,
        ]

        for r in result["records"]:
            lines.append(
                f"  User/Group: {r.get('UserOrGroupId', 'N/A')} | "
                f"Access: {r.get(access_field, 'Unknown')} | "
                f"Reason: {r.get('RowCause', 'Unknown')}"
            )

        logger.info(
            f"✅ Sharing entries fetched: "
            f"{result['totalSize']} for {record_id}"
        )

        return "\n".join(lines)

    except Exception as exc:
        logger.warning(
            f"Sharing fetch failed for "
            f"{object_type} {record_id}: {exc}"
        )

        return (
            f"Could not read sharing for "
            f"{object_type} {record_id}: {str(exc)}"
        )
    