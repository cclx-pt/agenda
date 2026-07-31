import { useRef, useEffect } from 'react'
import { Bold, Italic, Underline } from 'lucide-react'
import { sanitizeInviteHtml, looksLikeHtml, escapeText } from './richTextUtils'

// Mini-editor de texto rico (negrito/itálico/sublinhado + tipo e tamanho de
// letra). Guarda HTML simples; a renderização pública sanitiza (ver RichText).

const FONTS = [
  { label: 'Tipo de letra', value: '' },
  { label: 'Padrão', value: 'inherit' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times', value: '"Times New Roman", serif' },
  { label: 'Courier', value: '"Courier New", monospace' },
]
const SIZES = [
  { label: 'Tamanho', value: '' },
  { label: 'Pequeno', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Médio', value: '4' },
  { label: 'Grande', value: '5' },
  { label: 'Muito grande', value: '6' },
]

const toolBtn =
  'inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-background text-foreground transition-colors hover:bg-accent'
const toolSel = 'h-8 rounded border border-input bg-background px-1.5 text-xs text-foreground'

function toHtml(value) {
  if (!value) return ''
  return looksLikeHtml(value) ? value : escapeText(value).replace(/\n/g, '<br>')
}

export function RichTextEditor({ value, onChange, placeholder, minRows = 3 }) {
  const ref = useRef(null)
  const last = useRef(undefined)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Só re-semeia quando o valor externo muda (evita saltar o cursor a escrever).
    if (value !== last.current) {
      const html = toHtml(value)
      if (el.innerHTML !== html) el.innerHTML = html
      last.current = value
    }
  }, [value])

  const emit = () => {
    const html = ref.current?.innerHTML ?? ''
    last.current = html
    onChange(html)
  }
  const exec = (cmd, arg) => {
    ref.current?.focus()
    document.execCommand(cmd, false, arg)
    emit()
  }
  const isEmpty = !value || value === '<br>' || value === '<div><br></div>'

  return (
    <div className="rounded-lg border border-input bg-background focus-within:border-ring">
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-1">
        <button type="button" className={toolBtn} title="Negrito" aria-label="Negrito" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}>
          <Bold className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className={toolBtn} title="Itálico" aria-label="Itálico" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')}>
          <Italic className="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" className={toolBtn} title="Sublinhado" aria-label="Sublinhado" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')}>
          <Underline className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <select
          className={toolSel}
          title="Tipo de letra"
          aria-label="Tipo de letra"
          value=""
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            if (e.target.value) exec('fontName', e.target.value)
          }}
        >
          {FONTS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          className={toolSel}
          title="Tamanho da letra"
          aria-label="Tamanho da letra"
          value=""
          onChange={(e) => {
            if (e.target.value) exec('fontSize', e.target.value)
          }}
        >
          {SIZES.map((s) => (
            <option key={s.label} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="relative">
        {isEmpty && placeholder ? (
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground/60">{placeholder}</span>
        ) : null}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder || 'Editor de texto'}
          className="px-3 py-2 text-sm leading-relaxed text-foreground focus:outline-none [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
          style={{ minHeight: `${minRows * 1.6 + 1}rem` }}
        />
      </div>
    </div>
  )
}

// Renderiza HTML sanitizado (ou texto simples com quebras de linha) de um campo
// de texto rico. Devolve null quando vazio.
export function RichText({ value, className }) {
  if (!value) return null
  const html = looksLikeHtml(value) ? sanitizeInviteHtml(value) : escapeText(value).replace(/\n/g, '<br>')
  if (!html) return null
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
