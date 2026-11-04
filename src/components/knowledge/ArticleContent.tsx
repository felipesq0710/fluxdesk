import { Fragment } from 'react'
import { parseMarkdown, type Inline } from '@/lib/markdown'

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case 'bold':
            return <strong key={i}>{n.v}</strong>
          case 'code':
            return (
              <code key={i} className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[0.85em]">
                {n.v}
              </code>
            )
          case 'link':
            return (
              <a key={i} href={n.href} target="_blank" rel="noopener noreferrer nofollow" className="text-brand underline underline-offset-2 dark:text-brand-300">
                {n.v}
              </a>
            )
          default:
            return <Fragment key={i}>{n.v}</Fragment>
        }
      })}
    </>
  )
}

// Conteúdo do artigo renderizado como elementos React (todo texto é escapado pelo React).
export function ArticleContent({ source }: { source: string }) {
  const blocks = parseMarkdown(source)
  return (
    <div className="space-y-4 text-sm leading-relaxed text-fg">
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'heading':
            return b.level === 2 ? (
              <h2 key={i} className="pt-2 text-lg font-semibold">
                <Inlines nodes={b.inline} />
              </h2>
            ) : (
              <h3 key={i} className="pt-1 text-base font-semibold">
                <Inlines nodes={b.inline} />
              </h3>
            )
          case 'ul':
            return (
              <ul key={i} className="list-disc space-y-1 pl-6">
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Inlines nodes={item} />
                  </li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} className="list-decimal space-y-1 pl-6">
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Inlines nodes={item} />
                  </li>
                ))}
              </ol>
            )
          case 'quote':
            return (
              <blockquote key={i} className="border-l-4 border-brand/40 pl-4 text-fg-muted">
                <Inlines nodes={b.inline} />
              </blockquote>
            )
          case 'code':
            return (
              <pre key={i} className="overflow-x-auto rounded-control bg-surface-muted p-3 font-mono text-xs">
                <code>{b.text}</code>
              </pre>
            )
          default:
            return (
              <p key={i}>
                <Inlines nodes={b.inline} />
              </p>
            )
        }
      })}
    </div>
  )
}
