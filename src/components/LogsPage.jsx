import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

const STATE_LABEL = {
  up: 'Operacional',
  down: 'Indisponível',
  unknown: 'A verificar…',
}

const DOT = {
  up: 'bg-emerald-500',
  down: 'bg-red-500',
  unknown: 'bg-amber-400',
}

function Dot({ state }) {
  return <span className={cn('h-3 w-3 flex-shrink-0 rounded-full', DOT[state] || DOT.unknown)} aria-hidden="true" />
}

function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-PT', {
      dateStyle: 'short',
      timeStyle: 'medium',
    })
  } catch {
    return iso
  }
}

/**
 * Página /logs — mostra o estado atual dos serviços e o registo de todos os
 * reinícios (arranque/paragem) do servidor, com o respetivo estado.
 */
export default function LogsPage() {
  const [health, setHealth] = useState(null)
  const [restarts, setRestarts] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [hRes, lRes] = await Promise.all([
        fetch('/health/full', { cache: 'no-store' }),
        fetch('/health/logs?limit=100', { cache: 'no-store' }),
      ])
      const hData = await hRes.json().catch(() => ({}))
      const lData = await lRes.json().catch(() => ({}))
      setHealth({ ...hData, serverState: hRes.ok ? 'up' : 'down' })
      setRestarts(Array.isArray(lData.restarts) ? lData.restarts : [])
      setError(null)
    } catch (err) {
      setError(err.message || 'Falha ao contactar o servidor.')
      setHealth({ serverState: 'down', db: 'down' })
    }
  }, [])

  // Handler do botão "Atualizar" (mostra o estado de carregamento).
  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchData()
    setLoading(false)
  }, [fetchData])

  useEffect(() => {
    let alive = true
    // Carga inicial + polling. Não chama setState de forma síncrona no efeito:
    // o estado só é atualizado depois do await dentro de fetchData.
    const tick = async () => {
      await fetchData()
      if (alive) setLoading(false)
    }
    tick()
    const id = setInterval(() => {
      if (alive) fetchData()
    }, 30000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [fetchData])

  const components = [
    { key: 'frontend', label: 'Frontend (React/Vite)', state: 'up' },
    { key: 'server', label: 'Servidor (Express)', state: health?.serverState ?? 'unknown' },
    { key: 'db', label: 'Base de dados (PostgreSQL)', state: health?.db ?? 'unknown' },
    { key: 'smtp', label: 'Email / SMTP', state: health?.smtp ?? 'unknown' },
  ]

  return (
    <div className="mx-auto max-w-[920px] px-5 pb-16 pt-8">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Estado da Agenda CCLX</h1>
        <a className="text-sm text-primary hover:underline" href="/">
          ← Voltar à agenda
        </a>
      </header>

      <section className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        {components.map((c) => (
          <div key={c.key} className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-[0.9rem]">
            <Dot state={c.state} />
            <div>
              <div className="text-sm font-semibold text-foreground">{c.label}</div>
              <div className="text-xs text-muted-foreground">{STATE_LABEL[c.state] || c.state}</div>
            </div>
          </div>
        ))}
      </section>

      {health && (
        <p className="mb-8 text-xs text-muted-foreground">
          Ambiente: <strong className="text-foreground">{health.nodeEnv || '—'}</strong> · Uptime:{' '}
          <strong className="text-foreground">{health.uptimeSeconds != null ? `${health.uptimeSeconds}s` : '—'}</strong> · Desde:{' '}
          <strong className="text-foreground">{formatDateTime(health.startedAt)}</strong>
          {health.dbError ? (
            <>
              {' '}
              · <span className="text-destructive">BD: {health.dbError}</span>
            </>
          ) : null}
          {health.smtpError ? (
            <>
              {' '}
              · <span className="text-destructive">SMTP: {health.smtpError}</span>
            </>
          ) : null}
        </p>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-foreground">Registo de reinícios</h2>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? 'A atualizar…' : 'Atualizar'}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Data/hora</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Ambiente</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>PID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {restarts.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    Sem registos ainda.
                  </TableCell>
                </TableRow>
              ) : (
                restarts.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDateTime(r.created_at)}</TableCell>
                    <TableCell>{r.event === 'stop' ? 'Paragem' : 'Arranque'}</TableCell>
                    <TableCell>
                      <span className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-[0.72rem] font-semibold',
                        r.status === 'ok'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : 'bg-red-500/15 text-red-700 dark:text-red-400',
                      )}>
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell>{r.node_env || '—'}</TableCell>
                    <TableCell>{r.version || '—'}</TableCell>
                    <TableCell>{r.pid ?? '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
