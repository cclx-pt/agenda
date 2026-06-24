import { useState, useMemo } from 'react'
import { useTheme } from './hooks/useTheme'
import { useEvents } from './hooks/useEvents'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useAuth } from './hooks/useAuth'
import { Toaster, toast } from 'sonner'
import { AnimatePresence } from 'framer-motion'
import ThemeToggle from './components/ThemeToggle'
import StatusLights from './components/StatusLights'
import MonthView from './components/MonthView'
import MiniMonth from './components/MiniMonth'
import DayView from './components/DayView'
import WeekView from './components/WeekView'
import CalendarSidebar from './components/CalendarSidebar'
import EventDetail from './components/EventDetail'
import ExportModal from './components/ExportModal'
import SearchBar from './components/SearchBar'
import CalendarSkeleton from './components/CalendarSkeleton'
import LoginModal from './components/LoginModal'
import ManagePanel from './components/ManagePanel'
import * as eventsService from './services/eventsService'
import { clearEventCache } from './services/apiService'
import {
  MONTHS_PT, MONTHS_SHORT, rangeForView, formatDateLabel, toDateKey, parseDateKey,
} from './utils/calendarHelpers'
import { compareChurches } from './utils/churches'
import logoUrl from './assets/cclx_line_logo.png'
import styles from './App.module.css'

const VIEWS = ['day', 'week', 'month', 'quarter', 'semester', 'year']
const VIEW_META = {
  day:      { label: 'Diária',     icon: 'ti-calendar-event' },
  week:     { label: 'Semanal',    icon: 'ti-calendar-week' },
  month:    { label: 'Mensal',     icon: 'ti-calendar-month' },
  quarter:  { label: 'Trimestral', icon: 'ti-calendar-stats' },
  semester: { label: 'Semestral',  icon: 'ti-calendars' },
  year:     { label: 'Anual',      icon: 'ti-calendar' },
}

