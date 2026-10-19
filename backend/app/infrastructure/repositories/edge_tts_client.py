"""EdgeTtsClient — Microsoft Edge's free "read aloud" TTS service: the same
Neural voice engine Azure Speech sells behind a card-gated billing account,
reached instead via Edge's own free consumer endpoint (no key, no signup).
Uses the `edge-tts` package rather than hand-rolling the WebSocket protocol
ourselves, since it tracks Microsoft's undocumented, occasionally-changing
client-auth token so this code doesn't have to."""
import asyncio

import edge_tts
from edge_tts.exceptions import EdgeTTSException

from backend.app.application.ports.tts_port import TtsPort
from backend.app.domain.exceptions import TtsUpstreamError

# One Neural voice per bare code the /tts route receives (see
# frontend/src/shared/api.ts's ttsUrl) — same locales as
# frontend/src/shared/languages.ts's SPEECH_LOCALES, just resolved to a
# specific Edge voice short-name rather than a bare BCP-47 tag.
_VOICES = {
    "pt": "pt-BR-FranciscaNeural",
    "en": "en-US-AriaNeural",
    "es": "es-ES-ElviraNeural",
    "ko": "ko-KR-SunHiNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
}


class EdgeTtsClient(TtsPort):
    def synthesize(self, text: str, lang: str) -> tuple[bytes, str]:
        voice = _VOICES.get(lang)
        if not voice:
            raise TtsUpstreamError(f"no Edge TTS voice configured for lang={lang!r}")

        try:
            audio_bytes = asyncio.run(self._synthesize_async(text, voice))
        except EdgeTTSException as err:
            raise TtsUpstreamError(str(err)) from err

        if not audio_bytes:
            raise TtsUpstreamError("Edge TTS returned no audio")
        return audio_bytes, "audio/mpeg"

    @staticmethod
    async def _synthesize_async(text: str, voice: str) -> bytes:
        chunks = bytearray()
        async for chunk in edge_tts.Communicate(text, voice).stream():
            if chunk["type"] == "audio":
                chunks.extend(chunk["data"])
        return bytes(chunks)
