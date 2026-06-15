import { useMemo } from 'react'
import { compareChurches } from '../utils/churches'
import styles from './CommunityFilter.module.css'

export default function CommunityFilter({ events, value, onChange }) {
  const communities = useMemo(() => {
    const set = new Set(events.map(e => e.community).filter(Boolean))
    return ['Todas', ...Array.from(set).sort(compareChurches)]
  }, [events])

  return (
    <div className={styles.wrapper}>
      <i className="ti ti-building-church" aria-hidden="true" />
      <select
        className={styles.select}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Filtrar por igreja"
      >
        {communities.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  )
}
