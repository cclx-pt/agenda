import { useMemo } from 'react'
import { MapPin, Paperclip } from 'lucide-react'
import {
  MONTHS_PT,
  WEEKDAYS_SHORT,
  CATEGORY_META,
  STATUS_META,
  API_BADGE,
  formatTimeRange,
  parseDateKey,
} from '../utils/calendarHelpers'

// Índice do dia da semana (0=Seg … 6=Dom) a partir de uma chave YYYY-MM-DD.
function weekdayShort(dateKey) {
  const { year, month, day } = parseDateKey(dateKey)
  return WEEKDAYS_SHORT[(new Date(year, month, day).getDay() + 6) % 7]
}

/**
 * ListView — agenda "plana" com os eventos do ano ordenados por data e
 * agrupados por mês. Cada linha abre o detalhe do evento ao clicar.
 */
export default function ListView({ year, events, onSelectEvent }) {
  const groups = useMemo(() => {
    const sorted = [...events].sort((a, b) =>
      a.startDatetime < b.startDatetime ? -1 : a.startDatetime > b.startDatetime ? 1 : 0
    )
    const byMonth = new Map()
    for (const e of sorted) {
      const m = Number(e.date.slice(5, 7)) - 1 // mês (0-11) a partir de YYYY-MM-DD
      if (!byMonth.has(m)) byMonth.set(m, [])
      byMonth.get(m).push(e)
    }
    return Array.from(byMonth.entries()).sort((a, b) => a[0] - b[0])
  }, [events])

  if (groups.length === 0) return null

  return (
    <div className="flex flex-col gap-6 p-5 max-[600px]:gap-4 max-[600px]:p-3">
      {groups.map(([m, evs]) => (
        <section key={m} className="flex flex-col gap-1.5">
          <h2 className="sticky top-0 z-[1] mb-1 flex items-center gap-2 border-b border-border bg-background/95 py-2 text-sm font-bold uppercase tracking-wider text-foreground backdrop-blur">
            {MONTHS_PT[m]} {year}
            <span className="text-xs font-semibold normal-case text-muted-foreground">
              · {evs.length} evento{evs.length === 1 ? '' : 's'}
            </span>
          </h2>

          <ul className="flex list-none flex-col gap-1.5 p-0">
            {evs.map((e) => {
              const cat = CATEGORY_META[e.category] || CATEGORY_META.evento
              const status = STATUS_META[e.status]
              const { day } = parseDateKey(e.date)
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEvent(e)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex w-10 flex-shrink-0 flex-col items-center">
                      <span className="text-lg font-bold leading-none tabular-nums text-foreground">{day}</span>
                      <span className="mt-0.5 text-[10px] uppercase text-muted-foreground">{weekdayShort(e.date)}</span>
                    </div>

                    <span
                      className="h-9 w-1 flex-shrink-0 rounded"
                      style={{ background: cat.colorVar }}
                      aria-hidden="true"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">{e.title}</div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span className="tabular-nums">{formatTimeRange(e.timeStart, e.timeEnd) || 'Dia inteiro'}</span>
                        {e.responsible ? <span>· {e.responsible}</span> : null}
                        {e.location ? <span className="truncate">· {e.location}</span> : null}
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {e.mapUrl && <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-label="Mapa" />}
                      {e.attachmentUrl && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-label="Anexo" />}
                      {status && (
                        <span className="inline-flex items-center gap-1 rounded-sm border border-dashed border-amber-500/60 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-700">
                          <i className={`ti ${status.icon}`} aria-hidden="true" />
                          <span className="max-[600px]:hidden">{status.label}</span>
                        </span>
                      )}
                      {e.isApi && (
                        <span className="rounded-sm bg-blue-500 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white" title={API_BADGE.title}>
                          {API_BADGE.label}
                        </span>
                      )}
                      <span
                        className="hidden h-2 w-2 flex-shrink-0 rounded-full sm:block"
                        style={{ background: cat.colorVar }}
                        title={cat.label}
                        aria-hidden="true"
                      />
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
