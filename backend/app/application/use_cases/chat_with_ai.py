from backend.app.application.ports.chat_port import ChatPort


class ChatWithAI:
    def __init__(self, chat_port: ChatPort) -> None:
        self._chat_port = chat_port

    def execute(
        self,
        history: list[tuple[str, str]],
        message: str,
        level: str,
        origin_lang: str,
        target_lang: str,
    ) -> str:
        return self._chat_port.send_message(history, message, level, origin_lang, target_lang)
