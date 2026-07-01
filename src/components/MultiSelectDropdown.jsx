import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * MultiSelectDropdown — botão no estilo <select> que abre um painel com opções
 * marcáveis (checkbox) para escolher VÁRIAS. Seleção vazia = "Todas" (allLabel).
 * O painel fica no fluxo normal (empurra o conteúdo) para não ser cortado pelo
 * scroll da sidebar. Fecha ao clicar fora ou premir Escape.
 */
export default function MultiSelectDropdown({
  options = [],
  selected = [],
  onChange,
  allLabel = 'Todas',
  icon: Icon,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = (val) =>
    onChange(selected.includes(val) ? selected.filter((x) => x !== val) : [...selected, val])

  const label =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? selected[0]
        : `${selected.length} selecionadas`

  return (
    <div ref={ref}>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-2.5 py-2.5 text-left text-[13px] font-semibold text-foreground outline-none transition-colors hover:border-ring focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />}
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
        <ChevronDown
          className={cn('h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className="mt-1 max-h-[240px] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
          role="listbox"
        >
          <Option checked={selected.length === 0} label={allLabel} onClick={() => onChange([])} />
          {options.map((opt) => (
            <Option key={opt} checked={selected.includes(opt)} label={opt} onClick={() => toggle(opt)} />
          ))}
        </div>
      )}
    </div>
  )
}

function Option({ checked, label, onClick }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={checked}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-[5px] px-2 py-1.5 text-left text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        checked && 'text-foreground',
      )}
    >
      <span
        className={cn(
          'flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded-[4px] border transition-colors',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background',
        )}
      >
        {checked && <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />}
      </span>
      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
    </button>
  )
}
