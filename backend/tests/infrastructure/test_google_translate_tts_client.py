from backend.app.infrastructure.repositories.google_translate_tts_client import (
    GoogleTranslateTtsClient,
)


def test_synthesize_returns_audio_bytes_and_content_type():
    """Real call — Google's public TTS endpoint needs no credentials, unlike
    the Sheets-backed repositories, so there's nothing to gate this on."""
    client = GoogleTranslateTtsClient()

    audio_bytes, content_type = client.synthesize("hello")

    assert isinstance(audio_bytes, bytes)
    assert len(audio_bytes) > 0
    assert content_type
