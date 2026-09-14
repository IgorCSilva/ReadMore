"""FastAPI entrypoint — Phase 1 of RESTRUCTURE_PLAN.md.

Stands up alongside backend/server.py, not replacing it yet. Endpoints are
ported one at a time (see RESTRUCTURE_PLAN.md Phase 1) behind the layered
domain/application/infrastructure structure. This is the composition root:
it's the only place concrete infrastructure classes get instantiated and
handed to use cases via FastAPI's Depends.
"""
from pathlib import Path

from fastapi import Depends, FastAPI

from backend.app.application.use_cases.list_languages import ListLanguages
from backend.app.infrastructure.repositories.json_catalog_repository import JsonCatalogRepository

BACKEND_DIR = Path(__file__).resolve().parent.parent
CATALOG_PATH = BACKEND_DIR / "catalog.json"

app = FastAPI()


def get_catalog_repository() -> JsonCatalogRepository:
    return JsonCatalogRepository(CATALOG_PATH)


@app.get("/languages")
def get_languages(
    catalog_repository: JsonCatalogRepository = Depends(get_catalog_repository),
):
    use_case = ListLanguages(catalog_repository)
    return {"languages": use_case.execute()}
