from backend.app.application.ports.tts_port import TtsPort


class SynthesizeSpeech:
    def __init__(self, tts_port: TtsPort) -> None:
        self._tts_port = tts_port

    def execute(self, text: str, lang: str) -> tuple[bytes, str]:
        return self._tts_port.synthesize(text, lang)
