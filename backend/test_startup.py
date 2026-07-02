import time
print("1. Importing contextlib...")
from contextlib import asynccontextmanager
print("2. Importing fastapi...")
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
print("3. Importing config...")
from app.core.config import get_settings
settings = get_settings()
print("4. Importing database...")
from app.db.database import init_db, engine
print("5. Initializing database...")
init_db()
print("6. Importing registry...")
from app.tools.registry import ALL_TOOLS
print("7. Importing graph...")
from app.agent.graph import investigation_graph
print("8. Startup check complete! Everything runs successfully.")
