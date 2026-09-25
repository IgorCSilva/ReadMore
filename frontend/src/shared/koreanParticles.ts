// Dedicated color definitions for Korean grammatical particles, one entry
// per particle_type a word can carry (see backend/words/ko_words.json's own
// "particle_type" field, and backend/app/domain/korean_particles.py for how
// a particle's actual surface form — 은/는, 이/가, 을/를, 와/과/랑/이랑 — is
// picked). Each particle type gets its own hue (not shades of one color) so
// they stay easy to tell apart at a glance in running text — topic keeps
// the violet of --accent-ko (see App.vue's :root[data-lang="ko"] block) as
// the "default" Korean marker, with subject/object/addition fanned out to
// green/orange/teal. Mirrors shared/genders.ts's Gender/getGender/
// formatWordByGender shape.
export interface Particle {
  id: string
  color: string | null
  style: string
}

const PARTICLES: Record<string, Particle> = {
  topic: { id: 'topic', color: '#339afa', style: '{word}' }, // 은/는 — blue
  subject: { id: 'subject', color: '#2fa84f', style: '{word}' }, // 이/가 — green
  object: { id: 'object', color: '#e08a3c', style: '{word}' }, // 을/를 — orange
  addition: { id: 'addition', color: '#f75b3f', style: '{word}' }, // 와/과, 랑/이랑 — red
  not_apply: { id: 'not_apply', color: null, style: '{word}' },
}

const DEFAULT_PARTICLE = PARTICLES.not_apply

export function getParticle(particleTypeId?: string | null): Particle {
  return (particleTypeId && PARTICLES[particleTypeId]) || DEFAULT_PARTICLE
}

export function formatWordByParticle(word: string, particleTypeId?: string | null): string {
  return getParticle(particleTypeId).style.replace('{word}', word)
}
