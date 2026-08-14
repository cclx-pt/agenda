import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays, Check, HandHeart, Landmark, Loader2, ShieldCheck, Target } from 'lucide-react'
import { useI18n } from '../../hooks/useI18n'
import { useTheme } from '../../hooks/useTheme'
import * as fundingService from '../../services/fundingService'
import defaultLogoUrl from '../../assets/cclx_line_logo.png'
import ThemeToggle from '../ThemeToggle'

const CONFIG_LABELS = {
  C1: 'Donativo único',
  C2: 'Contribuição mensal durante 12 meses',
  C3: 'Compromisso anual',
  C4: 'Contribuição semanal',
  C5: 'Contribuição mensal contínua',
}

const money = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const date = new Intl.DateTimeFormat('pt-PT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function FundingPage({ slug }) {
  const { logoUrl } = useI18n()
  const { toggle, isDark } = useTheme()
  const [campaign, setCampaign] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fundingService.getPublicCampaign(slug)
      .then((result) => {
        setCampaign(result)
        document.title = `${result.title} · Agenda CCLX`
      })
      .catch((requestError) => setError(requestError.message))
  }, [slug])

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="max-w-md text-center">
          <HandHeart className="mx-auto mb-4 h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-2xl font-bold">Campanha indisponível</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
          <a href="/" className="mt-6 inline-flex items-center gap-2 font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar à Agenda
          </a>
        </div>
      </main>
    )
  }

  if (!campaign) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="A carregar" /></div>
  }

  const deadline = new Date(`${campaign.deadline}T12:00:00`)

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="z-[12] flex h-[60px] flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-5 max-[600px]:h-[52px] max-[600px]:px-3">
        <a href="/" className="flex items-center gap-3" aria-label="Agenda CCLX">
          <img src={logoUrl || defaultLogoUrl} alt="CCLX" className="h-8 w-auto object-contain invert dark:invert-0" />
          <span className="whitespace-nowrap border-l-2 border-border pl-3 text-lg font-bold tracking-wide max-[600px]:hidden">Agenda CCLX</span>
        </a>
        <div className="flex items-center gap-4">
          <ThemeToggle isDark={isDark} onToggle={toggle} />
          <a href="/" className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-semibold hover:bg-accent">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Agenda
          </a>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex w-full flex-col border-b border-border bg-card p-4 md:w-[280px] md:flex-shrink-0 md:border-b-0 md:border-r md:p-5">
          <div className="flex items-start gap-3 border-b border-border pb-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><HandHeart className="h-5 w-5" aria-hidden="true" /></span>
            <div><span className="block text-xs font-bold uppercase text-muted-foreground">Financiamento</span><strong className="text-sm">Campanha CCLX</strong></div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-1">
            <div><dt className="text-xs font-semibold text-muted-foreground">Objetivo</dt><dd className="mt-0.5 text-xl font-bold">{money.format(campaign.targetEur)}</dd></div>
            <div><dt className="text-xs font-semibold text-muted-foreground">Data limite</dt><dd className="mt-1 flex items-center gap-1.5 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{date.format(deadline)}</dd></div>
          </dl>
          <div className="mt-5 hidden border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground md:block">Os valores apresentados são agregados. Os dados individuais permanecem reservados.</div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="border-b border-border bg-card px-5 py-3 sm:px-7">
            <span className="text-xs font-semibold text-muted-foreground">Agenda / Financiamento / </span><span className="text-xs font-bold">{campaign.title}</span>
          </div>

          <div className="mx-auto flex max-w-5xl flex-col gap-5 p-4 sm:p-7">
            <section className="rounded-[10px] border border-border bg-muted/40 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <Target className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                <div><p className="mb-1 text-xs font-bold uppercase text-muted-foreground">Objetivo comunitário</p><h1 className="text-2xl font-bold leading-tight sm:text-3xl">{campaign.title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{campaign.purpose}</p></div>
              </div>
            </section>

            <section className="rounded-[10px] border border-border bg-card p-5 sm:p-6" aria-labelledby="funding-progress-title">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div><h2 id="funding-progress-title" className="text-xs font-bold uppercase text-muted-foreground">Progresso da campanha</h2><strong className="mt-1 block text-3xl">{money.format(campaign.totalReceived)}</strong></div>
                <strong className="rounded-md bg-primary px-3 py-1.5 text-lg text-primary-foreground">{campaign.percentage}%</strong>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={campaign.percentage} aria-valuemin="0" aria-valuemax="100" aria-label="Progresso da campanha">
                <div className="h-full rounded-full sc-bg-gold transition-[width] duration-700" style={{ width: `${campaign.percentage}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs font-medium text-muted-foreground"><span>{campaign.donorCount} contribuintes identificados</span><span>Faltam {money.format(campaign.remainingEur)}</span></div>
            </section>

            <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
              <section className="rounded-[10px] border border-border bg-card p-5" aria-labelledby="funding-methods-title">
                <div className="mb-4 flex items-center gap-2"><HandHeart className="h-5 w-5 text-primary" aria-hidden="true" /><h2 id="funding-methods-title" className="text-base font-bold">Formas de participar</h2></div>
                <div className="flex flex-col gap-2">
                  {campaign.configurations.map((config) => (
                    <div key={config} className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><Check className="h-4 w-4" aria-hidden="true" /></span>
                      <div><strong className="block text-sm">{CONFIG_LABELS[config]}</strong><span className="text-xs text-muted-foreground">Modelo {config}</span></div>
                    </div>
                  ))}
                </div>
              </section>

              <aside className="rounded-[10px] border border-border bg-muted/40 p-5">
                <Landmark className="mb-3 h-6 w-6 text-primary" aria-hidden="true" />
                <h2 className="text-base font-bold">Como contribuir</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Contacte a sua comunidade ou a tesouraria CCLX para escolher o meio de contribuição e receber o respetivo comprovativo.</p>
                <div className="mt-5 flex gap-3 border-t border-border pt-4"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><p className="text-xs leading-5 text-muted-foreground">Cada contribuição é registada, comprovada e reconciliada. Nunca publicamos nomes ou montantes individuais.</p></div>
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}