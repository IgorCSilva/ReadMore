"""GoogleTranslateTtsClient — proxies Google Translate's TTS endpoint."""
import urllib.error
import urllib.parse
import urllib.request

from backend.app.application.ports.tts_port import TtsPort
from backend.app.domain.exceptions import TtsUpstreamError

_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)


class GoogleTranslateTtsClient(TtsPort):
    def __init__(self, timeout: int = 10) -> None:
        self._timeout = timeout

    def synthesize(self, text: str, lang: str) -> tuple[bytes, str]:
        google_url = (
            "https://translate.google.com/translate_tts?ie=UTF-8&q="
            + urllib.parse.quote(text)
            + "&tl=" + urllib.parse.quote(lang)
            + "&client=tw-ob"
        )
        req = urllib.request.Request(
            google_url,
            headers={
                "User-Agent": _USER_AGENT,
                "Referer": "https://translate.google.com/",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                audio_bytes = resp.read()
                content_type = resp.headers.get("Content-Type", "audio/mpeg")
        except (urllib.error.URLError, urllib.error.HTTPError) as err:
            raise TtsUpstreamError(str(err)) from err
        return audio_bytes, content_type
