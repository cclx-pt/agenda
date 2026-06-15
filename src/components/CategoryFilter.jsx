import { useMemo } from 'react'
import { CATEGORY_META } from '../utils/calendarHelpers'
import styles from './CommunityFilter.module.css'

export default function CategoryFilter({ events, value, onChange }) {
  const categories = useMemo(() => {
    const present = new Set(events.map(e => e.category))
    const ordered = Object.keys(CATEGORY_META).filter(c => present.has(c))
    return ['Todos', ...ordered]
  }, [events])

  return (
    <div className={styles.wrapper}>
      <i className="ti ti-tag" aria-hidden="true" />
      <select
        className={styles.select}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Filtrar por tipo de evento"
      >
        {categories.map(c => (
          <option key={c} value={c}>
            {c === 'Todos' ? 'Todos' : CATEGORY_META[c].label}
          </option>
        ))}
      </select>
    </div>
  )
}
