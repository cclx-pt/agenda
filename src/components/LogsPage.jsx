import { useCallback, useEffect, useState } from 'react'
import styles from './LogsPage.module.css'

const STATE_LABEL = {
  up: 'Operacional',
  down: 'Indisponível',
  unknown: 'A verificar…',
}

function Dot({ state }) {
  return <span className={`${styles.dot} ${styles[state] || styles.unknown}`} aria-hidden="true" />
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
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Estado da Agenda CCLX</h1>
        <a className={styles.back} href="/">
          ← Voltar à agenda
        </a>
      </header>

      <section className={styles.cards}>
        {components.map((c) => (
          <div key={c.key} className={styles.card}>
            <Dot state={c.state} />
            <div>
              <div className={styles.cardLabel}>{c.label}</div>
              <div className={styles.cardState}>{STATE_LABEL[c.state] || c.state}</div>
            </div>
          </div>
        ))}
      </section>

      {health && (
        <p className={styles.meta}>
          Ambiente: <strong>{health.nodeEnv || '—'}</strong> · Uptime:{' '}
          <strong>{health.uptimeSeconds != null ? `${health.uptimeSeconds}s` : '—'}</strong> · Desde:{' '}
          <strong>{formatDateTime(health.startedAt)}</strong>
          {health.dbError ? (
            <>
              {' '}
              · <span className={styles.err}>BD: {health.dbError}</span>
            </>
          ) : null}
          {health.smtpError ? (
            <>
              {' '}
              · <span className={styles.err}>SMTP: {health.smtpError}</span>
            </>
          ) : null}
        </p>
      )}

      <section>
        <div className={styles.logsHead}>
          <h2 className={styles.subtitle}>Registo de reinícios</h2>
          <button className={styles.refresh} onClick={refresh} disabled={loading}>
            {loading ? 'A atualizar…' : 'Atualizar'}
          </button>
        </div>

        {error && <p className={styles.err}>{error}</p>}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data/hora</th>
                <th>Evento</th>
                <th>Estado</th>
                <th>Ambiente</th>
                <th>Versão</th>
                <th>PID</th>
              </tr>
            </thead>
            <tbody>
              {restarts.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    Sem registos ainda.
                  </td>
                </tr>
              ) : (
                restarts.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.created_at)}</td>
                    <td>{r.event === 'stop' ? 'Paragem' : 'Arranque'}</td>
                    <td>
                      <span className={`${styles.badge} ${r.status === 'ok' ? styles.ok : styles.bad}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>{r.node_env || '—'}</td>
                    <td>{r.version || '—'}</td>
                    <td>{r.pid ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
