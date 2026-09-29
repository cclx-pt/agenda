import { useEffect, useState } from 'react'
import { CheckCircle2, Image, Loader2 } from 'lucide-react'
import * as invitesService from '../../services/invitesService'

export default function InviteImageConsent({ slug }) {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('g') || ''
  const campaignId = params.get('c') || ''
  const [context, setContext] = useState(null)
  const [state, setState] = useState(token ? 'loading' : 'invalid')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    let alive = true
    invitesService
      .getInviteImageConsent(slug, token)
      .then((result) => {
        if (!alive) return
        setContext(result)
        setState(result.canConsent ? 'ready' : 'done')
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

  const confirm = async () => {
    setState('submitting')
    setError('')
    try {
      const result = await invitesService.confirmInviteImageConsent(
        slug,
        token,
        campaignId
      )
      setContext((current) => ({ ...current, ...result, canConsent: false }))
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

  const title = context?.eventTitle ?? 'este evento'
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10">
      <section className="mx-auto max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {context?.bannerUrl ? (
          <img
            src={context.bannerUrl}
            alt={title}
            className="block h-auto w-full"
          />
        ) : null}
        <div className="p-6 text-center sm:p-8">
          {state === 'done' ? (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <h1 className="mt-4 text-2xl font-bold">Autorização registada</h1>
              <p className="text-muted-foreground">
                A autorização de utilização da sua imagem em fotografias ou vídeos
                de {title} ficou registada.
              </p>
            </>
          ) : state === 'invalid' ? (
            <>
              <Image className="mx-auto h-10 w-10 text-destructive" />
              <h1 className="mt-4 text-2xl font-bold">Ligação inválida</h1>
              <p className="text-muted-foreground">
                {error || 'Não foi possível identificar a inscrição.'}
              </p>
            </>
          ) : (
            <>
              <Image className="mx-auto h-10 w-10 text-muted-foreground" />
              <h1 className="mt-4 text-2xl font-bold">
                Autorizar utilização da imagem
              </h1>
              <p className="text-muted-foreground">
                Ao confirmar, autoriza a utilização da sua imagem em fotografias
                ou vídeos captados no âmbito de {title}. A alteração e a respetiva
                data ficarão registadas para auditoria.
              </p>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <button
                type="button"
                onClick={confirm}
                disabled={state === 'submitting'}
                className="mt-3 inline-flex items-center justify-center rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
              >
                {state === 'submitting'
                  ? 'A registar…'
                  : 'Confirmo que autorizo a utilização da minha imagem'}
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
