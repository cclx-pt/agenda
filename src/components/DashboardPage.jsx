import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { useEvents } from '../hooks/useEvents'
import { useModalA11y } from '../hooks/useModalA11y'
import { CATEGORY_META, MONTHS_SHORT } from '../utils/calendarHelpers'
import { compareChurches } from '../utils/churches'
import styles from './DashboardPage.module.css'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

// ─── Paleta CCLX (teal + dourado) ─────────────────────────────────
const TEAL = '#11505E'
const TEAL_2 = '#2A8290'
const GOLD = '#E2A32C'
const GREEN = '#3E8E5A'
const SKY = '#4FA3D1'

// Cor por categoria de evento (doughnut).
const CATEGORY_COLORS = {
  culto: GOLD,
  evento: TEAL,
  formacao: GREEN,
  jovens: SKY,
}

const nf = new Intl.NumberFormat('pt-PT')
const nf1 = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export default function DashboardPage({ onClose }) {
  const { isDark } = useTheme()
  const { user, isAuthenticated, canViewPrivate } = useAuth()
  const dialogRef = useModalA11y(onClose)

  const canManage = isAuthenticated && ['admin', 'aprovador', 'editor'].includes(user?.role)
  const includePrivate = canViewPrivate
  const includeDrafts = canManage

  const [year, setYear] = useState(new Date().getFullYear())
  const from = `${year}-01-01`
  const to = `${year}-12-31`
  const { events, loading, error, reload } = useEvents({ from, to, includePrivate, includeDrafts })

  // ─── Agregações ────────────────────────────────────────────────
  const stats = useMemo(() => {
    const byMonth = Array(12).fill(0)
    const byCategory = {}
    const byChurch = {}
    for (const e of events) {
      const m = Number(e.date.slice(5, 7)) - 1
      if (m >= 0 && m < 12) byMonth[m] += 1
      byCategory[e.category] = (byCategory[e.category] || 0) + 1
      const c = e.community || 'Sem igreja'
      byChurch[c] = (byChurch[c] || 0) + 1
    }
    const total = events.length
    const cultos = byCategory.culto || 0
    const churches = Object.keys(byChurch).filter((c) => c !== 'Sem igreja')
    const busiestIdx = byMonth.reduce((best, v, i) => (v > byMonth[best] ? i : best), 0)
    const sortedChurches = Object.keys(byChurch).sort(compareChurches)
    return {
      total,
      cultos,
      byMonth,
      byCategory,
      byChurch,
      activeChurches: churches.length,
      busiestMonth: total ? MONTHS_SHORT[busiestIdx] : '—',
      busiestCount: byMonth[busiestIdx] || 0,
      avgPerMonth: total / 12,
      sortedChurches,
    }
  }, [events])

  // ─── Cores adaptadas ao tema ───────────────────────────────────
  const tick = isDark ? '#9aa6c6' : '#6E6E6E'
  const grid = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(20,50,59,0.07)'

  const baseScales = {
    x: { ticks: { color: tick, font: { family: 'Barlow' } }, grid: { display: false } },
    y: { ticks: { color: tick, font: { family: 'Barlow' }, precision: 0 }, grid: { color: grid }, beginAtZero: true },
  }
  const tooltipStyle = {
    backgroundColor: TEAL,
    titleColor: '#fff',
    bodyColor: '#fff',
    padding: 10,
    cornerRadius: 8,
    displayColors: false,
  }

  // ─── Datasets ──────────────────────────────────────────────────
  const monthData = {
    labels: MONTHS_SHORT,
    datasets: [{ label: 'Eventos', data: stats.byMonth, backgroundColor: TEAL, hoverBackgroundColor: TEAL_2, borderRadius: 6, maxBarThickness: 38 }],
  }
  const categoryKeys = Object.keys(stats.byCategory)
  const categoryData = {
    labels: categoryKeys.map((k) => CATEGORY_META[k]?.label || k),
    datasets: [{
      data: categoryKeys.map((k) => stats.byCategory[k]),
      backgroundColor: categoryKeys.map((k) => CATEGORY_COLORS[k] || TEAL_2),
      borderColor: isDark ? '#1c1c1c' : '#fff',
      borderWidth: 3,
      hoverOffset: 6,
    }],
  }
  const churchData = {
    labels: stats.sortedChurches,
    datasets: [{ label: 'Eventos', data: stats.sortedChurches.map((c) => stats.byChurch[c]), backgroundColor: TEAL, hoverBackgroundColor: GOLD, borderRadius: 6, maxBarThickness: 26 }],
  }

  const kpis = [
    { tone: 'teal', big: nf.format(stats.total), label: 'Eventos no ano' },
    { tone: 'gold', big: nf.format(stats.cultos), label: 'Celebrações' },
    { tone: 'green', big: nf.format(stats.activeChurches), label: 'Igrejas ativas' },
    { tone: 'sky', big: stats.busiestMonth, label: `Mês mais cheio · ${nf.format(stats.busiestCount)}` },
    { tone: 'terra', big: nf1.format(stats.avgPerMonth), label: 'Média por mês' },
  ]

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        className={styles.panel}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dash-title"
        tabIndex={-1}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.18 }}
      >
        {/* ── Cabeçalho ─────────────────────────────────────────── */}
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Comunidade Cristã de Lisboa · Agenda</p>
            <h1 id="dash-title" className={styles.title}>
              Painel · <span className={styles.accent}>Estatísticas</span>
            </h1>
            <p className={styles.sub}>Visão geral dos eventos da agenda por mês, categoria e igreja.</p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.yearNav}>
              <button className={styles.navBtn} onClick={() => setYear((y) => y - 1)} aria-label="Ano anterior">
                <i className="ti ti-chevron-left" aria-hidden="true" />
              </button>
              <span className={styles.yearLabel}>{year}</span>
              <button className={styles.navBtn} onClick={() => setYear((y) => y + 1)} aria-label="Ano seguinte">
                <i className="ti ti-chevron-right" aria-hidden="true" />
              </button>
            </div>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar painel">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className={styles.rule} />

        {/* ── Estados ───────────────────────────────────────────── */}
        {loading && (
          <div className={styles.stateBox}>
            <i className={`ti ti-loader-2 ${styles.spin}`} aria-hidden="true" />
            <span>A carregar estatísticas…</span>
          </div>
        )}
        {error && !loading && (
          <div className={styles.stateBox}>
            <i className="ti ti-alert-circle" aria-hidden="true" />
            <span>{error}</span>
            <button className={styles.retryBtn} onClick={() => reload()}>
              <i className="ti ti-refresh" aria-hidden="true" /> Tentar novamente
            </button>
          </div>
        )}
        {!loading && !error && stats.total === 0 && (
          <div className={styles.stateBox}>
            <i className="ti ti-calendar-off" aria-hidden="true" />
            <span>Sem eventos em {year}.</span>
          </div>
        )}

        {/* ── Conteúdo ──────────────────────────────────────────── */}
        {!loading && !error && stats.total > 0 && (
          <>
            <div className={styles.kpiRow}>
              {kpis.map((k) => (
                <div key={k.label} className={`${styles.kpi} ${styles[k.tone]}`}>
                  <div className={styles.kpiBig}>{k.big}</div>
                  <div className={styles.kpiLabel}>{k.label}</div>
                </div>
              ))}
            </div>

            <div className={styles.chartRow}>
              <section className={`${styles.card} ${styles.cardWide}`}>
                <h2 className={styles.cardTitle}>Eventos por mês</h2>
                <div className={styles.chartBox}>
                  <Bar
                    data={monthData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false }, tooltip: tooltipStyle },
                      scales: baseScales,
                    }}
                  />
                </div>
              </section>

              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Composição por categoria</h2>
                <div className={styles.chartBox}>
                  <Doughnut
                    data={categoryData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      cutout: '62%',
                      plugins: {
                        legend: { position: 'bottom', labels: { color: tick, font: { family: 'Barlow' }, padding: 14, usePointStyle: true, pointStyle: 'circle' } },
                        tooltip: tooltipStyle,
                      },
                    }}
                  />
                </div>
              </section>
            </div>

            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Eventos por igreja</h2>
              <div className={styles.chartBoxTall}>
                <Bar
                  data={churchData}
                  options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: tooltipStyle },
                    scales: {
                      x: { ticks: { color: tick, font: { family: 'Barlow' }, precision: 0 }, grid: { color: grid }, beginAtZero: true },
                      y: { ticks: { color: tick, font: { family: 'Barlow' } }, grid: { display: false } },
                    },
                  }}
                />
              </div>
            </section>

            <p className={styles.foot}>
              {nf.format(stats.total)} eventos · {stats.activeChurches} igrejas · ano {year}
            </p>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
