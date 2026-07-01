import {
  parseDateKey, MONTHS_PT, WEEKDAYS_FULL, CATEGORY_META, STATUS_META, API_BADGE,
} from '../utils/calendarHelpers'
import { CalendarPlus, Check, Church, Lock, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Categorias pela ordem de apresentação na lista "Calendários".
const CATEGORY_ORDER = ['culto', 'jovens', 'formacao', 'evento', 'aplicacao']

// Cores vivas para os pontos sobre o fundo navy (independentes do tema).
const CAT_DOT = {
  culto: '#F5A800',
  jovens: '#6fa8ff',
  formacao: '#5db87a',
  evento: '#b8c0d8',
  aplicacao: '#818cf8',
}

/**
 * CalendarSidebar — coluna lateral (navy) com o dia selecionado, a lista de
 * eventos desse dia e os filtros (igreja + categorias), ao estilo da referência.
 */
export default function CalendarSidebar({
  open,
  onClose,
  collapsed,
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
  categoriesInUse,
  privacyTag,
  onPrivacyTagChange,
  privacyTags,
}) {
  const { year, month, day } = parseDateKey(selectedKey)
  const date = new Date(year, month, day)
  const weekday = WEEKDAYS_FULL[(date.getDay() + 6) % 7]
  const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1)

  // Só mostra as categorias que existem em eventos na BD (qualquer estado).
  const inUse = Array.isArray(categoriesInUse) ? categoriesInUse : []
  const visibleCategories = [
    ...CATEGORY_ORDER.filter((k) => inUse.includes(k)),
    ...inUse.filter((c) => !CATEGORY_ORDER.includes(c)),
  ]

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[55] hidden bg-black/45 transition-opacity duration-200 max-[980px]:block',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />
    <aside className={cn(
      collapsed ? 'hidden max-[980px]:flex' : 'flex',
      'w-[280px] flex-shrink-0 flex-col gap-[22px] overflow-y-auto border-r border-border bg-card p-4 pb-6 pt-[18px] text-foreground max-[980px]:fixed max-[980px]:inset-y-0 max-[980px]:left-0 max-[980px]:z-[60] max-[980px]:w-[min(86%,320px)] max-[980px]:pt-14 max-[980px]:transition-transform max-[980px]:duration-200',
      open ? 'max-[980px]:translate-x-0 max-[980px]:shadow-2xl' : 'max-[980px]:-translate-x-full',
    )}>
      <button
        type="button"
        className="absolute right-3 top-3 hidden h-[34px] w-[34px] items-center justify-center rounded-md border border-border bg-muted text-foreground transition-colors hover:border-ring max-[980px]:inline-flex"
        onClick={onClose}
        aria-label="Fechar menu"
      >
        <X className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
      {canManage && (
        <Button type="button" className="w-full" onClick={onNewEvent}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Novo evento</span>
        </Button>
      )}

      <div className="flex items-start justify-between gap-2.5 border-b border-border pb-4">
        <div>
          <div className="text-[26px] font-bold capitalize leading-tight">{weekdayCap}</div>
          <div className="mt-0.5 text-[13px] font-semibold tracking-wide text-muted-foreground">
            {day} {MONTHS_PT[month]}
          </div>
        </div>
        {dayEvents.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-[30px] w-[30px] flex-shrink-0"
            onClick={onExportDay}
            title="Exportar dia para calendário"
            aria-label="Exportar dia"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Eventos</div>
        {dayEvents.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">Sem eventos neste dia.</p>
        ) : (
          <ul className="flex list-none flex-col gap-[3px]">
            {dayEvents.map((evt) => {
              const st = STATUS_META[evt.status]
              return (
                <li key={evt.id}>
                  <button type="button" className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent',
                    st && 'bg-destructive/15 hover:bg-destructive/25',
                  )} onClick={() => onSelectEvent(evt)}>
                    <span className="min-w-[38px] text-[11px] font-bold tabular-nums text-muted-foreground">{evt.timeStart || '—'}</span>
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: CAT_DOT[evt.category] || CAT_DOT.evento }}
                    />
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold">{evt.title}</span>
                    {st && (
                      <span className="ml-auto inline-flex flex-shrink-0 items-center text-[13px] text-amber-600" title={st.label} aria-label={st.label}>
                        <i className={`ti ${st.icon}`} aria-hidden="true" />
                      </span>
                    )}
                    {evt.isApi && (
                      <span className="ml-auto flex-shrink-0 rounded bg-blue-500 px-1.5 py-px text-[9px] font-extrabold tracking-wide text-white" title={API_BADGE.title}>{API_BADGE.label}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Igreja</div>
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5">
          <Church className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          <select
            className="min-w-0 flex-1 cursor-pointer appearance-none border-none bg-transparent py-2.5 pl-0 pr-1 text-[13px] font-semibold text-foreground outline-none"
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

      {Array.isArray(privacyTags) && privacyTags.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Privacidade</div>
          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2.5">
            <Lock className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            <select
              className="min-w-0 flex-1 cursor-pointer appearance-none border-none bg-transparent py-2.5 pl-0 pr-1 text-[13px] font-semibold text-foreground outline-none"
              value={privacyTag}
              onChange={(e) => onPrivacyTagChange(e.target.value)}
              aria-label="Filtrar por etiqueta de privacidade"
            >
              <option value="Todas">Todas as etiquetas</option>
              {privacyTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Categorias</div>
        <ul className="flex list-none flex-col gap-[3px]">
          <li>
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                category === 'Todos' && 'text-foreground',
              )}
              onClick={() => onCategoryChange('Todos')}
            >
              <span className="h-[11px] w-[11px] flex-shrink-0 rounded-sm" style={{ background: CAT_DOT.culto }} />
              <span className="flex-1">Todos</span>
              {category === 'Todos' && <Check className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />}
            </button>
          </li>
          {visibleCategories.map((key) => {
            const active = category === key
            return (
              <li key={key}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                    active && 'text-foreground',
                  )}
                  onClick={() => onCategoryChange(active ? 'Todos' : key)}
                >
                  <span className="h-[11px] w-[11px] flex-shrink-0 rounded-sm" style={{ background: CAT_DOT[key] || '#94a3b8' }} />
                  <span className="flex-1">{CATEGORY_META[key]?.label || key}</span>
                  {active && <Check className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
    </>
  )
}
