import { useState, useRef, useEffect } from 'react'
import { Toaster, toast } from 'sonner'
import {
  Loader2,
  QrCode,
  Camera,
  CameraOff,
  Search,
  UserCheck,
  CheckCircle2,
  Ticket,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
} from 'lucide-react'
import * as invitesService from '../../services/invitesService'

// Página pública /invite/<slug>/checkin?k=<token> — check-in MÓVEL simplificado.
// O staff abre o link (secreto, por convite) no telemóvel, lê o QR do bilhete (ou
// escreve o código) e aceita a entrada. Autenticado pelo token do link, sem login.
const ACCENT = '#1F3864'

const PAY_LABEL = {
  pending: 'Pagamento pendente',
  awaiting_validation: 'Comprovativo em validação',
  paid: 'Pago',
  failed: 'Pagamento rejeitado',
  refund_requested: 'Reembolso pedido',
  refunded: 'Reembolsado',
  not_applicable: '',
}
const PAY_TONE = {
  paid: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  awaiting_validation: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
  refund_requested: 'bg-amber-100 text-amber-800',
  refunded: 'bg-muted text-muted-foreground',
}
const RSVP_CANCELLED = new Set(['cancelled', 'declined'])

function fmtTime(v) {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' })
}
function fmtDate(v) {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Lisbon' })
}

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-opacity disabled:opacity-60'
const navyBtn = `${btnBase} h-14 w-full px-4 text-base text-white hover:opacity-90`
const greenBtn = `${btnBase} h-16 w-full px-4 text-lg bg-emerald-600 text-white hover:bg-emerald-700`
const ghostBtn = `${btnBase} h-12 w-full border border-border bg-background px-4 text-sm text-foreground hover:bg-accent`
const inputCls =
  'w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none focus:border-ring'

