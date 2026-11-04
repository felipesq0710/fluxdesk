import { useEffect, useState } from 'react'

// Retorna se a media query casa. Sem suporte (ex.: testes), assume o layout desktop.
export function useMediaQuery(query: string, fallback = true): boolean {
  const get = () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : fallback)
  const [matches, setMatches] = useState(get)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
