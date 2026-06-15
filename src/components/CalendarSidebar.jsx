import {
  parseDateKey, MONTHS_PT, WEEKDAYS_FULL, CATEGORY_META, STATUS_META,
} from '../utils/calendarHelpers'
import styles from './CalendarSidebar.module.css'

// Categorias pela ordem de apresentação na lista "Calendários".
const CATEGORY_ORDER = ['culto', 'jovens', 'formacao', 'evento']

// Cores vivas para os pontos sobre o fundo navy (independentes do tema).
const CAT_DOT = {
  culto: '#F5A800',
  jovens: '#6fa8ff',
  formacao: '#5db87a',
  evento: '#b8c0d8',
}

/**
 * CalendarSidebar — coluna lateral (navy) com o dia selecionado, a lista de
 * eventos desse dia e os filtros (igreja + categorias), ao estilo da referência.
 */
export default function CalendarSidebar({
  selectedKey,
  dayEvents,
  onSelectEvent,
  canManage,
  onNewEvent,
  onExportDay,
  community,
  onCommunityChange,
  communities,
  category,
  onCategoryChange,
}) {
  const { year, month, day } = parseDateKey(selectedKey)
  const date = new Date(year, month, day)
  const weekday = WEEKDAYS_FULL[(date.getDay() + 6) % 7]
  const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1)

  return (
    <aside className={styles.sidebar}>
      {canManage && (
        <button type="button" className={styles.newBtn} onClick={onNewEvent}>
          <i className="ti ti-plus" aria-hidden="true" />
          <span>Novo evento</span>
        </button>
      )}

      <div className={styles.dayHead}>
        <div className={styles.dayHeadText}>
          <div className={styles.weekday}>{weekdayCap}</div>
          <div className={styles.dayDate}>
            {day} {MONTHS_PT[month]}
          </div>
        </div>
        {dayEvents.length > 0 && (
          <button
            type="button"
            className={styles.exportBtn}
            onClick={onExportDay}
            title="Exportar dia para calendário"
            aria-label="Exportar dia"
          >
            <i className="ti ti-calendar-share" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Eventos</div>
        {dayEvents.length === 0 ? (
          <p className={styles.empty}>Sem eventos neste dia.</p>
        ) : (
          <ul className={styles.evtList}>
            {dayEvents.map((evt) => {
              const st = STATUS_META[evt.status]
              return (
                <li key={evt.id}>
                  <button type="button" className={`${styles.evtItem} ${st ? styles.evtItemDraft : ''}`} onClick={() => onSelectEvent(evt)}>
                    <span className={styles.evtTime}>{evt.timeStart || '—'}</span>
                    <span
                      className={styles.evtDot}
                      style={{ background: CAT_DOT[evt.category] || CAT_DOT.evento }}
                    />
                    <span className={styles.evtName}>{evt.title}</span>
                    {st && (
                      <span className={styles.evtStatus} title={st.label} aria-label={st.label}>
                        <i className={`ti ${st.icon}`} aria-hidden="true" />
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Igreja</div>
        <div className={styles.selectWrap}>
          <i className="ti ti-building-church" aria-hidden="true" />
          <select
            className={styles.select}
            value={community}
            onChange={(e) => onCommunityChange(e.target.value)}
            aria-label="Filtrar por igreja"
          >
            <option value="Todas">Todas as igrejas</option>
            {communities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Categorias automáticas</div>
        <ul className={styles.calList}>
          <li>
            <button
              type="button"
              className={`${styles.calItem} ${category === 'Todos' ? styles.calActive : ''}`}
              onClick={() => onCategoryChange('Todos')}
            >
              <span className={styles.calDot} style={{ background: CAT_DOT.culto }} />
              <span className={styles.calName}>Todos</span>
              {category === 'Todos' && <i className="ti ti-check" aria-hidden="true" />}
            </button>
          </li>
          {CATEGORY_ORDER.map((key) => {
            const active = category === key
            return (
              <li key={key}>
                <button
                  type="button"
                  className={`${styles.calItem} ${active ? styles.calActive : ''}`}
                  onClick={() => onCategoryChange(active ? 'Todos' : key)}
                >
                  <span className={styles.calDot} style={{ background: CAT_DOT[key] }} />
                  <span className={styles.calName}>{CATEGORY_META[key].label}</span>
                  {active && <i className="ti ti-check" aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
