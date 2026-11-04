// Renderizador Markdown mínimo e seguro para a base de conhecimento.
// Produz uma árvore de dados (nunca HTML): o React escapa todo texto e links só
// aceitam http, https e mailto. Suporta títulos (##, ###), listas, citações,
// blocos de código, **negrito**, `código` e [links](url).

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: string }
  | { t: 'code'; v: string }
  | { t: 'link'; v: string; href: string }

export type Block =
  | { t: 'heading'; level: 2 | 3; inline: Inline[] }
  | { t: 'paragraph'; inline: Inline[] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'ol'; items: Inline[][] }
  | { t: 'quote'; inline: Inline[] }
  | { t: 'code'; text: string }

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export function safeHref(href: string): string | null {
  try {
    const url = new URL(href)
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

const TOKEN = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  for (const part of text.split(TOKEN)) {
    if (!part) continue
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      out.push({ t: 'bold', v: part.slice(2, -2) })
    } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      out.push({ t: 'code', v: part.slice(1, -1) })
    } else {
      const link = LINK.exec(part)
      if (link) {
        const href = safeHref(link[2] ?? '')
        // Link com protocolo não permitido (ex.: javascript:) vira texto simples.
        out.push(href ? { t: 'link', v: link[1] ?? '', href } : { t: 'text', v: link[1] ?? '' })
      } else {
        out.push({ t: 'text', v: part })
      }
    }
  }
  return out
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let paragraph: string[] = []

  const flush = () => {
    if (paragraph.length) blocks.push({ t: 'paragraph', inline: parseInline(paragraph.join(' ')) })
    paragraph = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''

    if (line.trimStart().startsWith('```')) {
      flush()
      const code: string[] = []
      i++
      while (i < lines.length && !(lines[i] ?? '').trimStart().startsWith('```')) {
        code.push(lines[i] ?? '')
        i++
      }
      blocks.push({ t: 'code', text: code.join('\n') })
      continue
    }

    if (line.trim() === '') {
      flush()
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      flush()
      // O título da página já é h1: "#" e "##" viram h2; "###" vira h3.
      blocks.push({ t: 'heading', level: heading[1]!.length === 3 ? 3 : 2, inline: parseInline(heading[2]!.trim()) })
      continue
    }

    const ul = /^\s*[-*]\s+(.+)$/.exec(line)
    const ol = /^\s*\d+[.)]\s+(.+)$/.exec(line)
    if (ul || ol) {
      flush()
      const ordered = Boolean(ol)
      const pattern = ordered ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-*]\s+(.+)$/
      const items: Inline[][] = []
      while (i < lines.length) {
        const m = pattern.exec(lines[i] ?? '')
        if (!m) break
        items.push(parseInline(m[1]!.trim()))
        i++
      }
      i--
      blocks.push(ordered ? { t: 'ol', items } : { t: 'ul', items })
      continue
    }

    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) {
      flush()
      const parts: string[] = []
      while (i < lines.length) {
        const m = /^>\s?(.*)$/.exec(lines[i] ?? '')
        if (!m) break
        parts.push(m[1] ?? '')
        i++
      }
      i--
      blocks.push({ t: 'quote', inline: parseInline(parts.join(' ')) })
      continue
    }

    paragraph.push(line.trim())
  }
  flush()
  return blocks
}
