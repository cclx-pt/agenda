import { useEffect, useState } from 'react'
import { BarChart3, Copy, ExternalLink, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import * as invitesService from '../../services/invitesService'

const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60'
const ghostBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60'

export default function FollowupLinkCard({ invite }) {
  const [link, setLink] = useState(null)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let alive = true
    invitesService
      .getFollowupLink(invite.id)
      .then((value) => alive && setLink(value))
      .catch((error) => alive && toast.error(error.message))
      .finally(() => alive && setBusy(false))
    return () => {
      alive = false
    }
  }, [invite.id])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url)
      toast.success('Link Self Follow-up copiado.')
    } catch {
      toast.error('Não foi possível copiar. Seleciona o link manualmente.')
    }
  }

  const regenerate = async () => {
    if (!window.confirm('Gerar um novo link desativa imediatamente o anterior. Continuar?')) return
    setBusy(true)
    try {
      setLink(await invitesService.regenerateFollowupLink(invite.id))
      toast.success('Novo link Self Follow-up gerado.')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="m-0 mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <BarChart3 className="h-4 w-4" aria-hidden="true" /> Self_Follow-up
        </h3>
        <p className="m-0 text-xs text-muted-foreground">
          Painel público para telemóvel com inscrições, adultos, crianças e distribuição por igreja.
        </p>
      </div>

      {busy && !link ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> A preparar o link…
        </div>
      ) : link ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input readOnly value={link.url} onFocus={(event) => event.target.select()} className={`${inputCls} font-mono text-xs`} />
            <div className="flex gap-2">
              <button type="button" onClick={copy} className={primaryBtn}>
                <Copy className="h-4 w-4" aria-hidden="true" /> Copiar
              </button>
              <a href={link.url} target="_blank" rel="noreferrer" className={ghostBtn}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> Abrir
              </a>
            </div>
          </div>
          <button type="button" onClick={regenerate} disabled={busy} className={`${ghostBtn} self-start`}>
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" /> Gerar novo link
          </button>
          <p className="m-0 flex items-start gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> O link mostra apenas totais agregados. Quem o receber consegue consultar estes KPI.
          </p>
        </>
      ) : null}
    </section>
  )
}