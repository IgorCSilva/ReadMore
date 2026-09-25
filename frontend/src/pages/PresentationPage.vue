<template>
  <div class="pres-topbar">
    <div class="pres-topbar-actions">
      <div class="pres-lang-toggle" role="group" aria-label="Language">
        <button type="button" :class="{ active: uiLang === 'en' }" @click="uiLang = 'en'">EN</button>
        <button type="button" :class="{ active: uiLang === 'pt' }" @click="uiLang = 'pt'">PT</button>
      </div>
      <button type="button" class="pres-btn pres-btn-ghost" disabled :title="t.comingSoon">{{ t.signUp }}</button>
      <button type="button" class="pres-btn pres-btn-solid" @click="goToSignIn">{{ t.signIn }}</button>
    </div>
    <div class="pres-brand">ReadMore</div>
  </div>

  <div class="pres-page">
    <section class="pres-hero">
      <div class="pres-hero-blob pres-hero-blob-1" :style="blob1Style"></div>
      <div class="pres-hero-blob pres-hero-blob-2" :style="blob2Style"></div>

      <div class="pres-hero-content">
        <h1 class="pres-hero-title">{{ t.heroTitle }}</h1>
        <p class="pres-hero-subtitle">{{ t.heroSubtitle }}</p>
        <div class="pres-hero-actions">
          <button type="button" class="pres-cta-btn" @click="goToSignIn">{{ t.ctaGetStarted }}</button>
          <a href="#methods" class="pres-secondary-btn">{{ t.ctaSeeHow }}</a>
        </div>
      </div>
    </section>

    <section class="pres-section" id="purpose">
      <h2 class="pres-section-title reveal">{{ t.purposeTitle }}</h2>
      <p class="pres-section-lead reveal">{{ t.purposeLead }}</p>
    </section>

    <section class="pres-section pres-methods" id="methods">
      <h2 class="pres-section-title reveal">{{ t.methodTitle }}</h2>
      <div class="pres-steps">
        <div
          class="pres-step reveal"
          v-for="(step, i) in t.methodSteps"
          :key="i"
          :style="{ transitionDelay: i * 0.08 + 's' }"
        >
          <div class="pres-step-number">{{ i + 1 }}</div>
          <h3 class="pres-step-title">{{ step.title }}</h3>
          <p class="pres-step-text">{{ step.text }}</p>
        </div>
      </div>
    </section>

    <section class="pres-section pres-benefits" id="benefits">
      <h2 class="pres-section-title reveal">{{ t.benefitsTitle }}</h2>
      <div class="pres-benefit-grid">
        <div
          class="pres-benefit-card reveal"
          v-for="(benefit, i) in t.benefits"
          :key="i"
          :style="{ transitionDelay: i * 0.08 + 's' }"
        >
          <h3>{{ benefit.title }}</h3>
          <p>{{ benefit.text }}</p>
        </div>
      </div>
    </section>

    <footer class="pres-footer">
      <div class="pres-footer-brand">ReadMore</div>
      <p class="pres-footer-tagline">{{ t.footerTagline }}</p>
      <div class="pres-footer-links">
        <RouterLink to="/signin">{{ t.signIn }}</RouterLink>
        <button type="button" disabled :title="t.comingSoon">{{ t.signUp }}</button>
      </div>
      <p class="pres-footer-copy">© {{ currentYear }} ReadMore. {{ t.footerCopyright }}</p>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const currentYear = new Date().getFullYear()

