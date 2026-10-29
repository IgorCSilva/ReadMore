import pytest

from backend.app.domain.exceptions import TtsUpstreamError
from backend.app.infrastructure.repositories.edge_tts_client import EdgeTtsClient


def test_synthesize_returns_audio_bytes_and_content_type():
    """Real call — Edge's free read-aloud endpoint needs no credentials,
    same reasoning as test_google_translate_tts_client.py."""
    client = EdgeTtsClient()

    audio_bytes, content_type = client.synthesize("hello", "en")

    assert isinstance(audio_bytes, bytes)
    assert len(audio_bytes) > 0
    assert content_type == "audio/mpeg"


def test_synthesize_raises_for_a_language_with_no_configured_voice():
    client = EdgeTtsClient()

    with pytest.raises(TtsUpstreamError):
        client.synthesize("guten tag", "de")
