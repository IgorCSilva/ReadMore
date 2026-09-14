"""Baseline smoke tests for the pre-restructure server.py.

These only exercise catalog-backed endpoints (no Google Sheets credentials
needed) so they run the same locally and in CI: GET /languages and
GET /words. They exist to catch accidental regressions while the backend is
being re-layered in later restructure steps.
"""
import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest

SERVER_PATH = Path(__file__).resolve().parent.parent / "server.py"


def _free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_until_up(base_url, timeout=10):
    deadline = time.time() + timeout
    last_err = None
    while time.time() < deadline:
        try:
            urllib.request.urlopen(f"{base_url}/languages", timeout=1)
            return
        except (urllib.error.URLError, ConnectionError) as err:
            last_err = err
            time.sleep(0.1)
    raise RuntimeError(f"server never became reachable: {last_err}")


@pytest.fixture(scope="module")
def server():
    port = _free_port()
    # server.py reads HOST/PORT from the environment before falling back to the
    # CLI arg, so an ambient PORT (e.g. set by docker-compose.yaml) would silently
    # win over our chosen free port unless we override it here.
    env = {**os.environ, "HOST": "127.0.0.1", "PORT": str(port)}
    proc = subprocess.Popen(
        [sys.executable, str(SERVER_PATH), str(port)],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env,
    )
    base_url = f"http://127.0.0.1:{port}"
    try:
        _wait_until_up(base_url)
        yield base_url
    finally:
        proc.terminate()
        proc.wait(timeout=5)


def _get_json(url):
    with urllib.request.urlopen(url, timeout=5) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


def test_languages_lists_catalog_languages(server):
    status, body = _get_json(f"{server}/languages")
    assert status == 200
    assert set(body["languages"]) == {"english", "spanish"}


def test_words_returns_catalog_words_for_language(server):
    status, body = _get_json(f"{server}/words?lang=english")
    assert status == 200
    assert body["lang"] == "english"
    assert isinstance(body["words"], list)
    assert len(body["words"]) > 0
    first = body["words"][0]
    assert {"word_id", "original", "filename"} <= first.keys()


def test_words_unknown_language_is_404(server):
    with pytest.raises(urllib.error.HTTPError) as exc_info:
        urllib.request.urlopen(f"{server}/words?lang=klingon", timeout=5)
    assert exc_info.value.code == 404
