import { useState, useMemo } from 'react'
import { useTheme } from './hooks/useTheme'
import { useEvents } from './hooks/useEvents'
import { Toaster, toast } from 'sonner'
import { AnimatePresence } from 'framer-motion'
import ThemeToggle from './components/ThemeToggle'
import MonthView from './components/MonthView'
import MiniMonth from './components/MiniMonth'
import DayPopup from './components/DayPopup'
import EventDetail from './components/EventDetail'
import ExportModal from './components/ExportModal'
import SearchBar from './components/SearchBar'
import CommunityFilter from './components/CommunityFilter'
import {
  MONTHS_PT, MONTHS_SHORT,
} from './utils/calendarHelpers'
import logoUrl from './assets/cclx_line_logo.png'
import styles from './App.module.css'

const VIEWS = ['month', 'quarter', 'semester', 'year']
const VIEW_LABELS = { month: 'Mensal', quarter: 'Trimestral', semester: 'Semestral', year: 'Anual' }

export default function App() {
  const { theme, toggle, isDark } = useTheme()
  const { events, eventsByDate, loading, error } = useEvents()

  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [view,  setView]  = useState('month')

  const [dayPopup,     setDayPopup]     = useState(null)   // { dateKey, events }
  const [detailEvent,  setDetailEvent]  = useState(null)   // event object
  const [exportData,   setExportData]   = useState(null)   // { events, filename }
  const [community,    setCommunity]    = useState('Todas') // church filter

  // ─── Filtered events by community ────────────────────────────
  const filteredEvents = useMemo(() => {
    if (community === 'Todas') return events
    return events.filter(e => e.community === community)
  }, [events, community])

  const filteredByDate = useMemo(() => {
    if (community === 'Todas') return eventsByDate
    const map = {}
    for (const e of filteredEvents) {
      ;(map[e.date] ??= []).push(e)
    }
    return map
  }, [filteredEvents, eventsByDate, community])

  // ─── Navigation ──────────────────────────────────────────────────
  const navigate = (dir) => {
    if (view === 'month') {
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

  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()) }

  // ─── Period label ────────────────────────────────────────────────
  const periodLabel = () => {
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
    let filtered = []
    if (view === 'month') {
      filtered = filteredEvents.filter(e => {
        const d = new Date(e.date)
        return d.getFullYear() === year && d.getMonth() === month
      })
    } else if (view === 'quarter') {
      const months = getMonthRange(3)
      filtered = filteredEvents.filter(e => {
        const d = new Date(e.date)
        return months.some(m => m.year === d.getFullYear() && m.month === d.getMonth())
      })
    } else if (view === 'semester') {
      const months = getMonthRange(6)
      filtered = filteredEvents.filter(e => {
        const d = new Date(e.date)
        return months.some(m => m.year === d.getFullYear() && m.month === d.getMonth())
      })
    } else {
      filtered = filteredEvents.filter(e => new Date(e.date).getFullYear() === year)
    }
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

        <div className={styles.navCenter}>
          <button className={styles.navBtn} onClick={() => navigate(-1)} aria-label="Anterior">
            <i className="ti ti-chevron-left" aria-hidden="true" />
          </button>
          <span className={styles.periodLabel}>{periodLabel()}</span>
          <button className={styles.navBtn} onClick={() => navigate(1)} aria-label="Próximo">
            <i className="ti ti-chevron-right" aria-hidden="true" />
          </button>
          <button className={styles.todayBtn} onClick={goToday}>Hoje</button>
        </div>

        <div className={styles.topRight}>
          <CommunityFilter events={events} value={community} onChange={setCommunity} />
          <SearchBar events={filteredEvents} onSelect={(evt) => setDetailEvent(evt)} />
          <button className={styles.icsExportBtn} onClick={exportCurrentView}
            title="Exportar vista atual">
            <i className="ti ti-calendar-share" aria-hidden="true" />
            <span>Exportar</span>
          </button>
          <ThemeToggle isDark={isDark} onToggle={toggle} />
        </div>
      </header>

      {/* ── View tabs ────────────────────────────────────────────── */}
      <nav className={styles.viewBar} aria-label="Vista do calendário">
        {VIEWS.map(v => (
          <button key={v}
            className={`${styles.vtab} ${view === v ? styles.active : ''}`}
            onClick={() => setView(v)}
            aria-current={view === v ? 'page' : undefined}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </nav>

      {/* ── Calendar body ────────────────────────────────────────── */}
      <main className={styles.body}>
        {loading && (
          <div className={styles.loadingState}>
            <i className="ti ti-loader" aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }} />
            <span>A carregar eventos…</span>
          </div>
        )}

        {error && (
          <div className={styles.errorState}>
            <i className="ti ti-alert-circle" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && (
          <>
            {view === 'month' && (
              <MonthView
                year={year} month={month}
                eventsByDate={filteredByDate}
                onDayClick={(dateKey, evts) => setDayPopup({ dateKey, events: evts })}
              />
            )}

            {view === 'quarter' && (
              <div className={styles.multiGrid}>
                {getMonthRange(3).map(({ year: y, month: m }) => (
                  <MiniMonth key={`${y}-${m}`} year={y} month={m}
                    eventsByDate={filteredByDate} size="md"
                    onDayClick={(dateKey, evts) => setDayPopup({ dateKey, events: evts })}
                  />
                ))}
              </div>
            )}

            {view === 'semester' && (
              <div className={styles.multiGrid6}>
                {getMonthRange(6).map(({ year: y, month: m }) => (
                  <MiniMonth key={`${y}-${m}`} year={y} month={m}
                    eventsByDate={filteredByDate} size="sm"
                    onDayClick={(dateKey, evts) => setDayPopup({ dateKey, events: evts })}
                  />
                ))}
              </div>
            )}

            {view === 'year' && (
              <div className={styles.yearGrid}>
                {Array.from({ length: 12 }, (_, i) => (
                  <MiniMonth key={i} year={year} month={i}
                    eventsByDate={filteredByDate} size="xs"
                    onDayClick={(dateKey, evts) => setDayPopup({ dateKey, events: evts })}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Day popup ────────────────────────────────────────────── */}
      <AnimatePresence>
        {dayPopup && (
          <DayPopup
            dateKey={dayPopup.dateKey}
            events={dayPopup.events}
            onClose={() => setDayPopup(null)}
            onSelectEvent={(evt) => { setDetailEvent(evt) }}
            onExport={(evts, filename) => setExportData({ events: evts, filename })}
          />
        )}
      </AnimatePresence>

      {/* ── Event detail modal ───────────────────────────────────── */}
      <AnimatePresence>
        {detailEvent && (
          <EventDetail
            event={detailEvent}
            onClose={() => { setDetailEvent(null); setDayPopup(null) }}
            onBack={dayPopup ? () => setDetailEvent(null) : null}
            onExport={(evt) => setExportData({ events: [evt], filename: null })}
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
