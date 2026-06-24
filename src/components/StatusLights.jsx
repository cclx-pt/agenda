import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

const POLL_MS = 30000

const DOT = {
  up: 'bg-emerald-500 shadow-[0_0_6px_rgba(46,204,113,0.7)]',
  down: 'bg-red-500 shadow-[0_0_6px_rgba(231,76,60,0.7)]',
  unknown: 'bg-yellow-400 shadow-[0_0_6px_rgba(241,196,15,0.6)] animate-pulse',
}

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
  const [smtp, setSmtp] = useState('unknown')

  useEffect(() => {
    let alive = true
    const check = async () => {
      try {
        const res = await fetch('/health/full', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!alive) return
        setServer(res.ok ? 'up' : 'down')
        setDb(data.db === 'up' ? 'up' : 'down')
        setSmtp(data.smtp === 'up' ? 'up' : data.smtp === 'down' ? 'down' : 'unknown')
      } catch {
        if (!alive) return
        setServer('down')
        setDb('down')
        setSmtp('down')
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
    { key: 'smtp', label: 'Email (SMTP)', state: smtp },
  ]

  return (
    <a
      className="group fixed bottom-2.5 left-2.5 z-50 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2 py-1 opacity-70 shadow-md backdrop-blur transition-opacity hover:opacity-100 focus-visible:opacity-100"
      href="/logs"
      title="Estado dos serviços — ver registo de reinícios"
    >
      {items.map((it) => (
        <span
          key={it.key}
          className="relative inline-flex items-center gap-1.5 whitespace-nowrap text-[0.66rem]"
        >
          <span
            className={cn('h-2 w-2 flex-none rounded-full', DOT[it.state])}
            aria-hidden="true"
          />
          <span className="hidden text-muted-foreground group-hover:inline group-focus-visible:inline">
            {it.label}
          </span>
          <span className="sr-only">
            {it.label}: {STATE_LABEL[it.state]}
          </span>
        </span>
      ))}
    </a>
  )
}
