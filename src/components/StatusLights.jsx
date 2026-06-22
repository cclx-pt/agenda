import { useEffect, useState } from 'react'
import styles from './StatusLights.module.css'

const POLL_MS = 30000

const STATE_LABEL = {
  up: 'operacional',
  down: 'indisponível',
  unknown: 'a verificar',
}

/**
 * Sinais de estado (lights) dos serviços que têm de estar a funcionar:
 * Frontend (esta app), Servidor (Express) e Base de dados (PostgreSQL).
 * Consulta /health/full periodicamente. Liga à página /logs.
 */
export default function StatusLights() {
  const [server, setServer] = useState('unknown')
  const [db, setDb] = useState('unknown')

  useEffect(() => {
    let alive = true
    const check = async () => {
      try {
        const res = await fetch('/health/full', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!alive) return
        setServer(res.ok ? 'up' : 'down')
        setDb(data.db === 'up' ? 'up' : 'down')
      } catch {
        if (!alive) return
        setServer('down')
        setDb('down')
      }
    }
    check()
    const id = setInterval(check, POLL_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const items = [
    { key: 'frontend', label: 'Frontend', state: 'up' },
    { key: 'server', label: 'Servidor', state: server },
    { key: 'db', label: 'Base de dados', state: db },
  ]

  return (
    <a
      className={styles.lights}
      href="/logs"
      title="Estado dos serviços — ver registo de reinícios"
    >
      {items.map((it) => (
        <span key={it.key} className={styles.item}>
          <span className={`${styles.dot} ${styles[it.state]}`} aria-hidden="true" />
          <span className={styles.label}>{it.label}</span>
          <span className={styles.srOnly}>
            {it.label}: {STATE_LABEL[it.state]}
          </span>
        </span>
      ))}
    </a>
  )
}
