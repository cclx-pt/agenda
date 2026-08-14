import { useRef, useState } from 'react'
import { Calendar } from 'lucide-react'

// 'YYYY-MM-DD' → formato português configurado (exibição).
function isoToDisplay(iso, separator) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  return m ? `${m[3]}${separator}${m[2]}${separator}${m[1]}` : ''
}

// Data portuguesa completa e válida → 'YYYY-MM-DD'; caso contrário null.
function displayToIso(text) {
  const digits = String(text).replace(/\D/g, '')
  if (digits.length !== 8) return null
  const dd = Number(digits.slice(0, 2))
  const mm = Number(digits.slice(2, 4))
  const yyyy = Number(digits.slice(4))
  const d = new Date(Date.UTC(yyyy, mm - 1, dd))
  // Rejeita datas impossíveis (ex.: 31/02/2026) que o Date "arruma".
  if (d.getUTCFullYear() !== yyyy || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return null
  return `${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`
}

// Aplica a máscara portuguesa aos dígitos escritos.
function maskDate(raw, separator) {
  const d = String(raw).replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}${separator}${d.slice(2)}`
  return `${d.slice(0, 2)}${separator}${d.slice(2, 4)}${separator}${d.slice(4)}`
}

/**
 * Campo de data com formato português DD/MM/AAAA garantido.
 *
 * O `<input type="date">` nativo mostra o formato do LOCALE DO BROWSER (em
 * inglês fica MM/DD/AAAA, ignorando o `lang` da página), pelo que aqui usamos
 * um campo de texto com máscara. O valor continua a ser trocado com o formulário
 * em 'YYYY-MM-DD', mantendo o resto da lógica inalterada. O botão de calendário
 * abre o seletor nativo (a grelha do calendário não tem ambiguidade de formato).
 */
export default function DateField({
  value = '',
  onChange,
  disabled = false,
  required = false,
  min,
  max,
  id,
  className = '',
  ariaLabel,
  separator = '/',
}) {
  const [text, setText] = useState(() => isoToDisplay(value, separator))
  const [lastValue, setLastValue] = useState(value)
  const nativeRef = useRef(null)

  // Ressincroniza o texto quando o valor externo muda (edição/reset do form).
  if (value !== lastValue) {
    setLastValue(value)
    setText(isoToDisplay(value, separator))
  }

  function handleText(e) {
    const masked = maskDate(e.target.value, separator)
    setText(masked)
    if (masked === '') {
      onChange('')
      return
    }
    const iso = displayToIso(masked)
    if (iso) onChange(iso)
  }

  function openPicker() {
    const el = nativeRef.current
    if (!el || disabled) return
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker()
        return
      } catch {
        // showPicker pode falhar sem gesto do utilizador — recorre ao fallback.
      }
    }
    el.focus()
    el.click()
  }

  return (
    <span className={`${className} relative flex items-center focus-within:border-ring ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder={`dd${separator}mm${separator}aaaa`}
        aria-label={ariaLabel}
        className="min-w-0 flex-1 bg-transparent outline-none disabled:cursor-not-allowed"
        value={text}
        onChange={handleText}
        disabled={disabled}
        required={required}
        maxLength={10}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-label="Abrir calendário"
        tabIndex={-1}
        className="ml-1 flex shrink-0 items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        <Calendar className="h-4 w-4" aria-hidden="true" />
      </button>
      <input
        ref={nativeRef}
        type="date"
        value={value || ''}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-hidden="true"
        tabIndex={-1}
        className="pointer-events-none absolute bottom-0 right-2 h-0 w-0 opacity-0"
      />
    </span>
  )
}