// This page is the one public, pre-sign-in surface — everyone lands here
// regardless of which language pair they'll later study, so its own display
// language is a separate, simpler choice: just a toggle between English and
// Portuguese, not tied to shared/languagePreference.ts's origin/target pair.
const TRANSLATIONS = {
  en: {
    signUp: 'Sign Up',
    signIn: 'Sign In',
    comingSoon: 'Coming soon',
    heroTitle: 'Learn a language the way your brain actually remembers it.',
    heroSubtitle: 'ReadMore teaches every new word through sight, sound, and touch — see it, say it, write it, read it in context, then prove you can hear it too.',
    ctaGetStarted: 'Get Started',
    ctaSeeHow: 'See how it works ↓',
    purposeTitle: 'Why ReadMore',
    purposeLead: 'Most apps hand you a word list and a quiz. ReadMore builds a real teaching path instead: every chapter is a topic worth talking about, broken into small, five-word parts you can actually finish in one sitting — no infinite backlog, no guessing what to study next.',
    methodTitle: 'The method',
    methodSteps: [
      {
        title: 'See it',
        text: 'Every word starts with a picture or a clear native-language cue, plus its pronunciation — a face to put to the name before anything else.',
      },
      {
        title: 'Say it',
        text: 'Speak the word out loud. Your browser listens and tells you right away whether it matched.',
      },
      {
        title: 'Write it',
        text: 'Type it from memory. A letter-by-letter comparison shows exactly what was right and what to fix.',
      },
      {
        title: 'Read it',
        text: 'See the word again inside real, natural sentences — the context that turns a word you know into a word you can use.',
      },
      {
        title: 'Hear it',
        text: 'Listen to a full sentence and tap the words you recognize, in the order you hear them — the final proof it stuck.',
      },
    ],
    benefitsTitle: 'Why it sticks',
    benefits: [
      {
        title: 'Several language pairs',
        text: 'Start from Portuguese and learn English, Spanish, or Korean today, with more pairs on the way.',
      },
      {
        title: 'Picks up where you left off',
        text: 'Every part, every page, every scroll position is remembered — nothing to redo just because you closed the tab.',
      },
      {
        title: 'Extra practice where it counts',
        text: 'Words you\'re still shaky on quietly resurface in later reviews, instead of being marked "done" too soon.',
      },
      {
        title: 'Works on a shaky connection',
        text: 'Your word list loads instantly from what\'s already on your device, and any progress you make while offline is saved the moment you\'re back.',
      },
      {
        title: 'One method, every sense',
        text: 'Sight, sound, and touch reinforce each other in the same short session, instead of five separate apps.',
      },
    ],
    footerTagline: 'Learn languages your way — one word, one sentence, one habit at a time.',
    footerCopyright: 'All rights reserved.',
  },
  pt: {
    signUp: 'Criar conta',
    signIn: 'Entrar',
    comingSoon: 'Em breve',
    heroTitle: 'Aprenda um idioma do jeito que seu cérebro realmente memoriza.',
    heroSubtitle: 'O ReadMore ensina cada palavra nova pela visão, pelo som e pelo toque — veja, fale, escreva, leia no contexto e depois prove que também consegue ouvir.',
    ctaGetStarted: 'Começar agora',
    ctaSeeHow: 'Veja como funciona ↓',
    purposeTitle: 'Por que o ReadMore',
    purposeLead: 'A maioria dos aplicativos só entrega uma lista de palavras e um teste. O ReadMore constrói um caminho de ensino de verdade: cada capítulo é um tema que vale a pena conversar, dividido em partes pequenas de cinco palavras que você realmente consegue terminar de uma vez — sem backlog infinito, sem ficar adivinhando o que estudar depois.',
    methodTitle: 'O método',
    methodSteps: [
      {
        title: 'Veja',
        text: 'Cada palavra começa com uma imagem ou uma dica clara no seu idioma, além da pronúncia — um rosto para associar ao nome antes de qualquer coisa.',
      },
      {
        title: 'Fale',
        text: 'Fale a palavra em voz alta. Seu navegador escuta e diz na hora se você acertou.',
      },
      {
        title: 'Escreva',
        text: 'Digite de memória. Uma comparação letra por letra mostra exatamente o que acertou e o que precisa corrigir.',
      },
      {
        title: 'Leia',
        text: 'Veja a palavra de novo dentro de frases reais e naturais — o contexto que transforma uma palavra conhecida em uma palavra que você sabe usar.',
      },
      {
        title: 'Ouça',
        text: 'Ouça uma frase completa e toque nas palavras que reconhecer, na ordem em que ouvir — a prova final de que aprendeu.',
      },
    ],
    benefitsTitle: 'Por que funciona',
    benefits: [
      {
        title: 'Vários pares de idiomas',
        text: 'Comece do português e aprenda inglês, espanhol ou coreano hoje mesmo, com mais pares a caminho.',
      },
      {
        title: 'Continua de onde você parou',
        text: 'Cada parte, cada página, cada posição de rolagem é lembrada — nada para refazer só porque você fechou a aba.',
      },
      {
        title: 'Prática extra onde importa',
        text: 'Palavras que você ainda não domina voltam discretamente em revisões futuras, em vez de serem marcadas como "concluídas" cedo demais.',
      },
      {
        title: 'Funciona com conexão instável',
        text: 'Sua lista de palavras carrega na hora a partir do que já está no seu dispositivo, e qualquer progresso feito offline é salvo assim que você volta a ficar online.',
      },
      {
        title: 'Um método, todos os sentidos',
        text: 'Visão, som e toque se reforçam na mesma sessão curta, em vez de cinco aplicativos separados.',
      },
    ],
    footerTagline: 'Aprenda idiomas do seu jeito — uma palavra, uma frase, um hábito de cada vez.',
    footerCopyright: 'Todos os direitos reservados.',
  },
}

const uiLang = ref('en')
const t = computed(() => TRANSLATIONS[uiLang.value])

function goToSignIn() {
  router.push('/signin')
}

// A light parallax on the hero's decorative gradient blobs — each moves at
// a different fraction/direction of scroll speed than the page itself, the
// simplest "things move as you scroll" effect without a library.
const scrollY = ref(0)
let ticking = false

function onScroll() {
  if (ticking) return
  ticking = true
  window.requestAnimationFrame(() => {
    scrollY.value = window.scrollY
    ticking = false
  })
}

const blob1Style = computed(() => ({ transform: `translateY(${scrollY.value * 0.25}px)` }))
const blob2Style = computed(() => ({ transform: `translateY(${scrollY.value * -0.18}px)` }))

