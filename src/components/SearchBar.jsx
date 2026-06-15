import { useState, useMemo, useRef, useEffect } from 'react'
import Fuse from 'fuse.js'
import { CATEGORY_META, formatDateLabel } from '../utils/calendarHelpers'
import styles from './SearchBar.module.css'

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
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.inputWrap}>
        <i className="ti ti-search" aria-hidden="true" />
        <input
          className={styles.input}
          type="text"
          placeholder="Pesquisar eventos…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          aria-label="Pesquisar eventos"
        />
        {query && (
          <button className={styles.clearBtn} onClick={() => { setQuery(''); setOpen(false) }}
            aria-label="Limpar pesquisa">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className={styles.dropdown} role="listbox">
          {results.map(evt => {
            const cat = CATEGORY_META[evt.category] || CATEGORY_META.evento
            return (
              <div key={evt.id} className={styles.item} role="option"
                onClick={() => handleSelect(evt)} tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && handleSelect(evt)}>
                <span className={styles.dot} style={{ background: cat.colorVar }} />
                <div className={styles.itemBody}>
                  <div className={styles.itemTitle}>{evt.title}</div>
                  <div className={styles.itemMeta}>
                    {formatDateLabel(evt.date)} · {evt.timeStart}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {open && debouncedQuery.length >= 2 && results.length === 0 && (
        <div className={styles.dropdown}>
          <div className={styles.noResults}>
            <i className="ti ti-search-off" aria-hidden="true" />
            Sem resultados
          </div>
        </div>
      )}
    </div>
  )
}
