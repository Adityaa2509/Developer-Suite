"""
user_lookup.py
──────────────
Find Salesforce users by name, username, or email.
Critical for anomalies that mention a specific user by name.
Without this, the agent investigates the wrong user.
"""

from langchain.tools import tool
from app.salesforce.client import get_sf_client
from app.core.logger import get_logger

logger = get_logger(__name__)


@tool
def find_user_by_name(name: str) -> str:
    """
    Finds a Salesforce user by their name, email, or username.
    ALWAYS call this first when the anomaly mentions a specific user by name.
    Returns user ID, profile, active status, and role.

    Examples:
      find_user_by_name("Bandit Bob")
      find_user_by_name("john.smith@company.com")
      find_user_by_name("jsmith")

    After calling this, use the returned user ID with:
      get_user_profile_and_permsets(user_id)
      get_field_level_security(user_id, object_type)
    """
    try:
        sf = get_sf_client()

        # Search across Name, FirstName, LastName, Username, Email
        query = f"""
            SELECT Id, Name, FirstName, LastName,
                   Username, Email, IsActive,
                   Profile.Name, Profile.Id,
                   UserRole.Name, UserType,
                   LastLoginDate
            FROM User
            WHERE (
                Name LIKE '%{name}%'
                OR Username LIKE '%{name}%'
                OR Email LIKE '%{name}%'
                OR FirstName LIKE '%{name}%'
                OR LastName LIKE '%{name}%'
                OR Alias LIKE '%{name}%'
            )
            ORDER BY IsActive DESC, Name
            LIMIT 10
        """

        result = sf.query(query)

        if result["totalSize"] == 0:
            return (
                f"No user found matching '{name}'. "
                f"Check the exact name, email, or username. "
                f"The user may have been deactivated or the name is spelled differently."
            )

        lines = [
            f"Users matching '{name}': {result['totalSize']} found",
            "─" * 70,
        ]

        for u in result["records"]:
            is_active    = u.get("IsActive", False)
            status_icon  = "✅ ACTIVE" if is_active else "❌ INACTIVE"
            profile      = (u.get("Profile") or {}).get("Name", "Unknown")
            role         = (u.get("UserRole") or {}).get("Name", "None")
            last_login   = u.get("LastLoginDate", "Never")

            lines.append(f"\n{status_icon} — {u.get('Name', 'Unknown')}")
            lines.append(f"  User ID      : {u['Id']}")
            lines.append(f"  Username     : {u.get('Username', '')}")
            lines.append(f"  Email        : {u.get('Email', '')}")
            lines.append(f"  Profile      : {profile}")
            lines.append(f"  Role         : {role}")
            lines.append(f"  Last Login   : {last_login}")

            if not is_active:
                lines.append(
                    f"  🚨 INACTIVE — this user cannot log in or access any records. "
                    f"This is very likely the root cause if the anomaly is about access."
                )

        # If exactly one user found, make it easy to use
        if result["totalSize"] == 1:
            user_id = result["records"][0]["Id"]
            lines.append(f"\n✅ Exact match found. User ID: {user_id}")
            lines.append(
                f"Call get_user_profile_and_permsets('{user_id}') "
                f"to check their permissions."
            )

        logger.info(f"✅ User lookup: {result['totalSize']} results for '{name}'")
        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"User lookup failed: {exc}")
        return f"Could not search for user '{name}': {str(exc)}"