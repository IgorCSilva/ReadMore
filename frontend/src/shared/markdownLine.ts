// Learning-theme content (backend/content/learning/theme/...) stores each
// source Markdown line verbatim as one `sentences` array entry — see
// JsonLearningContentRepository's module docstring. This turns one such
// line into what LearningTopicPage.vue actually needs: formatted HTML to
// display (headings sized, bullets, **bold**, markers stripped) and plain
// text to read aloud (no literal "#"/"-"/"**"/"|" characters spoken out).
// Deliberately line-at-a-time, not a full Markdown parser — the source
// content only ever uses headings, bullet lines, and bold inline, so a
// multi-line block parser (e.g. real tables) would be solving a problem
// this content doesn't have.
export type LineKind = 'h1' | 'h2' | 'h3' | 'li' | 'p' | 'blank'

export interface ParsedLine {
  kind: LineKind
  html: string
  plainText: string
}

const BLANK_LINE = { kind: 'blank' as const, html: '', plainText: '' }

// A Markdown table's separator row ("|---|---|", "| :-- | --: |") carries
// no readable content — same treatment as a blank line (hidden, skipped by
// playback) rather than rendering literal dashes and pipes.
const TABLE_SEPARATOR_RE = /^\|?[\s:-]+\|[\s:|-]*\|?$/

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Applied last, after any heading/list/table marker has already been
// stripped — **bold** survives in both the HTML (as <strong>) and the
// plain-text spoken version (as the bare inner text).
function stripBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1')
}

function boldToHtml(escapedText: string): string {
  return escapedText.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

export function parseMarkdownLine(raw: string): ParsedLine {
  const trimmed = raw.trim()
  if (trimmed === '' || (trimmed.includes('-') && TABLE_SEPARATOR_RE.test(trimmed))) {
    return BLANK_LINE
  }

  const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed)
  if (heading) {
    const kind: LineKind = heading[1].length === 1 ? 'h1' : heading[1].length === 2 ? 'h2' : 'h3'
    const text = heading[2]
    return { kind, html: boldToHtml(escapeHtml(text)), plainText: stripBold(text) }
  }

  const bullet = /^-\s+(.*)$/.exec(trimmed)
  if (bullet) {
    const text = bullet[1]
    return { kind: 'li', html: `• ${boldToHtml(escapeHtml(text))}`, plainText: stripBold(text) }
  }

  // A Markdown table data row ("| cell | cell |") — no real <table> (this
  // content never needs more than one row's worth of context), just
  // readable cells instead of literal pipes.
  if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
    const cells = trimmed
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim())
    const text = cells.join(' — ')
    return { kind: 'p', html: boldToHtml(escapeHtml(text)), plainText: stripBold(text) }
  }

  return { kind: 'p', html: boldToHtml(escapeHtml(trimmed)), plainText: stripBold(trimmed) }
}
