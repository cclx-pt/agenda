import { useEffect, useState } from 'react'
import logoUrl from '../assets/cclx_line_logo.png'

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name)
}

function formatWhen(date, time) {
  const parts = []
  if (date) {
    const [y, m, d] = String(date).split('-')
    if (y && m && d) parts.push(`${d}/${m}/${y}`)
  }
  if (time) parts.push(time)
  return parts.join(' às ')
}

/**
 * ApprovalActionPage — página pública (/acao?t=TOKEN) para aprovar ou rejeitar
 * um evento a partir do link do email. O token no URL autentica a ação; esta
 * página mostra o evento e só executa a ação após confirmação (evita ações
 * acidentais / prefetch dos clientes de email).
 */
export default function ApprovalActionPage() {
  const token = getParam('t')
  const preset = getParam('a') // 'aprovar' | 'rejeitar' | null
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState(token ? null : 'Ligação inválida.')
  const [event, setEvent] = useState(null)
  const [pending, setPending] = useState(false)
  const [mode, setMode] = useState(preset === 'rejeitar' ? 'reject' : preset === 'aprovar' ? 'approve' : null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null) // { action } | null
  const [actionError, setActionError] = useState(null)

  useEffect(() => {
    if (!token) return
    fetch(`/data/approval-action?t=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(data.error || 'Ligação inválida ou expirada.')
        setEvent(data.event)
        setPending(!!data.pending)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  const submit = async (action) => {
    if (action === 'reject' && !reason.trim()) {
      setActionError('Indique o motivo da rejeição.')
      return
    }
    setSubmitting(true)
    setActionError(null)
    try {
      const r = await fetch('/data/approval-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, action, reason: action === 'reject' ? reason.trim() : undefined }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || 'Não foi possível concluir a ação.')
      setResult({ action })
    } catch (e) {
      setActionError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl">
        <img src={logoUrl} alt="CCLX" className="mx-auto h-8 w-auto object-contain" />
        <h1 className="mt-4 text-center text-lg font-bold text-slate-800">Aprovação de evento</h1>

        {loading && <p className="mt-6 text-center text-sm text-slate-500">A carregar…</p>}

        {!loading && error && (
          <div className="mt-6 rounded-lg bg-red-50 p-4 text-center text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && event && (
          <>
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-base font-bold text-slate-900">{event.title}</p>
              {formatWhen(event.date, event.timeStart) && (
                <p className="mt-1 text-sm text-slate-600">{formatWhen(event.date, event.timeStart)}</p>
              )}
              {event.community && <p className="mt-0.5 text-sm text-slate-600">Comunidade: {event.community}</p>}
              {event.description && <p className="mt-2 text-sm text-slate-500">{event.description}</p>}
            </div>

            {result ? (
              <div className="mt-6 rounded-lg bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-700">
                {result.action === 'approve' ? 'Evento aprovado e publicado. Obrigado!' : 'Evento rejeitado. Obrigado!'}
              </div>
            ) : !pending ? (
              <div className="mt-6 rounded-lg bg-amber-50 p-4 text-center text-sm font-semibold text-amber-700">
                Este evento já não está pendente — pode já ter sido decidido por outra pessoa.
              </div>
            ) : (
              <div className="mt-6">
                {actionError && (
                  <p className="mb-3 rounded-md bg-red-50 p-2 text-center text-sm font-semibold text-red-700">
                    {actionError}
                  </p>
                )}

                {mode === 'reject' ? (
                  <div className="flex flex-col gap-3">
                    <textarea
                      className="w-full resize-none rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-slate-500"
                      rows={3}
                      placeholder="Motivo da rejeição (obrigatório)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        onClick={() => { setMode(null); setActionError(null) }}
                        disabled={submitting}
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                        onClick={() => submit('reject')}
                        disabled={submitting}
                      >
                        {submitting ? 'A rejeitar…' : 'Confirmar rejeição'}
                      </button>
                    </div>
                  </div>
                ) : mode === 'approve' ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      onClick={() => { setMode(null); setActionError(null) }}
                      disabled={submitting}
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      onClick={() => submit('approve')}
                      disabled={submitting}
                    >
                      {submitting ? 'A aprovar…' : 'Confirmar aprovação'}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
                      onClick={() => setMode('reject')}
                    >
                      Rejeitar
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
                      onClick={() => setMode('approve')}
                    >
                      Aprovar
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">Agenda CCLX</p>
      </div>
    </div>
  )
}
