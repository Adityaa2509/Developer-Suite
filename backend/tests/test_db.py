import pytest
from app.db.database import init_db, Investigation, SessionLocal, engine
from app.rag.chroma_client import get_chroma_client, get_or_create_collection
from sqlalchemy import inspect


def test_sqlite_tables_created():
    init_db()
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    assert "investigations" in tables
    print(f"\n✅ SQLite tables: {tables}")


def test_investigation_insert_and_read():
    init_db()
    db = SessionLocal()

    inv = Investigation(
        record_id="500TEST",
        object_type="Case",
        anomaly="Test anomaly for Day 1 verification",
        status="pending",
    )
    db.add(inv)
    db.commit()

    found = db.query(Investigation).filter_by(record_id="500TEST").first()
    assert found is not None
    assert found.status == "pending"

    db.delete(found)
    db.commit()
    db.close()
    print("\n✅ SQLite insert + read + delete OK")


def test_chroma_initialises():
    client = get_chroma_client()
    assert client is not None
    print("\n✅ Chroma client initialised")


def test_chroma_collection_creates():
    col = get_or_create_collection("test_collection_day1")
    assert col is not None
    assert col.name == "test_collection_day1"
    print("\n✅ Chroma collection created")


def test_chroma_add_and_query():
    col = get_or_create_collection("test_collection_day1")

    col.upsert(
        documents=["CaseHandler Apex class handles case trigger logic"],
        ids=["test_doc_001"],
        metadatas=[{"type": "ApexClass", "name": "CaseHandler"}],
    )

    results = col.query(query_texts=["case trigger"], n_results=1)
    assert len(results["documents"][0]) > 0
    print(f"\n✅ Chroma query OK: {results['documents'][0][0][:60]}")