// Section content fades/slides in once scrolled into view — degrades to
// "just show everything" when IntersectionObserver isn't available, rather
// than leaving content permanently invisible.
const IO_SUPPORTED = typeof IntersectionObserver !== 'undefined'
let observer = null

function setupScrollReveal() {
  const targets = document.querySelectorAll('.reveal')
  if (!IO_SUPPORTED) {
    targets.forEach((el) => el.classList.add('reveal-visible'))
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible')
          observer.unobserve(entry.target)
        }
      }
    },
    { threshold: 0.15 },
  )
  targets.forEach((el) => observer.observe(el))
}

// Same full-bleed reasoning as PartFlowPage.vue — this page owns its own
// fixed top bar and edge-to-edge sections, not the default centered-card
// body padding.
onMounted(() => {
  document.body.classList.add('part-flow-active')
  window.addEventListener('scroll', onScroll, { passive: true })
  setupScrollReveal()
})

onUnmounted(() => {
  document.body.classList.remove('part-flow-active')
  window.removeEventListener('scroll', onScroll)
  observer?.disconnect()
})
</script>

<style scoped>
.pres-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 24px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  z-index: 100;
}

.pres-topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pres-lang-toggle {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 999px;
  overflow: hidden;
  margin-right: 4px;
}

.pres-lang-toggle button {
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.pres-lang-toggle button.active {
  background: var(--accent);
  color: #fff;
}

.pres-btn {
  padding: 9px 18px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.pres-btn-ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pres-btn-solid {
  border-color: transparent;
  background: var(--accent);
  color: #fff;
}

.pres-btn-solid:hover {
  background: var(--accent-strong);
}

/* The "special design" for the brand mark: a gradient-filled wordmark,
   deliberately right-aligned instead of the usual top-left logo spot. */
.pres-brand {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, var(--accent) 0%, #b06cff 55%, #ff6fb0 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

.pres-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  padding-top: 64px;
}

.pres-hero {
  position: relative;
  width: 100%;
  min-height: 86vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: radial-gradient(circle at 20% 20%, var(--accent-soft) 0%, transparent 55%),
    radial-gradient(circle at 80% 30%, rgba(176, 108, 255, 0.15) 0%, transparent 50%), var(--bg);
}

.pres-hero-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.55;
  pointer-events: none;
}

.pres-hero-blob-1 {
  width: 420px;
  height: 420px;
  top: -120px;
  left: -100px;
  background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
}

.pres-hero-blob-2 {
  width: 380px;
  height: 380px;
  bottom: -140px;
  right: -80px;
  background: radial-gradient(circle, #ff6fb0 0%, transparent 70%);
}

.pres-hero-content {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 720px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  text-align: center;
}

.pres-hero-title {
  margin: 0;
  font-size: clamp(32px, 5.5vw, 52px);
  font-weight: 800;
  line-height: 1.15;
  color: var(--text);
}

.pres-hero-subtitle {
  margin: 0;
  font-size: clamp(16px, 2.2vw, 19px);
  line-height: 1.6;
  color: var(--muted);
  max-width: 560px;
}

.pres-hero-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

.pres-cta-btn {
  padding: 14px 30px;
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, var(--accent) 0%, #b06cff 100%);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}

.pres-cta-btn:hover {
  filter: brightness(1.08);
}

.pres-secondary-btn {
  color: var(--text);
  text-decoration: none;
  font-size: 15px;
  font-weight: 600;
}

.pres-secondary-btn:hover {
  color: var(--accent);
}

.pres-section {
  width: 100%;
  padding: 100px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.pres-section:nth-child(even) {
  background: var(--card);
}

.pres-section-title {
  margin: 0 0 18px;
  font-size: clamp(26px, 4vw, 36px);
  font-weight: 800;
  color: var(--text);
}

.pres-section-lead {
  margin: 0;
  max-width: 680px;
  font-size: 17px;
  line-height: 1.7;
  color: var(--muted);
}

.pres-steps {
  width: 100%;
  max-width: 960px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 20px;
}

.pres-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 26px 18px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 18px;
  text-align: center;
}

.pres-step-number {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 800;
  font-size: 15px;
}

.pres-step-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--text);
}

.pres-step-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--muted);
}

.pres-benefit-grid {
  width: 100%;
  max-width: 960px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  text-align: left;
}

.pres-benefit-card {
  padding: 24px 22px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 18px;
}

.pres-benefits .pres-benefit-card {
  background: var(--bg);
}

.pres-benefit-card h3 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.pres-benefit-card p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--muted);
}

.reveal {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}

.reveal-visible {
  opacity: 1;
  transform: none;
}

.pres-footer {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 24px;
  text-align: center;
  border-top: 1px solid var(--border);
}

.pres-footer-brand {
  font-size: 18px;
  font-weight: 800;
  color: var(--text);
}

.pres-footer-tagline {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
  max-width: 420px;
}

.pres-footer-links {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 6px;
}

.pres-footer-links a {
  color: var(--accent);
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
}

.pres-footer-links button {
  border: none;
  background: none;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  cursor: not-allowed;
  padding: 0;
}

.pres-footer-copy {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--muted);
}
</style>
