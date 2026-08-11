import { useCallback, useEffect, useState } from 'react'
import { BarChart3, Building2, CalendarDays, Loader2, MapPin, RefreshCw, UsersRound } from 'lucide-react'
import * as invitesService from '../../services/invitesService'

function formatEventDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Lisbon',
  })
}

function Kpi({ label, value, tone }) {
  return (
    <div className={`min-w-0 border-l-4 bg-white p-4 shadow-sm ${tone}`}>
      <span className="block text-xs font-bold uppercase text-zinc-500">{label}</span>
      <strong className="mt-1 block text-3xl font-black text-zinc-950">{value}</strong>
    </div>
  )
}

export default function InviteFollowup({ slug, token }) {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(token ? null : 'Link Self Follow-up inválido: falta o código de acesso.')
  const [loading, setLoading] = useState(Boolean(token))
  const [refreshing, setRefreshing] = useState(false)

  const fetchStats = useCallback(
    () => invitesService.publicFollowupStats(slug, token),
    [slug, token]
  )

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

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-zinc-100"><Loader2 className="h-8 w-8 animate-spin text-red-700" /></main>
  }

  if (error && !stats) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-100 p-6">
        <div className="max-w-sm border-t-4 border-red-700 bg-white p-6 text-center shadow-sm">
          <BarChart3 className="mx-auto mb-3 h-9 w-9 text-red-700" />
          <h1 className="m-0 text-xl font-black text-zinc-950">Self Follow-up indisponível</h1>
          <p className="mb-0 mt-2 text-sm text-zinc-600">{error}</p>
        </div>
      </main>
    )
  }

  const updated = stats?.updatedAt ? new Date(stats.updatedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <main className="min-h-screen bg-zinc-100 pb-10 text-zinc-950">
      <header className="bg-[#17243a] px-5 pb-8 pt-7 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-xs font-bold uppercase text-red-300"><BarChart3 className="h-4 w-4" /> Self Follow-up</span>
            <button type="button" onClick={refresh} disabled={refreshing} className="grid h-10 w-10 place-items-center border border-white/30 bg-white/10" aria-label="Atualizar KPI" title="Atualizar KPI">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <h1 className="m-0 text-2xl font-black leading-tight">{stats.event.title}</h1>
          <div className="mt-3 flex flex-col gap-1 text-sm text-zinc-300">
            {formatEventDate(stats.event.startDatetime) ? <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {formatEventDate(stats.event.startDatetime)}</span> : null}
            {stats.event.location ? <span className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {stats.event.location}</span> : null}
          </div>
        </div>
      </header>

      <div className="mx-auto -mt-4 flex max-w-2xl flex-col gap-5 px-4">
        <section className="grid grid-cols-2 gap-3" aria-label="Indicadores de inscrição">
          <Kpi label="Inscrições" value={stats.registrations} tone="border-red-700" />
          <Kpi label="Pessoas" value={stats.people.total} tone="border-[#17243a]" />
          <Kpi label="Adultos" value={stats.people.adultos} tone="border-emerald-600" />
          <Kpi label="Crianças" value={stats.people.criancas} tone="border-amber-500" />
          {stats.people.jovens > 0 ? <Kpi label="Jovens" value={stats.people.jovens} tone="border-sky-600" /> : null}
        </section>

        <section className="bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <h2 className="m-0 flex items-center gap-2 text-sm font-black uppercase"><Building2 className="h-4 w-4 text-red-700" /> Por igreja</h2>
            <span className="text-xs text-zinc-500">{stats.byChurch.length}</span>
          </div>
          {stats.byChurch.length ? (
            <ol className="m-0 list-none divide-y divide-zinc-100 p-0">
              {stats.byChurch.map((church) => (
                <li key={church.name} className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-3">
                  <span className="min-w-0 truncate text-sm font-bold">{church.name}</span>
                  <span className="flex items-center gap-1.5 text-sm tabular-nums text-zinc-600"><UsersRound className="h-4 w-4" /> {church.people} <span className="text-xs">({church.registrations} insc.)</span></span>
                </li>
              ))}
            </ol>
          ) : <p className="m-0 px-4 py-6 text-center text-sm text-zinc-500">Ainda não existem inscrições confirmadas.</p>}
        </section>

        <p className="m-0 text-center text-xs text-zinc-500">Atualização automática · última leitura às {updated}</p>
      </div>
    </main>
  )
}