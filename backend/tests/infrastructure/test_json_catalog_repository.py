import json

from backend.app.infrastructure.repositories.json_catalog_repository import JsonCatalogRepository


def test_list_languages_reads_top_level_keys_from_catalog_file(tmp_path):
    catalog_path = tmp_path / "catalog.json"
    catalog_path.write_text(json.dumps({"english": {}, "spanish": {}}), encoding="utf-8")

    repository = JsonCatalogRepository(catalog_path)

    assert repository.list_languages() == ["english", "spanish"]
