"""
permissions.py — HULK (Effective Permissions)
──────────────────────────────────────────────
Salesforce access is ADDITIVE.
Effective access = Profile + ALL Permission Sets + Permission Set Groups.

The previous version only checked the profile-backed Permission Set.
This version aggregates across ALL permission sets assigned to the user,
which is the only correct way to determine effective access.
"""

from langchain.tools import tool
from app.salesforce.client import get_sf_client
from app.core.logger import get_logger

logger = get_logger(__name__)


def _get_all_permset_ids(sf, user_id: str, profile_id: str) -> list[str]:
    """
    Returns ALL permission set IDs that contribute to a user's effective access:
    - Profile-backed Permission Set
    - Directly assigned Permission Sets
    - Component Permission Sets inside assigned Permission Set Groups
    """
    ids = set()

    # 1. Profile-backed Permission Set
    profile_ps = sf.query(
        f"SELECT Id FROM PermissionSet WHERE ProfileId = '{profile_id}'"
    )
    ids.update(r["Id"] for r in profile_ps.get("records", []))

    # 2. All directly assigned Permission Sets and Permission Set Groups
    assigned = sf.query(f"""
        SELECT PermissionSetId, PermissionSetGroupId
        FROM PermissionSetAssignment
        WHERE AssigneeId = '{user_id}'
    """)
    
    psg_ids = []
    for r in assigned.get("records", []):
        if r.get("PermissionSetGroupId"):
            psg_ids.append(r["PermissionSetGroupId"])
        if r.get("PermissionSetId"):
            ids.add(r["PermissionSetId"])

    # 3. Component Permission Sets from assigned Permission Set Groups
    if psg_ids:
        psg_ids_str = "','".join(psg_ids)
        try:
            group_components = sf.query(f"""
                SELECT PermissionSetId
                FROM PermissionSetGroupComponent
                WHERE PermissionSetGroupId IN ('{psg_ids_str}')
            """)
            ids.update(r["PermissionSetId"] for r in group_components.get("records", []))
        except Exception as e:
            logger.warning(f"Could not fetch PermissionSetGroupComponent members: {e}")

    return list(ids)


@tool
def get_user_profile_and_permsets(user_id: str) -> str:
    """
    Returns EFFECTIVE permissions for a user.
    Checks Profile + all Permission Sets + Permission Set Groups.
    Salesforce access is additive — a PS can grant access even if Profile denies it.

    Shows:
    - Active/Inactive status
    - Profile name
    - All assigned Permission Sets and Groups
    - Effective object permissions (aggregated across ALL permission sets)
    """
    try:
        sf = get_sf_client()

        user = sf.query(f"""
            SELECT Id, Username, IsActive,
                   Profile.Id, Profile.Name
            FROM User WHERE Id = '{user_id}'
        """)

        if user["totalSize"] == 0:
            return f"User {user_id} not found."

        u            = user["records"][0]
        profile      = u.get("Profile") or {}
        profile_id   = profile.get("Id", "")
        profile_name = profile.get("Name", "Unknown")
        is_active    = u.get("IsActive", False)

        lines = [
            f"Effective Permissions: {u.get('Username', user_id)}",
            "─" * 70,
            f"Active  : {'✅ YES' if is_active else '❌ NO — USER IS INACTIVE'}",
            f"Profile : {profile_name}",
            "",
        ]

        if not is_active:
            lines.append(
                "🚨 INACTIVE USER — Cannot log in. Cannot access any records. "
                "This is almost certainly the root cause for any access anomaly."
            )

        # ── Permission Sets ───────────────────────────────────────
        perm_sets = sf.query(f"""
            SELECT PermissionSet.Name, PermissionSet.Label,
                   PermissionSet.IsCustom
            FROM PermissionSetAssignment
            WHERE AssigneeId = '{user_id}'
            AND PermissionSet.IsOwnedByProfile = false
        """)
        lines.append(
            f"Permission Sets Assigned: {perm_sets['totalSize']}"
        )
        for ps in perm_sets.get("records", []):
            p = ps.get("PermissionSet") or {}
            lines.append(
                f"  • {p.get('Name', 'N/A')} "
                f"({'custom' if p.get('IsCustom') else 'standard'})"
            )

        # ── Permission Set Groups ─────────────────────────────────
        try:
            groups = sf.query(f"""
                SELECT PermissionSetGroup.DeveloperName,
                       PermissionSetGroup.MasterLabel
                FROM PermissionSetAssignment
                WHERE AssigneeId = '{user_id}'
                AND PermissionSetGroupId != null
            """)
            if groups["totalSize"] > 0:
                lines.append(f"\nPermission Set Groups: {groups['totalSize']}")
                for row in groups.get("records", []):
                    grp = row.get("PermissionSetGroup") or {}
                    lines.append(
                        f"  • {grp.get('MasterLabel', grp.get('DeveloperName', 'N/A'))}"
                    )
        except Exception:
            pass   # PSGs might not be available in all API versions

        # ── Effective Object Permissions (aggregated) ─────────────
        if profile_id:
            all_ps_ids = _get_all_permset_ids(sf, user_id, profile_id)

            if all_ps_ids:
                ids_str = "','".join(all_ps_ids)
                obj_perms = sf.query(f"""
                    SELECT SObjectType,
                           PermissionsRead, PermissionsCreate,
                           PermissionsEdit, PermissionsDelete,
                           PermissionsViewAllRecords,
                           PermissionsModifyAllRecords
                    FROM ObjectPermissions
                    WHERE ParentId IN ('{ids_str}')
                    ORDER BY SObjectType
                """)

                # Aggregate: access is additive across all permission sets
                effective: dict[str, dict] = {}
                for p in obj_perms.get("records", []):
                    obj = p.get("SObjectType", "")
                    if obj not in effective:
                        effective[obj] = {
                            "r": False, "c": False, "e": False, "d": False,
                            "view_all": False, "mod_all": False
                        }
                    effective[obj]["r"]        |= bool(p.get("PermissionsRead"))
                    effective[obj]["c"]        |= bool(p.get("PermissionsCreate"))
                    effective[obj]["e"]        |= bool(p.get("PermissionsEdit"))
                    effective[obj]["d"]        |= bool(p.get("PermissionsDelete"))
                    effective[obj]["view_all"] |= bool(p.get("PermissionsViewAllRecords"))
                    effective[obj]["mod_all"]  |= bool(p.get("PermissionsModifyAllRecords"))

                lines.append("")
                lines.append("Effective Object Permissions (all permission sets aggregated):")
                lines.append("  [R=Read C=Create E=Edit D=Delete]")

                no_access = [
                    obj for obj, p in effective.items()
                    if not p["r"] and not p["c"]
                ]
                if no_access:
                    lines.append(f"  ❌ NO ACCESS objects: {', '.join(no_access[:5])}")

                for obj, p in sorted(effective.items()):
                    r = "R" if p["r"] else "-"
                    c = "C" if p["c"] else "-"
                    e = "E" if p["e"] else "-"
                    d = "D" if p["d"] else "-"
                    extras = []
                    if p["view_all"]:  extras.append("ViewAll")
                    if p["mod_all"]:   extras.append("ModAll")
                    extra_txt = f" ({', '.join(extras)})" if extras else ""
                    lines.append(f"  {obj:30} [{r}{c}{e}{d}]{extra_txt}")

        logger.info(f"✅ Effective permissions fetched for {user_id}")
        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"Profile/PS fetch failed: {exc}")
        return f"Could not read permissions for {user_id}: {str(exc)}"


