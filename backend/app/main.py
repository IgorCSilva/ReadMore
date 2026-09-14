"""FastAPI entrypoint — Phase 1 of RESTRUCTURE_PLAN.md.

Stands up alongside backend/server.py, not replacing it yet. Endpoints are
ported one at a time (see RESTRUCTURE_PLAN.md Phase 1) behind the layered
domain/application/infrastructure structure; this file currently reads
catalog.json directly since no layering has been introduced yet.
"""
import json
from pathlib import Path

from fastapi import FastAPI

BACKEND_DIR = Path(__file__).resolve().parent.parent
CATALOG_PATH = BACKEND_DIR / "catalog.json"

app = FastAPI()


def load_catalog() -> dict:
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/languages")
def get_languages():
    catalog = load_catalog()
    return {"languages": list(catalog.keys())}
