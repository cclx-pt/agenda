import { useState, useMemo, useEffect, useCallback } from 'react'
import { useTheme } from './hooks/useTheme'
import { useI18n } from './hooks/useI18n'
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
import ListView from './components/ListView'
import CalendarSidebar from './components/CalendarSidebar'
import EventDetail from './components/EventDetail'
import DayPopup from './components/DayPopup'
import ExportModal from './components/ExportModal'
import SearchBar from './components/SearchBar'
import CalendarLoading from './components/CalendarLoading'
import LoginModal from './components/LoginModal'
import ManagePanel from './components/ManagePanel'
import ApprovalsPanel from './components/ApprovalsPanel'
import * as eventsService from './services/eventsService'
import { clearEventCache } from './services/apiService'
import {
  MONTHS_PT, MONTHS_SHORT, rangeForView, formatDateLabel, toDateKey, parseDateKey,
} from './utils/calendarHelpers'
import { compareChurches } from './utils/churches'
import logoUrl from './assets/cclx_line_logo.png'
import {
  AlertCircle, CalendarPlus, CalendarX, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardCheck, Eye, Lock, LogOut, Menu, PanelLeftClose, PanelLeftOpen, RefreshCw, Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const VIEWS = ['day', 'week', 'month', 'quarter', 'semester', 'year', 'list']
const VIEW_META = {
  day:      { label: 'Diária',     icon: 'ti-calendar-event' },
  week:     { label: 'Semanal',    icon: 'ti-calendar-week' },
  month:    { label: 'Mensal',     icon: 'ti-calendar-month' },
  quarter:  { label: 'Trimestral', icon: 'ti-calendar-stats' },
  semester: { label: 'Semestral',  icon: 'ti-calendars' },
  year:     { label: 'Anual',      icon: 'ti-calendar' },
  list:     { label: 'Lista',      icon: 'ti-list-details' },
}

export default function App() {
  const { toggle, isDark } = useTheme()
  const { t, lang, setLang, languages, logoUrl: customLogoUrl } = useI18n()
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
  const [dayPopup,     setDayPopup]     = useState(null)   // { dateKey, events } (vistas multi-mes)
  const [exportData,   setExportData]   = useState(null)   // { events, filename }
  const [community,    setCommunity]    = useLocalStorage('cclx-communities', []) // filtro de igrejas (multi)
  const [category,     setCategory]     = useLocalStorage('cclx-category', 'Todos') // event-type filter
  const [categoriesInUse, setCategoriesInUse] = useState([]) // categorias existentes em eventos (BD)
  const [privacyTag,   setPrivacyTag]   = useState([]) // filtro por etiquetas de privacidade (multi)
  const [loginOpen,    setLoginOpen]    = useState(false)   // login modal
  const [manageOpen,   setManageOpen]   = useState(false)   // backoffice panel
  const [manageView,   setManageView]   = useState('home')  // vista inicial do painel de gestao
  const [approvalsOpen, setApprovalsOpen] = useState(false) // painel de aprovacoes
  const [sidebarOpen,  setSidebarOpen]  = useState(false)   // gaveta lateral (telemovel/tablet)
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage('cclx-sidebar-collapsed', false) // ocultar sidebar (desktop)

  // Categorias existentes em eventos (BD, qualquer estado) — filtro dinâmico da sidebar.
  const refreshCategoriesInUse = useCallback(() => {
    eventsService.listCategoriesInUse().then(setCategoriesInUse).catch(() => {})
  }, [])
  useEffect(() => {
    refreshCategoriesInUse()
  }, [refreshCategoriesInUse, manageOpen])
  // Se a categoria selecionada deixar de existir em eventos, volta a "Todos".
  useEffect(() => {
    if (category !== 'Todos' && categoriesInUse.length > 0 && !categoriesInUse.includes(category)) {
      setCategory('Todos')
    }
  }, [categoriesInUse, category, setCategory])

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
      refreshCategoriesInUse()
      toast.success('Evento eliminado.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  // ─── Filtered events by community + category ─────────────────
  const filteredEvents = useMemo(() => {
    return events.filter(e =>
      (community.length === 0 || community.includes(e.community)) &&
      (category === 'Todos' || e.category === category) &&
      (privacyTag.length === 0 || privacyTag.includes(e.privacyTag)) &&
      (visibility === 'all' ||
        (visibility === 'private' ? e.isPrivate : !e.isPrivate))
    )
  }, [events, community, category, privacyTag, visibility])

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

  // Etiquetas de privacidade presentes nos eventos visíveis (= disponíveis ao
  // utilizador, pois o servidor já filtra pelas etiquetas permitidas).
  const privacyTagsInUse = useMemo(() => {
    const set = new Set(events.map((e) => e.privacyTag).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt'))
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
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Toaster
        position="bottom-right"
        theme={isDark ? 'dark' : 'light'}
        toastOptions={{ style: { fontFamily: 'Barlow, sans-serif' } }}
      />

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="z-[12] flex h-[60px] flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-5 text-foreground max-[600px]:h-[52px] max-[600px]:gap-2 max-[600px]:px-3">
        <div className="flex flex-shrink-0 items-center gap-3">
          <img src={customLogoUrl || logoUrl} alt="CCLX" className="h-8 w-auto object-contain invert dark:invert-0" />
          <span className="whitespace-nowrap border-l-2 border-border pl-3 text-lg font-bold tracking-wide text-foreground max-[820px]:hidden">{t('appTitle')}</span>
        </div>

        <div className="flex flex-shrink-0 items-center gap-3.5 max-[980px]:gap-2">
          <SearchBar events={filteredEvents} onSelect={(evt) => setDetailEvent(evt)} />
          {canViewPrivate && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Eye className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <div className="relative">
                <select
                  className="cursor-pointer appearance-none rounded-md border border-input bg-background py-[5px] pl-2.5 pr-7 text-[11px] font-semibold tracking-wide text-foreground transition-colors hover:border-ring focus:border-ring focus:outline-none"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  aria-label="Visibilidade dos eventos"
                  title="Visibilidade dos eventos"
                >
                  <option value="all">{t('seeAll')}</option>
                  <option value="private">{t('onlyPrivate')}</option>
                  <option value="public">{t('onlyPublic')}</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              </div>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => { clearEventCache(); reload(); refreshCategoriesInUse() }} title={t('refresh')}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span className="max-[980px]:hidden">{t('refresh')}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportCurrentView} title={t('export')}>
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            <span className="max-[980px]:hidden">{t('export')}</span>
          </Button>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setApprovalsOpen(true)} title={t('approvals')}>
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              <span className="max-[980px]:hidden">{t('approvals')}</span>
            </Button>
          )}
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => { setManageView('home'); setManageOpen(true) }} title={t('admin')}>
              <Settings className="h-4 w-4" aria-hidden="true" />
              <span className="max-[980px]:hidden">{t('admin')}</span>
            </Button>
          )}
          {isAuthenticated ? (
            <Button variant="outline" size="sm" onClick={handleLogout} title={`${user.name || user.email} (${user.role})`}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="max-[980px]:hidden">{t('signOut')}</span>
            </Button>
          ) : (
            <Button size="sm" onClick={() => setLoginOpen(true)} title={t('signIn')}>
              <Lock className="h-4 w-4" aria-hidden="true" />
              <span className="max-[980px]:hidden">{t('signIn')}</span>
            </Button>
          )}
          <select
            className="cursor-pointer rounded-md border border-input bg-background px-1.5 py-[5px] text-[11px] font-semibold uppercase text-foreground outline-none hover:border-ring"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            aria-label={t('language')}
            title={t('language')}
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>{l.code.toUpperCase()}</option>
            ))}
          </select>
          <ThemeToggle isDark={isDark} onToggle={toggle} />
        </div>
      </header>

      <StatusLights />

      {/* ── Shell: sidebar navy + calendário ─────────────────────── */}
      <div className="flex min-h-0 flex-1">
        <CalendarSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          selectedKey={selectedKey}
          dayEvents={dayEvents}
          onSelectEvent={(evt) => { setDetailEvent(evt); setSidebarOpen(false) }}
          canManage={canManage}
          onNewEvent={() => { setManageView('form'); setManageOpen(true); setSidebarOpen(false) }}
          onExportDay={() =>
            setExportData({ events: dayEvents, filename: `cclx-${selectedKey}.ics` })
          }
          community={community}
          onCommunityChange={setCommunity}
          communities={communities}
          category={category}
          onCategoryChange={setCategory}
          categoriesInUse={categoriesInUse}
          privacyTag={privacyTag}
          onPrivacyTagChange={setPrivacyTag}
          privacyTags={privacyTagsInUse}
        />

        <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          {/* ── Cabeçalho: navegação + vistas ───────────────────── */}
          <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-[18px] py-3 max-[980px]:px-3 max-[980px]:py-2.5 max-[600px]:gap-2 max-[600px]:px-2.5 max-[600px]:py-2">
            <div className="flex items-center gap-2 max-[600px]:gap-[5px]">
              <Button
                variant="outline"
                size="icon"
                className="hidden h-8 w-8 max-[980px]:inline-flex"
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menu lateral"
                title="Menu"
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="hidden h-8 w-8 min-[981px]:inline-flex"
                onClick={() => setSidebarCollapsed((c) => !c)}
                aria-label={sidebarCollapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}
                title={sidebarCollapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}
              >
                {sidebarCollapsed
                  ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
                  : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)} aria-label="Anterior">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)} aria-label="Próximo">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="min-w-[160px] text-center text-base font-bold uppercase tracking-wider text-foreground max-[980px]:min-w-[90px] max-[980px]:text-[13px]">{periodLabel()}</span>
              <Button variant="outline" size="sm" onClick={goToday}>{t('today')}</Button>
            </div>

            <nav className="flex flex-wrap gap-1" aria-label="Vista do calendário">
              {VIEWS.map(v => (
                <button key={v}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors max-[980px]:px-2.5',
                    view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                  onClick={() => setView(v)}
                  aria-current={view === v ? 'page' : undefined}
                >
                  <i className={`ti ${VIEW_META[v].icon} text-[15px]`} aria-hidden="true" />
                  <span className="max-[980px]:hidden">{t(`view.${v}`)}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* ── Calendar body ─────────────────────────────────────── */}
          <main className="flex-1 overflow-auto">
            {loading && <CalendarLoading />}

            {error && (
              <div className="flex flex-col items-center justify-center gap-3 px-5 py-20 text-xs uppercase tracking-wide text-destructive">
                <AlertCircle className="h-7 w-7" aria-hidden="true" />
                <span>{error}</span>
                <Button variant="outline" size="sm" onClick={() => reload()}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  <span>{t('retry')}</span>
                </Button>
              </div>
            )}

            {!loading && !error && (
              <>
                {periodEventCount === 0 && (
                  <div className="flex flex-col items-center justify-center gap-3 px-5 py-20 text-xs uppercase tracking-wide text-muted-foreground">
                    <CalendarX className="h-7 w-7" aria-hidden="true" />
                    <span>{t('noEventsPeriod')}</span>
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
                    onSelectEvent={(evt) => setDetailEvent(evt)}
                  />
                )}

                {view === 'quarter' && (
                  <div className="grid grid-cols-3 gap-4 p-5 max-[980px]:grid-cols-1">
                    {getMonthRange(3).map(({ year: y, month: m }) => (
                      <MiniMonth key={`${y}-${m}`} year={y} month={m}
                        eventsByDate={filteredByDate} size="md"
                        onDayClick={(dateKey, evts) => { selectDay(dateKey); setDayPopup({ dateKey, events: evts }) }}
                      />
                    ))}
                  </div>
                )}

                {view === 'semester' && (
                  <div className="grid grid-cols-3 gap-3 p-5 max-[980px]:grid-cols-2 max-[600px]:grid-cols-1">
                    {getMonthRange(6).map(({ year: y, month: m }) => (
                      <MiniMonth key={`${y}-${m}`} year={y} month={m}
                        eventsByDate={filteredByDate} size="sm"
                        onDayClick={(dateKey, evts) => { selectDay(dateKey); setDayPopup({ dateKey, events: evts }) }}
                      />
                    ))}
                  </div>
                )}

                {view === 'year' && (
                  <div className="grid grid-cols-4 gap-2.5 p-5 max-[980px]:grid-cols-3 max-[600px]:grid-cols-2">
                    {Array.from({ length: 12 }, (_, i) => (
                      <MiniMonth key={i} year={year} month={i}
                        eventsByDate={filteredByDate} size="xs"
                        onDayClick={(dateKey, evts) => { selectDay(dateKey); setDayPopup({ dateKey, events: evts }) }}
                      />
                    ))}
                  </div>
                )}

                {view === 'list' && (
                  <ListView
                    year={year}
                    events={filteredEvents.filter((e) => e.date >= from && e.date <= to)}
                    onSelectEvent={(evt) => setDetailEvent(evt)}
                  />
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

      {/* ── Popup de dia (vistas multi-mês) ──────────────────────── */}
      <AnimatePresence>
        {dayPopup && (
          <DayPopup
            dateKey={dayPopup.dateKey}
            events={dayPopup.events}
            onClose={() => setDayPopup(null)}
            onSelectEvent={(evt) => { setDayPopup(null); setDetailEvent(evt) }}
            onExport={(evts, filename) => setExportData({ events: evts, filename })}
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
      {/* ── Painel de aprovações ──────────────────── */}
      <AnimatePresence>
        {approvalsOpen && (
          <ApprovalsPanel
            onClose={() => setApprovalsOpen(false)}
            onChanged={() => { clearEventCache(); reload() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
