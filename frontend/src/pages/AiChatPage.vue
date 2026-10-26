<template>
  <div class="ai-chat-page">
    <h1 class="ai-chat-title">AI Chat</h1>
    <p class="ai-chat-subtitle">
      Open Gemini or ChatGPT in a new tab to practice conversation with a full AI chat assistant —
      no backend round trip, so it won't be affected by server errors here.
    </p>

    <div class="ai-chat-links">
      <a class="ai-chat-link" href="https://gemini.google.com/app" target="_blank" rel="noopener noreferrer">
        Open Gemini
      </a>
      <a
        class="ai-chat-link"
        href="https://chatgpt.com/g/g-p-6a06fedf07e88191bf657aeff5469948-idioms/c/68aef845-dae4-8327-bffc-3c4306d263b4"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open ChatGPT (Spanish)
      </a>
    </div>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.ai-chat-page {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.ai-chat-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
}

.ai-chat-subtitle {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
}

.ai-chat-links {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.ai-chat-link {
  padding: 10px 22px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.ai-chat-link:hover {
  background: var(--accent-strong);
}
</style>
