"""
permissions_jobs.py
────────────────────
In-memory store for background permissions agent jobs.
Kept as a separate module so both the copilot route and
the new permissions-status route can share it without circular imports.
"""
from typing import Dict, Any

# job_id → {"status": "running"|"complete"|"failed", "result": {...}}
PERMISSIONS_JOBS: Dict[str, Dict[str, Any]] = {}
