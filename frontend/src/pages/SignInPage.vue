<template>
  <div class="signin-page">
    <RouterLink to="/" class="signin-back">← Back</RouterLink>

    <div class="signin-card">
      <div class="signin-brand">ReadMore</div>
      <h1 class="signin-title">Sign In</h1>

      <div class="signin-current" v-if="currentUser.email">
        <p class="signin-current-label">Continue as</p>
        <button type="button" class="signin-current-btn" @click="continueAsCurrentUser">
          {{ currentUser.email }}
        </button>
        <p class="signin-or">or sign in with a different email below</p>
      </div>

      <form class="signin-form" @submit.prevent="submit">
        <label class="signin-field">
          <span>Email</span>
          <input
            type="email"
            class="signin-input"
            v-model="email"
            placeholder="you@example.com"
            autocomplete="email"
          />
        </label>

        <p class="signin-error" v-if="error">{{ error }}</p>

        <button type="submit" class="signin-submit-btn">Sign In</button>
      </form>

      <p class="signin-hint">
        Password sign-in is coming soon, for extra account security. For now, your email is how
        ReadMore recognizes you and keeps your progress safe.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentUser, isValidEmail, setUserEmail } from '../shared/currentUser'
import { notify } from '../shared/notifications'

const router = useRouter()
const currentUser = getCurrentUser()

const email = ref('')
const error = ref('')

function continueAsCurrentUser() {
  router.push('/home')
}

// Signing in with a different email than the one currently stored simply
// overwrites it (setUserEmail) — the previous session's email is gone from
// state/localStorage the moment this returns, which is what "logs out" the
// previous user in practice. No separate clear step needed.
function submit() {
  const trimmed = email.value.trim()
  if (!isValidEmail(trimmed)) {
    error.value = 'Enter a valid email address.'
    return
  }
  error.value = ''
  setUserEmail(trimmed)
  notify('success', 'Signed in.')
  router.push('/home')
}
</script>

<style scoped>
.signin-page {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.signin-back {
  color: var(--muted);
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}

.signin-back:hover {
  color: var(--accent);
}

.signin-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 32px 28px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 20px;
}

.signin-brand {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}

.signin-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
}

.signin-current {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: var(--accent-soft);
  border-radius: 14px;
}

.signin-current-label {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.signin-current-btn {
  align-self: flex-start;
  padding: 8px 16px;
  border-radius: 999px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.signin-current-btn:hover {
  background: var(--accent-strong);
}

.signin-or {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

.signin-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.signin-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}

.signin-input {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 15px;
  font-family: inherit;
}

.signin-input:focus {
  outline: none;
  border-color: var(--accent);
}

.signin-error {
  margin: 0;
  font-size: 13px;
  color: #e0453a;
}

.signin-submit-btn {
  padding: 12px 20px;
  border-radius: 999px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.signin-submit-btn:hover {
  background: var(--accent-strong);
}

.signin-hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--muted);
}
</style>
