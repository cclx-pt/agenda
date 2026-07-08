import { useState } from 'react'

// 'HH:MM' (24h) válido? (00–23 : 00–59)
function isValidTime(t) {
  const m = /^(\d{2}):(\d{2})$/.exec(t)
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59
}

// Máscara HH:MM a partir dos dígitos escritos.
function maskTime(raw) {
  const d = String(raw).replace(/\D/g, '').slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`
}

// 'HH:MM' (24h) → '6:30 PM' (12h com AM/PM); '' se incompleta/inválida.
function to12h(t) {
  const m = /^(\d{2}):(\d{2})$/.exec(t)
  if (!m) return ''
  const h = Number(m[1])
  if (h > 23 || Number(m[2]) > 59) return ''
  const suffix = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m[2]} ${suffix}`
}

/**
 * Campo de hora em formato 24H (HH:MM), com a indicação AM/PM derivada da hora
 * escolhida mostrada como OUTPUT ao lado.
 *
 * O `<input type="time">` nativo mostra o formato do LOCALE DO BROWSER (em inglês
 * fica 12H com AM/PM); aqui garantimos sempre 24H para introduzir. O valor
 * continua a ser 'HH:MM' 24h — logo NÃO há alterações na base de dados.
 */
export default function TimeField({
  value = '',
  onChange,
  disabled = false,
  required = false,
  id,
  className = '',
  ariaLabel,
}) {
  const [text, setText] = useState(value)
  const [lastValue, setLastValue] = useState(value)

  // Ressincroniza o texto quando o valor externo muda (edição/reset do form).
  if (value !== lastValue) {
    setLastValue(value)
    setText(value)
  }

  function handleText(e) {
    const masked = maskTime(e.target.value)
    setText(masked)
    if (masked === '') {
      onChange('')
      return
    }
    if (isValidTime(masked)) onChange(masked)
  }

  const ampm = to12h(text)

  return (
    <span className={`${className} relative flex items-center focus-within:border-ring ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="hh:mm"
        aria-label={ariaLabel}
        className="min-w-0 flex-1 bg-transparent outline-none disabled:cursor-not-allowed"
        value={text}
        onChange={handleText}
        disabled={disabled}
        required={required}
        maxLength={5}
        autoComplete="off"
      />
      {ampm && (
        <span className="ml-2 shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground" aria-hidden="true">
          {ampm}
        </span>
      )}
    </span>
  )
}
