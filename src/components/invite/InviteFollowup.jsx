import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3, Building2, CalendarDays, CheckCircle2, Clock3, Loader2,
  MapPin, RefreshCw, Search, Ticket, UserRound, UsersRound,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import * as invitesService from '../../services/invitesService'

const SITUATIONS = [
  ['confirmada', 'Confirmadas', 'bg-emerald-500'],
  ['comprovativo', 'Aguardam comprovativo', 'bg-amber-500'],
  ['validacao', 'Comprovativos por validar', 'bg-sky-500'],
  ['espera', 'Lista de espera', 'bg-orange-500'],
  ['cancelada', 'Canceladas', 'bg-red-500'],
  ['reembolso', 'Reembolso pedido', 'bg-orange-700'],
  ['reembolsado', 'Reembolsadas', 'bg-violet-500'],
  ['expirada', 'Expiradas', 'bg-zinc-400'],
  ['pendente', 'Pendentes', 'bg-zinc-500'],
]

function formatEventDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('pt-PT', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Lisbon',
  })
}

function formatDay(value) {
  if (!value) return ''
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Kpi({ label, value, icon: Icon, detail }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-xs font-medium text-muted-foreground">{label}</span>
          <strong className="mt-1 block text-3xl font-bold tracking-normal text-foreground">{value}</strong>
          {detail ? <span className="mt-1 block text-xs text-muted-foreground">{detail}</span> : null}
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  )
}