@tool
def get_field_level_security(user_id: str, object_type: str) -> str:
    """
    Returns EFFECTIVE Field-Level Security across ALL permission sets.
    Salesforce FLS is additive — if ANY permission set grants edit, the field is editable.

    REMINDER: FLS never produces error messages.
    FLS = field greyed out or hidden. NOT "I get an error when saving."
    """
    try:
        sf = get_sf_client()

        user_r = sf.query(
            f"SELECT ProfileId, Profile.Name FROM User WHERE Id = '{user_id}'"
        )
        if user_r["totalSize"] == 0:
            return f"User {user_id} not found."

        profile_id   = user_r["records"][0]["ProfileId"]
        profile_name = (user_r["records"][0].get("Profile") or {}).get("Name", "Unknown")

        all_ps_ids = _get_all_permset_ids(sf, user_id, profile_id)
        if not all_ps_ids:
            return f"No permission sets found for user profile '{profile_name}'."

        ids_str = "','".join(all_ps_ids)
        fls     = sf.query(f"""
            SELECT Field, PermissionsRead, PermissionsEdit
            FROM FieldPermissions
            WHERE SobjectType = '{object_type}'
            AND ParentId IN ('{ids_str}')
        """)

        if fls.get("totalSize", 0) == 0:
            return (
                f"No explicit field permissions found for profile '{profile_name}' "
                f"on {object_type}. Fields inherit from object-level permissions."
            )

        # Aggregate FLS — additive across all permission sets
        effective_fls: dict[str, dict] = {}
        for row in fls.get("records", []):
            field = row["Field"].replace(f"{object_type}.", "")
            if field not in effective_fls:
                effective_fls[field] = {"read": False, "edit": False}
            effective_fls[field]["read"] |= bool(row["PermissionsRead"])
            effective_fls[field]["edit"] |= bool(row["PermissionsEdit"])

        full_access = sorted(f for f, p in effective_fls.items() if p["read"] and p["edit"])
        read_only   = sorted(f for f, p in effective_fls.items() if p["read"] and not p["edit"])
        no_access   = sorted(f for f, p in effective_fls.items() if not p["read"])

        lines = [
            f"Effective Field-Level Security for '{profile_name}' on {object_type}",
            f"(Aggregated across {len(all_ps_ids)} permission sets)",
            "─" * 70,
            f"Full Access : {len(full_access)} fields",
            f"Read-Only   : {len(read_only)} fields",
            f"No Access   : {len(no_access)} fields",
            "",
        ]

        if read_only:
            lines.append("⚠️  READ-ONLY fields (greyed out — cannot edit):")
            for f in read_only:
                lines.append(f"  • {f}")
            lines.append("")

        if no_access:
            lines.append("❌ HIDDEN fields (not visible):")
            for f in no_access:
                lines.append(f"  • {f}")
            lines.append("")

        if not read_only and not no_access:
            lines.append("✅ Full field access. FLS is NOT the cause.")
        else:
            lines.append(
                "If the anomaly field is in the read-only or hidden list above, "
                "FLS is the cause. Fix: Setup → Profiles or Permission Sets → Field Permissions."
            )

        logger.info(f"✅ Effective FLS: {len(fls.get('records', []))} field entries")
        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"FLS fetch failed: {exc}")
        return f"Could not read FLS for {user_id} on {object_type}: {str(exc)}"