import { useState } from 'react'
import { Toaster, toast } from 'sonner'
import { Loader2, ArrowLeft, Ticket, CalendarClock, MapPin, XCircle, RotateCcw, ShieldCheck } from 'lucide-react'
import * as invitesService from '../../services/invitesService'

// Página pública /invite/<slug>/gerir — o convidado entra com o código de reserva
// + senha (recebidos ao inscrever-se) para cancelar ou pedir reembolso.
const ACCENT = '#1F3864'

const RSVP_LABEL = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  waitlisted: 'Lista de espera',
  declined: 'Cancelada',
  cancelled: 'Cancelada',
}
const PAY_LABEL = {
  not_applicable: '',
  pending: 'Pagamento pendente',
  awaiting_validation: 'Comprovativo em validação',
  paid: 'Pago',
  expired: 'Expirado',
  refund_requested: 'Reembolso pedido',
  refunded: 'Reembolsado',
}

function fmtWhen(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Lisbon',
  })
}

function ticketValue(t) {
  if (!t) return ''
  if (t.kind === 'gratis') return 'Grátis'
  if (t.kind === 'voluntaria') return 'Doação'
  if (t.price != null && Number(t.price) > 0) return `${Number(t.price).toFixed(2)} ${t.currency || 'EUR'}`
  return 'Grátis'
}

export default function InviteManage({ slug }) {
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('code') || '')
  const [password, setPassword] = useState('')
  const [manage, setManage] = useState(null)
  const [busy, setBusy] = useState(false)

  const inputCls =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring'

  const login = async (e) => {
    e.preventDefault()
    if (!code.trim() || !password.trim()) {
      toast.error('Indica o código de reserva e a senha.')
      return
    }
    setBusy(true)
    try {
      setManage(await invitesService.inviteManageLogin(slug, code.trim(), password))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const doCancel = async () => {
    if (!window.confirm('Queres mesmo cancelar a tua inscrição? Esta ação liberta o teu lugar.')) return
    setBusy(true)
    try {
      setManage(await invitesService.inviteManageCancel(slug, code.trim(), password))
      toast.success('Inscrição cancelada.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const doRefund = async () => {
    if (!window.confirm('Pedir reembolso cancela a tua inscrição. Queres continuar?')) return
    setBusy(true)
    try {
      setManage(await invitesService.inviteManageRefund(slug, code.trim(), password))
      toast.success('Pedido de reembolso enviado.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const cancelled = manage && (manage.rsvpState === 'cancelled' || manage.rsvpState === 'declined')

  return (
    <div className="min-h-screen bg-background pb-10" style={{ '--invite-accent': ACCENT }}>
      <Toaster position="top-center" richColors />
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-6">
        <a
          href={`/invite/${encodeURIComponent(slug)}`}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold hover:underline"
          style={{ color: ACCENT }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar ao convite
        </a>

        {!manage ? (
          <form onSubmit={login} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" style={{ color: ACCENT }} aria-hidden="true" />
              <h1 className="m-0 text-xl font-bold text-foreground">Gerir a minha inscrição</h1>
            </div>
            <p className="m-0 text-sm text-muted-foreground">
              Introduz o código de reserva e a senha que recebeste ao inscreveres-te.
            </p>
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
              Código de reserva
              <input
                className={inputCls}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="XXXX-XXXX"
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
              Senha
              <input
                type="password"
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: ACCENT }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Entrar
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h1 className="m-0 mb-1 text-xl font-bold text-foreground">{manage.eventTitle}</h1>
              {manage.when ? (
                <p className="m-0 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarClock className="h-4 w-4" aria-hidden="true" />
                  {fmtWhen(manage.when)}
                </p>
              ) : null}
              {manage.location ? (
                <p className="m-0 mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {manage.location}
                </p>
              ) : null}

              <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</span>
                  <span className="text-sm font-bold text-foreground">{RSVP_LABEL[manage.rsvpState] || manage.rsvpState}</span>
                </div>
                {manage.ticket ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bilhete</span>
                    <span className="text-sm font-medium text-foreground">
                      {manage.ticket.name} · {ticketValue(manage.ticket)}
                    </span>
                  </div>
                ) : null}
                {PAY_LABEL[manage.paymentState] ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagamento</span>
                    <span className="text-sm font-medium text-foreground">{PAY_LABEL[manage.paymentState]}</span>
                  </div>
                ) : null}
                {manage.code ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Código</span>
                    <span className="font-mono text-sm font-bold text-foreground">{manage.code}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="m-0 text-lg font-bold text-foreground">Ações</h2>
              {cancelled ? (
                <p className="m-0 rounded-lg bg-muted p-3 text-sm text-muted-foreground">A tua inscrição está cancelada.</p>
              ) : null}
              {manage.canCancel ? (
                <button
                  type="button"
                  onClick={doCancel}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Cancelar inscrição
                </button>
              ) : null}
              {manage.canRefund ? (
                <button
                  type="button"
                  onClick={doRefund}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-60"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Pedir reembolso
                </button>
              ) : null}
              {manage.paymentState === 'refund_requested' ? (
                <p className="m-0 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  O teu pedido de reembolso foi enviado. O organizador vai processá-lo.
                </p>
              ) : manage.paymentState === 'refunded' ? (
                <p className="m-0 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Reembolso concluído.</p>
              ) : null}
              {!manage.canCancel && !manage.canRefund && !cancelled ? (
                <p className="m-0 text-sm text-muted-foreground">
                  Não há ações disponíveis para esta inscrição de momento.
                </p>
              ) : null}
              {manage.link ? (
                <a
                  href={manage.link}
                  className="mt-1 inline-flex w-fit items-center gap-1.5 text-sm font-semibold hover:underline"
                  style={{ color: ACCENT }}
                >
                  <Ticket className="h-4 w-4" aria-hidden="true" />
                  Ver o meu bilhete
                </a>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
