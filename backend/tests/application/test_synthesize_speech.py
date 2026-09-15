from backend.app.application.ports.tts_port import TtsPort
from backend.app.application.use_cases.synthesize_speech import SynthesizeSpeech


class FakeTtsPort(TtsPort):
    def __init__(self, audio_bytes: bytes, content_type: str) -> None:
        self._audio_bytes = audio_bytes
        self._content_type = content_type
        self.requested_text: str | None = None
        self.requested_lang: str | None = None

    def synthesize(self, text: str, lang: str) -> tuple[bytes, str]:
        self.requested_text = text
        self.requested_lang = lang
        return self._audio_bytes, self._content_type


def test_returns_audio_bytes_and_content_type_from_port():
    port = FakeTtsPort(b"fake-mp3-bytes", "audio/mpeg")
    use_case = SynthesizeSpeech(port)

    audio_bytes, content_type = use_case.execute("hello", "es")

    assert audio_bytes == b"fake-mp3-bytes"
    assert content_type == "audio/mpeg"
    assert port.requested_text == "hello"
    assert port.requested_lang == "es"
