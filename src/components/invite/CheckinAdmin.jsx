import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { QrCode, Camera, CameraOff, Search, Check, CheckCircle2, Loader2, ExternalLink, Ticket, User } from 'lucide-react'
import * as invitesService from '../../services/invitesService'
import { validatePayment } from '../../services/invitesService'

const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60'
const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60'

const PAY_LABEL = {
  pending: 'Pendente',
  awaiting_validation: 'Em validação',
  paid: 'Pago',
  failed: 'Rejeitado',
  not_applicable: '—',
}

function fmtDT(v) {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Check-in (validação à entrada): lê o QR/código do bilhete, mostra os dados da
// inscrição, permite validar o pagamento e aceitar a entrada.
export default function CheckinAdmin({ invite }) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef(null)

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
      const r = await invitesService.checkinLookup(invite.id, code)
      setResult(r)
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
      const scanner = new Html5Qrcode('checkin-qr-reader')
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
      const guest = await invitesService.acceptCheckin(invite.id, result.guest.id, true)
      setResult((r) => (r ? { ...r, guest: { ...r.guest, checkedInAt: guest.checkedInAt } } : r))
      toast.success('Check-in aceite.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const validate = async () => {
    if (!result?.payment) return
    setBusy(true)
    try {
      await validatePayment(result.payment.id)
      toast.success('Pagamento validado.')
      await lookup(result.guest.code || input)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const g = result?.guest
  const paymentOpen = result?.payment && result.payment.status !== 'paid'

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="m-0 mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <QrCode className="h-4 w-4" aria-hidden="true" /> Check-in
        </h3>
        <p className="m-0 text-xs text-muted-foreground">
          Lê o QR do bilhete (câmara) ou escreve/cola o código ou o link da inscrição.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          lookup()
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          className={inputCls}
          placeholder="Código do bilhete (ex.: A7K2-9QMX) ou link"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
            Procurar
          </button>
          {scanning ? (
            <button type="button" onClick={stopScan} className={ghostBtn}>
              <CameraOff className="h-4 w-4" aria-hidden="true" /> Parar
            </button>
          ) : (
            <button type="button" onClick={startScan} className={ghostBtn}>
              <Camera className="h-4 w-4" aria-hidden="true" /> Câmara
            </button>
          )}
        </div>
      </form>

      <div
        id="checkin-qr-reader"
        className={scanning ? 'mx-auto w-full max-w-xs overflow-hidden rounded-xl border border-border' : 'hidden'}
      />

      {g ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 flex items-center gap-1.5 text-lg font-bold text-foreground">
                <User className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> {g.name || '—'}
              </p>
              <p className="m-0 text-xs text-muted-foreground">
                Código: <span className="font-mono font-semibold text-foreground">{g.code || '—'}</span>
                {g.guestsCount > 1 ? ` · ${g.guestsCount} pessoas` : ''}
              </p>
            </div>
            {g.checkedInAt ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Check-in feito
              </span>
            ) : null}
          </div>

          {result.ticket ? (
            <p className="m-0 flex items-center gap-1.5 text-sm text-foreground">
              <Ticket className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> {result.ticket.name}
            </p>
          ) : null}

          {result.payment || g.paymentState !== 'not_applicable' ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-2 text-sm">
              <span className="font-semibold text-foreground">Pagamento:</span>
              <span className="text-muted-foreground">{PAY_LABEL[g.paymentState] || g.paymentState}</span>
              {result.payment?.receiptUrl ? (
                <a
                  href={result.payment.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Comprovativo
                </a>
              ) : null}
              {paymentOpen ? (
                <button type="button" onClick={validate} disabled={busy} className={ghostBtn + ' ml-auto'}>
                  <Check className="h-4 w-4" aria-hidden="true" /> Validar pagamento
                </button>
              ) : null}
            </div>
          ) : null}

          {Array.isArray(result.data) && result.data.length ? (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
              {result.data.map((d, i) => (
                <div key={i} className="flex flex-col">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{d.label}</dt>
                  <dd className="m-0 text-foreground">{d.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">
              {g.checkedInAt ? `Check-in às ${fmtDT(g.checkedInAt)}` : 'Ainda sem check-in'}
            </span>
            <button type="button" onClick={accept} disabled={busy || !!g.checkedInAt} className={primaryBtn}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
              {g.checkedInAt ? 'Check-in feito' : 'Aceitar check-in'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
