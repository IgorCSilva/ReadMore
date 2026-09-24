// Dedicated color definitions for Korean grammatical particles, one entry
// per particle_type a word can carry (see backend/words/ko_words.json's own
// "particle_type" field, and backend/app/domain/korean_particles.py for how
// a particle's actual surface form — 은/는, 이/가, 을/를, 와/과/랑/이랑 — is
// picked). Colors are shades of the same violet hue as --accent-ko (see
// App.vue's :root[data-lang="ko"] block) so a particle reads as
// unmistakably Korean at a glance, while staying distinguishable from a
// plain bolded Korean word and from every other particle type. Mirrors
// shared/genders.ts's Gender/getGender/formatWordByGender shape.
export interface Particle {
  id: string
  color: string | null
  style: string
}

const PARTICLES: Record<string, Particle> = {
  topic: { id: 'topic', color: '#b78cf5', style: '{word}' }, // 은/는
  subject: { id: 'subject', color: '#9d5ce0', style: '{word}' }, // 이/가
  object: { id: 'object', color: '#c9a3ff', style: '{word}' }, // 을/를
  addition: { id: 'addition', color: '#7a3fd1', style: '{word}' }, // 와/과, 랑/이랑
  not_apply: { id: 'not_apply', color: null, style: '{word}' },
}

const DEFAULT_PARTICLE = PARTICLES.not_apply

export function getParticle(particleTypeId?: string | null): Particle {
  return (particleTypeId && PARTICLES[particleTypeId]) || DEFAULT_PARTICLE
}

export function formatWordByParticle(word: string, particleTypeId?: string | null): string {
  return getParticle(particleTypeId).style.replace('{word}', word)
}
