import { useState, useMemo, useRef, useEffect } from 'react'
import Fuse from 'fuse.js'
import { Search, SearchX, X } from 'lucide-react'

import { CATEGORY_META, formatDateLabel } from '../utils/calendarHelpers'

const FUSE_OPTIONS = {
  keys: ['title', 'description', 'location', 'category'],
  threshold: 0.35,
  minMatchCharLength: 2,
}

export default function SearchBar({ events, onSelect }) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  // debounce the query before running the fuzzy search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 150)
    return () => clearTimeout(id)
  }, [query])

  const fuse = useMemo(() => new Fuse(events, FUSE_OPTIONS), [events])
  const results = useMemo(() => {
    if (debouncedQuery.length < 2) return []
    return fuse.search(debouncedQuery, { limit: 8 }).map(r => r.item)
  }, [fuse, debouncedQuery])

  // close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (evt) => {
    setQuery('')
    setOpen(false)
    onSelect(evt)
  }

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 transition-colors focus-within:ring-1 focus-within:ring-ring">
        <Search className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <input
          className="w-40 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground max-[600px]:w-24"
          type="text"
          placeholder="Pesquisar eventos…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          aria-label="Pesquisar eventos"
        />
        {query && (
          <button
            type="button"
            className="flex items-center p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => { setQuery(''); setOpen(false) }}
            aria-label="Limpar pesquisa"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-[100] max-h-[360px] w-[340px] overflow-y-auto rounded-md border bg-popover p-1.5 text-popover-foreground shadow-md max-[600px]:w-[280px]"
          role="listbox"
        >
          {results.map(evt => {
            const cat = CATEGORY_META[evt.category] || CATEGORY_META.evento
            return (
              <div
                key={evt.id}
                className="flex cursor-pointer items-start gap-2.5 rounded px-2.5 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
                role="option"
                onClick={() => handleSelect(evt)}
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && handleSelect(evt)}
              >
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: cat.colorVar }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{evt.title}</div>
                  <div className="mt-px text-[11px] text-muted-foreground">
                    {formatDateLabel(evt.date)} · {evt.timeStart}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {open && debouncedQuery.length >= 2 && results.length === 0 && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-[100] w-[340px] rounded-md border bg-popover p-1.5 text-popover-foreground shadow-md max-[600px]:w-[280px]">
          <div className="flex items-center justify-center gap-2 p-4 text-xs text-muted-foreground">
            <SearchX className="h-4 w-4" aria-hidden="true" />
            Sem resultados
          </div>
        </div>
      )}
    </div>
  )
}
