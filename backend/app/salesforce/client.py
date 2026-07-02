from simple_salesforce import Salesforce
from app.core.config import get_settings
from app.core.logger import get_logger

logger = get_logger(__name__)

_sf_instance: Salesforce | None = None


def get_sf_client() -> Salesforce:
    """
    Singleton Salesforce connection.
    Uses username + password + security token auth.
    Call reset_sf_client() if session expires.
    """
    global _sf_instance

    if _sf_instance is None:
        s = get_settings()
        logger.info(f"Connecting to Salesforce as {s.SF_USERNAME}")

        _sf_instance = Salesforce(
            username=s.SF_USERNAME,
            password=s.SF_PASSWORD,
            security_token=s.SF_SECURITY_TOKEN,
            domain=s.SF_DOMAIN,
            version=s.SF_API_VERSION,
        )

        logger.info(f"✅ Connected: {_sf_instance.sf_instance}")

    return _sf_instance


def reset_sf_client() -> None:
    """Force reconnect on next call."""
    global _sf_instance
    _sf_instance = None
    logger.info("SF client reset")