function BreakdownTable({ rows, firstColumn, emptyMessage }) {
  if (!rows.length) return <p className="m-0 px-4 py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead><tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
          <th className="px-4 py-3 font-medium">{firstColumn}</th>
          <th className="px-3 py-3 text-right font-medium">Inscrições</th>
          <th className="px-3 py-3 text-right font-medium">Pessoas</th>
          <th className="px-3 py-3 text-right font-medium">Adultos</th>
          <th className="px-3 py-3 text-right font-medium">Jovens</th>
          <th className="px-4 py-3 text-right font-medium">Crianças</th>
        </tr></thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.name || row.date} className="hover:bg-muted/30">
              <td className="max-w-[280px] px-4 py-3 font-medium text-foreground">{row.name || formatDay(row.date)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{row.registrations}</td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums text-foreground">{row.people}</td>
              <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{row.adultos}</td>
              <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{row.jovens}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{row.criancas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function InviteFollowup({ slug, token }) {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(token ? null : 'Link de acompanhamento inválido: falta o código de acesso.')
  const [loading, setLoading] = useState(Boolean(token))
  const [refreshing, setRefreshing] = useState(false)
  const [churchQuery, setChurchQuery] = useState('')
  const fetchStats = useCallback(() => invitesService.publicFollowupStats(slug, token), [slug, token])

  const refresh = async () => {
    if (!token) return
    setRefreshing(true)
    try {
      setStats(await fetchStats())
      setError(null)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!token) return undefined
    let alive = true
    const applyStats = (nextStats) => {
      if (!alive) return
      setStats(nextStats)
      setError(null)
      setLoading(false)
    }
    const applyError = (loadError) => {
      if (!alive) return
      setError(loadError.message)
      setLoading(false)
    }
    fetchStats().then(applyStats, applyError)
    const interval = window.setInterval(() => fetchStats().then(applyStats, applyError), 30000)
    return () => {
      alive = false
      window.clearInterval(interval)
    }
  }, [fetchStats, token])

  const filteredChurches = useMemo(() => {
    const query = churchQuery.trim().toLocaleLowerCase('pt-PT')
    const churches = stats?.byChurch || []
    return query ? churches.filter((item) => item.name.toLocaleLowerCase('pt-PT').includes(query)) : churches
  }, [churchQuery, stats])

  if (loading) return <main className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></main>

  if (error && !stats) {
    return <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <div className="max-w-sm rounded-lg border border-border bg-card p-6 text-center shadow-sm">
        <BarChart3 className="mx-auto mb-3 h-9 w-9 text-primary" />
        <h1 className="m-0 text-xl font-bold text-foreground">Acompanhamento indisponível</h1>
        <p className="mb-0 mt-2 text-sm text-muted-foreground">{error}</p>
      </div>
    </main>
  }

  const situations = stats.situations || { confirmada: stats.confirmedRegistrations || 0 }
  const rate = stats.registrations ? Math.round((stats.confirmedRegistrations / stats.registrations) * 100) : 0
  const updated = stats.updatedAt ? new Date(stats.updatedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <main className="min-h-screen bg-muted/30 pb-10 text-foreground">
      <header className="border-b border-border bg-background px-4 py-5 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary"><BarChart3 className="h-4 w-4" /> Acompanhamento de inscrições</span>
            <h1 className="m-0 text-2xl font-bold leading-tight text-foreground">{stats.event.title}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {formatEventDate(stats.event.startDatetime) ? <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {formatEventDate(stats.event.startDatetime)}</span> : null}
              {stats.event.location ? <span className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {stats.event.location}</span> : null}
            </div>
          </div>
          <button type="button" onClick={refresh} disabled={refreshing} className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-background text-foreground hover:bg-accent disabled:opacity-50" aria-label="Atualizar dados" title="Atualizar dados">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <Tabs defaultValue="geral">
          <TabsList className="grid h-auto w-full grid-cols-3 sm:w-auto sm:min-w-[420px]">
            <TabsTrigger value="geral" className="gap-2"><BarChart3 className="h-4 w-4" /> Geral</TabsTrigger>
            <TabsTrigger value="detalhe" className="gap-2"><Building2 className="h-4 w-4" /> Detalhe</TabsTrigger>
            <TabsTrigger value="dia" className="gap-2"><CalendarDays className="h-4 w-4" /> Por dia</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="mt-5 space-y-5">
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Indicadores gerais">
              <Kpi label="Inscrições recebidas" value={stats.registrations} icon={Ticket} />
              <Kpi label="Confirmadas" value={stats.confirmedRegistrations} icon={CheckCircle2} detail={`${rate}% do total`} />
              <Kpi label="Pessoas confirmadas" value={stats.people.total} icon={UsersRound} />
              <Kpi label="Adultos" value={stats.people.adultos} icon={UserRound} />
              <Kpi label="Crianças" value={stats.people.criancas} icon={UsersRound} />
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-lg border border-border bg-card shadow-sm">
                <div className="border-b border-border px-4 py-3"><h2 className="m-0 text-sm font-semibold">Estado das inscrições</h2></div>
                <div className="space-y-3 p-4">
                  {SITUATIONS.filter(([key]) => situations[key] > 0).map(([key, label, color]) => {
                    const width = stats.registrations ? (situations[key] / stats.registrations) * 100 : 0
                    return <div key={key}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</span>
                        <strong className="tabular-nums">{situations[key]}</strong>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} /></div>
                    </div>
                  })}
                </div>
              </section>
              <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3"><Ticket className="h-4 w-4 text-primary" /><h2 className="m-0 text-sm font-semibold">Por bilhete</h2></div>
                <BreakdownTable rows={stats.byTicket || []} firstColumn="Bilhete" emptyMessage="Sem bilhetes confirmados." />
              </section>
            </div>
          </TabsContent>

          <TabsContent value="detalhe" className="mt-5">
            <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="m-0 text-sm font-semibold">Composição por igreja</h2><p className="m-0 mt-1 text-xs text-muted-foreground">Apenas inscrições confirmadas</p></div>
                <label className="relative block sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <span className="sr-only">Pesquisar igreja</span>
                  <input type="search" value={churchQuery} onChange={(event) => setChurchQuery(event.target.value)} placeholder="Pesquisar igreja" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" />
                </label>
              </div>
              <BreakdownTable rows={filteredChurches} firstColumn="Igreja" emptyMessage="Nenhuma igreja corresponde à pesquisa." />
            </section>
          </TabsContent>

          <TabsContent value="dia" className="mt-5">
            <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3"><h2 className="m-0 text-sm font-semibold">Inscrições confirmadas por dia</h2><p className="m-0 mt-1 text-xs text-muted-foreground">Adultos, jovens e crianças pela data de inscrição</p></div>
              <BreakdownTable rows={[...(stats.byDay || [])].reverse()} firstColumn="Dia" emptyMessage="Ainda não há inscrições confirmadas por dia." />
            </section>
          </TabsContent>
        </Tabs>

        <p className="m-0 mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Atualização automática a cada 30 segundos · última leitura às {updated}</p>
      </div>
    </main>
  )
}