export default function InviteCheckin({ slug, token }) {
  const [ctx, setCtx] = useState(null)
  // Sem token, o estado inicial já reflete o erro (evita setState síncrono no efeito).
  const [loadingCtx, setLoadingCtx] = useState(() => !!token)
  const [ctxErr, setCtxErr] = useState(() =>
    token ? null : 'Link de check-in inválido: falta o código de acesso.'
  )
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [justDone, setJustDone] = useState(false)
  const scannerRef = useRef(null)

  // Carrega o cabeçalho (valida o token) ao abrir.
  useEffect(() => {
    if (!token) return undefined
    let alive = true
    invitesService
      .publicCheckinContext(slug, token)
      .then((c) => {
        if (alive) {
          setCtx(c)
          setLoadingCtx(false)
        }
      })
      .catch((err) => {
        if (alive) {
          setCtxErr(err.message)
          setLoadingCtx(false)
        }
      })
    return () => {
      alive = false
    }
  }, [slug, token])

  const stopScan = async () => {
    const s = scannerRef.current
    scannerRef.current = null
    setScanning(false)
    if (s) {
      try {
        await s.stop()
        s.clear()
      } catch {
        /* já parado */
      }
    }
  }

  useEffect(
    () => () => {
      stopScan()
    },
    []
  )

  const lookup = async (value) => {
    const code = String(value ?? input).trim()
    if (!code) return
    setBusy(true)
    try {
      const r = await invitesService.publicCheckinLookup(slug, token, code)
      setResult(r)
      setJustDone(false)
    } catch (err) {
      toast.error(err.message)
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  const startScan = async () => {
    try {
      setScanning(true)
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('checkin-mobile-qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 240 },
        (decoded) => {
          stopScan()
          setInput(decoded)
          lookup(decoded)
        },
        () => {}
      )
    } catch {
      setScanning(false)
      toast.error('Não foi possível abrir a câmara. Usa a introdução manual.')
    }
  }

  const accept = async () => {
    if (!result?.guest) return
    setBusy(true)
    try {
      const guest = await invitesService.publicAcceptCheckin(slug, token, result.guest.id, true)
      setResult((r) => (r ? { ...r, guest: { ...r.guest, checkedInAt: guest.checkedInAt } } : r))
      setJustDone(true)
      toast.success('Check-in aceite.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setResult(null)
    setInput('')
    setJustDone(false)
  }

  if (loadingCtx) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
      </div>
    )
  }

  if (ctxErr) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <AlertTriangle className="h-12 w-12 text-amber-500" aria-hidden="true" />
          <h1 className="m-0 text-lg font-bold text-foreground">Não foi possível abrir o check-in</h1>
          <p className="m-0 text-sm text-muted-foreground">{ctxErr}</p>
          <p className="m-0 text-xs text-muted-foreground">Pede um link de check-in atualizado ao organizador.</p>
        </div>
      </div>
    )
  }

  const g = result?.guest
  const cancelled = g && RSVP_CANCELLED.has(g.rsvpState)

  return (
    <div className="min-h-screen bg-background pb-10 text-foreground">
      <Toaster position="top-center" richColors />

      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md flex-col gap-0.5 px-4 py-3">
          <p className="m-0 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: ACCENT }}>
            <QrCode className="h-4 w-4" aria-hidden="true" /> Check-in
          </p>
          <h1 className="m-0 truncate text-lg font-bold leading-tight text-foreground">{ctx?.title || 'Convite'}</h1>
          {ctx?.startDatetime || ctx?.location ? (
            <p className="m-0 truncate text-xs text-muted-foreground">
              {[fmtDate(ctx.startDatetime), ctx.location].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-5">
        {justDone && g ? (
          // Sucesso — grande e claro para a entrada.
          <section className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <CheckCircle2 className="h-20 w-20 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="m-0 text-xl font-bold text-emerald-900 dark:text-emerald-300">Check-in feito!</p>
              <p className="m-0 mt-1 text-lg font-semibold text-foreground">{g.name || '—'}</p>
              {result?.ticket ? <p className="m-0 text-sm text-muted-foreground">{result.ticket.name}</p> : null}
              {g.guestsCount > 1 ? <p className="m-0 text-sm text-muted-foreground">{g.guestsCount} pessoas</p> : null}
            </div>
            <button type="button" onClick={reset} className={navyBtn} style={{ backgroundColor: ACCENT }}>
              <QrCode className="h-5 w-5" aria-hidden="true" /> Ler outro bilhete
            </button>
          </section>
        ) : g ? (
          // Bilhete encontrado — dados + aceitar entrada.
          <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-2xl font-bold leading-tight text-foreground">{g.name || '—'}</p>
                <p className="m-0 mt-1 text-sm text-muted-foreground">
                  Código <span className="font-mono font-semibold text-foreground">{g.code || '—'}</span>
                  {g.guestsCount > 1 ? ` · ${g.guestsCount} pessoas` : ''}
                </p>
              </div>
              {g.checkedInAt ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Já entrou
                </span>
              ) : null}
            </div>

            {cancelled ? (
              <p className="m-0 flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-800 dark:bg-red-500/15 dark:text-red-300">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Esta inscrição foi cancelada.
              </p>
            ) : null}

            {result.ticket ? (
              <p className="m-0 flex items-center gap-2 text-base text-foreground">
                <Ticket className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> {result.ticket.name}
              </p>
            ) : null}

            {g.paymentState && g.paymentState !== 'not_applicable' ? (
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                    PAY_TONE[g.paymentState] || 'bg-muted text-muted-foreground'
                  }`}
                >
                  {PAY_LABEL[g.paymentState] || g.paymentState}
                </span>
                {result.payment?.receiptUrl ? (
                  <a
                    href={result.payment.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                    style={{ color: ACCENT }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Comprovativo
                  </a>
                ) : null}
              </div>
            ) : null}

            {Array.isArray(result.data) && result.data.length ? (
              <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-xl bg-muted/40 p-3 text-sm">
                {result.data.map((d, i) => (
                  <div key={i} className="flex flex-col">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d.label}</dt>
                    <dd className="m-0 text-foreground">{d.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              {g.checkedInAt ? (
                <>
                  <p className="m-0 text-center text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    Check-in feito às {fmtTime(g.checkedInAt)}
                  </p>
                  <button type="button" onClick={reset} className={ghostBtn}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" /> Ler outro bilhete
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={accept} disabled={busy} className={greenBtn}>
                    {busy ? (
                      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                    ) : (
                      <UserCheck className="h-6 w-6" aria-hidden="true" />
                    )}
                    Aceitar check-in
                  </button>
                  <button type="button" onClick={reset} className="py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </section>
        ) : (
          // Início — ler QR ou escrever o código.
          <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div
              id="checkin-mobile-qr-reader"
              className={scanning ? 'mx-auto w-full overflow-hidden rounded-xl border border-border' : 'hidden'}
            />
            {scanning ? (
              <button type="button" onClick={stopScan} className={ghostBtn}>
                <CameraOff className="h-5 w-5" aria-hidden="true" /> Parar câmara
              </button>
            ) : (
              <button type="button" onClick={startScan} className={navyBtn} style={{ backgroundColor: ACCENT }}>
                <Camera className="h-5 w-5" aria-hidden="true" /> Ler QR do bilhete
              </button>
            )}

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> ou escreve o código <span className="h-px flex-1 bg-border" />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                lookup()
              }}
              className="flex flex-col gap-2"
            >
              <input
                className={inputCls}
                placeholder="Código do bilhete (ex.: A7K2-9QMX)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                inputMode="text"
              />
              <button type="submit" disabled={busy} className={navyBtn} style={{ backgroundColor: ACCENT }}>
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Search className="h-5 w-5" aria-hidden="true" />
                )}
                Procurar
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  )
}
