from backend.app.application.ports.chat_port import ChatPort
from backend.app.application.use_cases.chat_with_ai import ChatWithAI


class FakeChatPort(ChatPort):
    def __init__(self, reply: str) -> None:
        self._reply = reply
        self.requested_history: list[tuple[str, str]] | None = None
        self.requested_message: str | None = None
        self.requested_level: str | None = None
        self.requested_origin_lang: str | None = None
        self.requested_target_lang: str | None = None

    def send_message(
        self,
        history: list[tuple[str, str]],
        message: str,
        level: str,
        origin_lang: str,
        target_lang: str,
    ) -> str:
        self.requested_history = history
        self.requested_message = message
        self.requested_level = level
        self.requested_origin_lang = origin_lang
        self.requested_target_lang = target_lang
        return self._reply


def test_returns_reply_from_port_and_passes_through_args():
    port = FakeChatPort("¡Hola! ¿Cómo estás?")
    use_case = ChatWithAI(port)
    history = [("user", "Hola"), ("ai", "¡Hola! ¿Qué tal?")]

    reply = use_case.execute(history, "Bien, gracias", "A2", "pt", "es")

    assert reply == "¡Hola! ¿Cómo estás?"
    assert port.requested_history == history
    assert port.requested_message == "Bien, gracias"
    assert port.requested_level == "A2"
    assert port.requested_origin_lang == "pt"
    assert port.requested_target_lang == "es"