export default function App() {
  const { toggle, isDark } = useTheme()
  const { user, isAuthenticated, logout, canViewPrivate } = useAuth()
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [day,   setDay]   = useState(today.getDate())   // âncora das vistas diária/semanal
  const [view,  setView]  = useLocalStorage('cclx-view', 'month')
  // Visibilidade de eventos: 'all' | 'private' | 'public' (só para quem tem acesso a privados).
  const [visibility, setVisibility] = useLocalStorage('cclx-visibility', 'all')
  const canManage = isAuthenticated && ['admin', 'aprovador', 'editor'].includes(user?.role)
  const includePrivate = canViewPrivate && visibility !== 'public'
  // Rascunhos/pendentes aparecem SEMPRE na agenda para quem gere eventos
  // (admin/aprovador/editor), assinalados com um selo. Os restantes não os veem.
  const includeDrafts = canManage
  // Carga por intervalo: a inicial é o mês atual; muda conforme a vista selecionada.
  const { from, to } = useMemo(
    () => rangeForView(view, year, month, day),
    [view, year, month, day]
  )
  const { events, loading, error, reload } = useEvents({ from, to, includePrivate, includeDrafts })

  const [selected,     setSelected]     = useState({ y: today.getFullYear(), m: today.getMonth(), d: today.getDate() }) // dia selecionado (sidebar)
  const [detailEvent,  setDetailEvent]  = useState(null)   // event object
  const [exportData,   setExportData]   = useState(null)   // { events, filename }
  const [community,    setCommunity]    = useLocalStorage('cclx-community', 'Todas') // church filter
  const [category,     setCategory]     = useLocalStorage('cclx-category', 'Todos') // event-type filter
  const [loginOpen,    setLoginOpen]    = useState(false)   // login modal
  const [manageOpen,   setManageOpen]   = useState(false)   // backoffice panel
  const [manageView,   setManageView]   = useState('home')  // vista inicial do painel de gestao

  const handleLogout = async () => {
    await logout()
    toast.success('Sessão terminada.')
  }

  // Apagar um evento do SoR a partir do calendário (eventos da inChurch são só-leitura).
  const isSorEvent = (evt) => evt && !String(evt.id).startsWith('ic-')
  const handleDeleteEvent = async (evt) => {
    if (!isSorEvent(evt)) return
    if (!window.confirm(`Eliminar "${evt.title}"? Esta ação é irreversível.`)) return
    try {
      await eventsService.deleteEvent(evt.id)
      clearEventCache()
      setDetailEvent(null)
      await reload()
      toast.success('Evento eliminado.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  // ─── Filtered events by community + category ─────────────────
  const filteredEvents = useMemo(() => {
    return events.filter(e =>
      (community === 'Todas' || e.community === community) &&
      (category === 'Todos' || e.category === category) &&
      (visibility === 'all' ||
        (visibility === 'private' ? e.isPrivate : !e.isPrivate))
    )
  }, [events, community, category, visibility])

  const filteredByDate = useMemo(() => {
    const map = {}
    for (const e of filteredEvents) {
      ;(map[e.date] ??= []).push(e)
    }
    return map
  }, [filteredEvents])

  // ─── Dia selecionado (sidebar) + opções de filtro ───────────────
  const selectedKey = toDateKey(selected.y, selected.m, selected.d)
  const dayEvents = filteredByDate[selectedKey] || []

  // Igrejas presentes nos eventos (alimenta o filtro da sidebar).
  const communities = useMemo(() => {
    const set = new Set(events.map((e) => e.community).filter(Boolean))
    return Array.from(set).sort(compareChurches)
  }, [events])

  // Selecionar um dia: atualiza a sidebar (e, nas vistas mês/semana, a âncora).
  const selectDay = (dateKey) => {
    const { year: y, month: m, day: d } = parseDateKey(dateKey)
    setSelected({ y, m, d })
  }
  const selectDayAndNavigate = (dateKey) => {
    const { year: y, month: m, day: d } = parseDateKey(dateKey)
    setSelected({ y, m, d })
    setYear(y); setMonth(m); setDay(d)
  }

  // ─── Event count for the visible period (empty-state) ────────────
  const periodEventCount = useMemo(() => {
    return filteredEvents.filter((e) => e.date >= from && e.date <= to).length
  }, [filteredEvents, from, to])

  // ─── Navigation ──────────────────────────────────────────────────
  const navigate = (dir) => {
    if (view === 'day') {
      const d = new Date(year, month, day + dir)
      setYear(d.getFullYear()); setMonth(d.getMonth()); setDay(d.getDate())
    } else if (view === 'week') {
      const d = new Date(year, month, day + dir * 7)
      setYear(d.getFullYear()); setMonth(d.getMonth()); setDay(d.getDate())
    } else if (view === 'month') {
      const d = new Date(year, month + dir, 1)
      setYear(d.getFullYear()); setMonth(d.getMonth())
    } else if (view === 'quarter') {
      const d = new Date(year, month + dir * 3, 1)
      setYear(d.getFullYear()); setMonth(d.getMonth())
    } else if (view === 'semester') {
      const d = new Date(year, month + dir * 6, 1)
      setYear(d.getFullYear()); setMonth(d.getMonth())
    } else {
      setYear(y => y + dir)
    }
  }

  const goToday = () => {
    setYear(today.getFullYear()); setMonth(today.getMonth()); setDay(today.getDate())
    setSelected({ y: today.getFullYear(), m: today.getMonth(), d: today.getDate() })
  }

  // ─── Period label ────────────────────────────────────────────────
  const periodLabel = () => {
    if (view === 'day') return formatDateLabel(toDateKey(year, month, day))
    if (view === 'week') {
      const dow = (new Date(year, month, day).getDay() + 6) % 7
      const mon = new Date(year, month, day - dow)
      const sun = new Date(year, month, day - dow + 6)
      const fmt = (d) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
      return `${fmt(mon)} – ${fmt(sun)} ${sun.getFullYear()}`
    }
    if (view === 'month')    return `${MONTHS_PT[month]} ${year}`
    if (view === 'quarter')  return `${MONTHS_SHORT[month]} – ${MONTHS_SHORT[(month + 2) % 12]} ${year}`
    if (view === 'semester') return `${MONTHS_SHORT[month]} – ${MONTHS_SHORT[(month + 5) % 12]} ${year}`
    return String(year)
  }

  // ─── Month ranges for multi-month views ─────────────────────────
  const getMonthRange = (count) => {
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(year, month + i, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  // ─── Export current view ─────────────────────────────────────────
  const exportCurrentView = () => {
    const filtered = filteredEvents.filter((e) => e.date >= from && e.date <= to)
    if (filtered.length === 0) {
      toast.info('Sem eventos para exportar nesta vista')
      return
    }
    setExportData({ events: filtered, filename: `cclx-${view}-${year}.ics` })
  }

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className={styles.app}>
      <Toaster
        position="bottom-right"
        theme={isDark ? 'dark' : 'light'}
        toastOptions={{ style: { fontFamily: 'Barlow, sans-serif' } }}
      />

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className={styles.topbar}>
        <div className={styles.logoArea}>
          <img src={logoUrl} alt="CCLX" className={styles.logoImg} />
          <span className={styles.agendaTitle}>Agenda</span>
        </div>

        <div className={styles.topRight}>
          <SearchBar events={filteredEvents} onSelect={(evt) => setDetailEvent(evt)} />
          {canViewPrivate && (
            <div className={styles.visibilitySelect}>
              <i className="ti ti-eye" aria-hidden="true" />
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                aria-label="Visibilidade dos eventos"
                title="Visibilidade dos eventos"
              >
                <option value="all">Ver tudo</option>
                <option value="private">Só privados</option>
                <option value="public">Só públicos</option>
              </select>
            </div>
          )}
          <button className={styles.icsExportBtn} onClick={exportCurrentView}
            title="Exportar vista atual">
            <i className="ti ti-calendar-share" aria-hidden="true" />
            <span>Exportar</span>
          </button>
          {canManage && (
            <button className={styles.icsExportBtn} onClick={() => { setManageView('home'); setManageOpen(true) }}
              title="Administração">
              <i className="ti ti-calendar-cog" aria-hidden="true" />
              <span>Admin</span>
            </button>
          )}
          {isAuthenticated ? (
            <button className={styles.icsExportBtn} onClick={handleLogout}
              title={`Sessão: ${user.name || user.email} (${user.role})`}>
              <i className="ti ti-logout" aria-hidden="true" />
              <span>Sair</span>
            </button>
          ) : (
            <button className={styles.icsExportBtn} onClick={() => setLoginOpen(true)}
              title="Entrar na gestão">
              <i className="ti ti-lock" aria-hidden="true" />
              <span>Entrar</span>
            </button>
          )}
          <ThemeToggle isDark={isDark} onToggle={toggle} />
        </div>
      </header>

      <StatusLights />

      {/* ── Shell: sidebar navy + calendário ─────────────────────── */}
      <div className={styles.shell}>
        <CalendarSidebar
          selectedKey={selectedKey}
          dayEvents={dayEvents}
          onSelectEvent={(evt) => setDetailEvent(evt)}
          canManage={canManage}
          onNewEvent={() => { setManageView('form'); setManageOpen(true) }}
          onExportDay={() =>
            setExportData({ events: dayEvents, filename: `cclx-${selectedKey}.ics` })
          }
          community={community}
          onCommunityChange={setCommunity}
          communities={communities}
          category={category}
          onCategoryChange={setCategory}
        />

        <section className={styles.main}>
          {/* ── Cabeçalho: navegação + vistas ───────────────────── */}
          <div className={styles.mainHeader}>
            <div className={styles.periodNav}>
              <button className={styles.navBtn} onClick={() => navigate(-1)} aria-label="Anterior">
                <i className="ti ti-chevron-left" aria-hidden="true" />
              </button>
              <button className={styles.navBtn} onClick={() => navigate(1)} aria-label="Próximo">
                <i className="ti ti-chevron-right" aria-hidden="true" />
              </button>
              <span className={styles.periodLabel}>{periodLabel()}</span>
              <button className={styles.todayBtn} onClick={goToday}>Hoje</button>
            </div>

            <nav className={styles.viewPills} aria-label="Vista do calendário">
              {VIEWS.map(v => (
                <button key={v}
                  className={`${styles.vpill} ${view === v ? styles.active : ''}`}
                  onClick={() => setView(v)}
                  aria-current={view === v ? 'page' : undefined}
                >
                  <i className={`ti ${VIEW_META[v].icon}`} aria-hidden="true" />
                  <span>{VIEW_META[v].label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* ── Calendar body ─────────────────────────────────────── */}
          <main className={styles.body}>
            {loading && <CalendarSkeleton />}

            {error && (
              <div className={styles.errorState}>
                <i className="ti ti-alert-circle" aria-hidden="true" />
                <span>{error}</span>
                <button className={styles.retryBtn} onClick={() => reload()}>
                  <i className="ti ti-refresh" aria-hidden="true" />
                  <span>Tentar novamente</span>
                </button>
              </div>
            )}

            {!loading && !error && (
              <>
                {periodEventCount === 0 && (
                  <div className={styles.emptyState}>
                    <i className="ti ti-calendar-off" aria-hidden="true" />
                    <span>Sem eventos neste período</span>
                  </div>
                )}
                {view === 'day' && (
                  <DayView
                    year={year} month={month} day={day}
                    eventsByDate={filteredByDate}
                    onSelectEvent={(evt) => setDetailEvent(evt)}
                    onExport={(evts, filename) => setExportData({ events: evts, filename })}
                  />
                )}

                {view === 'week' && (
                  <WeekView
                    year={year} month={month} day={day}
                    eventsByDate={filteredByDate}
                    onSelectEvent={(evt) => setDetailEvent(evt)}
                    onDayClick={(dateKey) => selectDayAndNavigate(dateKey)}
                  />
                )}

                {view === 'month' && (
                  <MonthView
                    year={year} month={month}
                    eventsByDate={filteredByDate}
                    selectedKey={selectedKey}
                    onDayClick={(dateKey) => selectDayAndNavigate(dateKey)}
                  />
                )}

                {view === 'quarter' && (
                  <div className={styles.multiGrid}>
                    {getMonthRange(3).map(({ year: y, month: m }) => (
                      <MiniMonth key={`${y}-${m}`} year={y} month={m}
                        eventsByDate={filteredByDate} size="md"
                        onDayClick={(dateKey) => selectDay(dateKey)}
                      />
                    ))}
                  </div>
                )}

                {view === 'semester' && (
                  <div className={styles.multiGrid6}>
                    {getMonthRange(6).map(({ year: y, month: m }) => (
                      <MiniMonth key={`${y}-${m}`} year={y} month={m}
                        eventsByDate={filteredByDate} size="sm"
                        onDayClick={(dateKey) => selectDay(dateKey)}
                      />
                    ))}
                  </div>
                )}

                {view === 'year' && (
                  <div className={styles.yearGrid}>
                    {Array.from({ length: 12 }, (_, i) => (
                      <MiniMonth key={i} year={year} month={i}
                        eventsByDate={filteredByDate} size="xs"
                        onDayClick={(dateKey) => selectDay(dateKey)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </main>
        </section>
      </div>


      {/* ── Event detail modal ───────────────────────────────────── */}
      <AnimatePresence>
        {detailEvent && (
          <EventDetail
            event={detailEvent}
            onClose={() => setDetailEvent(null)}
            onBack={null}
            onExport={(evt) => setExportData({ events: [evt], filename: null })}
            onDelete={canManage && isSorEvent(detailEvent) ? handleDeleteEvent : null}
          />
        )}
      </AnimatePresence>

      {/* ── Export modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {exportData && (
          <ExportModal
            events={exportData.events}
            filename={exportData.filename}
            onClose={() => setExportData(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Login modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      </AnimatePresence>

      {/* ── Painel de gestão ────────────────────────────────────── */}
      <AnimatePresence>
        {manageOpen && <ManagePanel initialView={manageView} onClose={() => setManageOpen(false)} />}
      </AnimatePresence>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
