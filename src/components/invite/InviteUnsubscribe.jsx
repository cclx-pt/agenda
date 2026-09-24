import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, MailX } from 'lucide-react'
import * as invitesService from '../../services/invitesService'

export default function InviteUnsubscribe({ slug }) {
  const token = new URLSearchParams(window.location.search).get('g') || ''
  const [page, setPage] = useState(null)
  const [state, setState] = useState(token ? 'loading' : 'invalid')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    let alive = true
    invitesService
      .getPublicInvite(slug, token)
      .then((result) => {
        if (!alive) return
        setPage(result)
        setState('ready')
      })
      .catch((requestError) => {
        if (!alive) return
        setError(requestError.message)
        setState('invalid')
      })
    return () => {
      alive = false
    }
  }, [slug, token])

  const unsubscribe = async () => {
    setState('submitting')
    setError('')
    try {
      await invitesService.unsubscribeInviteCampaignEmails(slug, token)
      setState('done')
    } catch (requestError) {
      setError(requestError.message)
      setState('ready')
    }
  }

  if (state === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    )
  }

  const bannerUrl = page?.invite?.bannerUrl
  const title = page?.invite?.title ?? 'este evento'

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10">
      <section className="mx-auto max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {bannerUrl ? (
          <img src={bannerUrl} alt={title} className="block h-auto w-full" />
        ) : null}
        <div className="p-6 text-center sm:p-8">
          {state === 'done' ? (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <h1 className="mt-4 text-2xl font-bold">Emails cancelados</h1>
              <p className="text-muted-foreground">
                Esta inscrição deixou de receber comunicações sobre {title}.
              </p>
            </>
          ) : state === 'invalid' ? (
            <>
              <MailX className="mx-auto h-10 w-10 text-destructive" />
              <h1 className="mt-4 text-2xl font-bold">Ligação inválida</h1>
              <p className="text-muted-foreground">
                {error || 'Não foi possível identificar a inscrição.'}
              </p>
            </>
          ) : (
            <>
              <MailX className="mx-auto h-10 w-10 text-muted-foreground" />
              <h1 className="mt-4 text-2xl font-bold">Cancelar emails</h1>
              <p className="text-muted-foreground">
                Deixará de receber futuras comunicações relacionadas com {title}. A
                inscrição no evento não será cancelada.
              </p>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <button
                type="button"
                onClick={unsubscribe}
                disabled={state === 'submitting'}
                className="mt-3 inline-flex items-center justify-center rounded-lg bg-destructive px-5 py-2.5 font-semibold text-destructive-foreground disabled:opacity-50"
              >
                {state === 'submitting' ? 'A cancelar…' : 'Cancelar receção de emails'}
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
