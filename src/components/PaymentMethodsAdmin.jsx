import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Loader2, CreditCard, Plus, Trash2 } from 'lucide-react'
import { getPaymentMethods, updatePaymentMethods } from '../services/eventsService'
import { Switch } from '@/components/ui/switch'

const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const primaryBtn =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60'
const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60'

// Gera uma pré-visualização da chave (slug) de um método personalizado, a
// espelhar o backend (server/src/settings/service.js paymentMethodKey).
function slugPreview(value) {
  const slug = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  if (!slug) return ''
  return /^[a-z]/.test(slug) ? slug : `m-${slug}`
}

// Tipos de pagamento permitidos (espelham o backend server/src/settings/service.js).
// A integração e a exigência de comprovativo derivam do TIPO. Todos exigem
// comprovativo; só 'mbway-contribuir' tem integração (JotForm).
const METHOD_TYPES = [
  { type: 'mbway-contribuir', label: 'MB WAY — Contribuir (JotForm)', integrated: true },
  { type: 'mbway', label: 'MB WAY (manual)', integrated: false },
  { type: 'transferencia', label: 'Transferência bancária', integrated: false },
  { type: 'referencia-multibanco', label: 'Referência Multibanco', integrated: false },
  { type: 'numerario', label: 'Numerário', integrated: false },
]
const TYPE_INTEGRATED = new Set(METHOD_TYPES.filter((t) => t.integrated).map((t) => t.type))

// Gestão dos métodos de pagamento dos convites (dentro da Administração de
// convites). Cada método tem um TIPO fixo (da lista permitida) que define a
// integração e a exigência de comprovativo; podem existir vários métodos do
// mesmo tipo. Só os métodos ativos aparecem para configurar nos bilhetes.
export default function PaymentMethodsAdmin() {
  const [methods, setMethods] = useState(null)
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('numerario')
  const tmpId = useRef(0)

  useEffect(() => {
    let alive = true
    getPaymentMethods()
      .then((m) => {
        if (alive) setMethods(m.map((x) => ({ ...x, _id: x.key })))
      })
      .catch((err) => toast.error(err.message))
    return () => {
      alive = false
    }
  }, [])

  const patch = (id, chg) => setMethods((ms) => ms.map((m) => (m._id === id ? { ...m, ...chg } : m)))
  const setLabel = (id, label) => patch(id, { label })
  const setActive = (id, active) => patch(id, { active })
  const setType = (id, type) => patch(id, { type })
  const removeMethod = (id) => setMethods((ms) => ms.filter((m) => m._id !== id))

  // Números MB WAY (só para o tipo 'mbway'; até 4).
  const setNumber = (id, idx, value) =>
    setMethods((ms) =>
      ms.map((m) => {
        if (m._id !== id) return m
        const numbers = [...(m.numbers || [])]
        numbers[idx] = value
        return { ...m, numbers }
      })
    )
  const addNumber = (id) =>
    setMethods((ms) => ms.map((m) => (m._id === id && (m.numbers || []).length < 4 ? { ...m, numbers: [...(m.numbers || []), ''] } : m)))
  const removeNumber = (id, idx) =>
    setMethods((ms) => ms.map((m) => (m._id === id ? { ...m, numbers: (m.numbers || []).filter((_, i) => i !== idx) } : m)))

  const addMethod = () => {
    const label = newName.trim()
    if (!label) return
    tmpId.current += 1
    setMethods((ms) => [...ms, { _id: `tmp-${tmpId.current}`, key: '', label, active: true, type: newType, numbers: [] }])
    setNewName('')
  }

  const save = async () => {
    if (methods.some((m) => !m.label.trim())) {
      toast.error('Indique o nome de todos os métodos de pagamento.')
      return
    }
    setBusy(true)
    try {
      const saved = await updatePaymentMethods(
        methods.map((m) => ({
          key: m.key || undefined,
          label: m.label,
          active: m.active,
          type: m.type,
          numbers: m.type === 'mbway' ? (m.numbers || []).map((n) => String(n).trim()).filter(Boolean) : [],
        }))
      )
      setMethods(saved.map((x) => ({ ...x, _id: x.key }))) // rechaveia com as chaves reais
      toast.success('Métodos de pagamento guardados.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!methods) {
    return <p className="py-8 text-center text-sm text-muted-foreground">A carregar…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted-foreground">
        Faça a gestão dos métodos de pagamento dos convites. Cada método tem um <strong>tipo</strong> da lista
        permitida, que define automaticamente se tem integração e se exige comprovativo. Só{' '}
        <strong>MB WAY — Contribuir</strong> tem integração (JotForm); os restantes são manuais. Todos exigem
        comprovativo. Pode criar vários métodos do mesmo tipo. Só os métodos ativos aparecem nos bilhetes.
      </p>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {methods.map((m) => {
          const previewKey = m.key || slugPreview(m.label)
          const integrated = TYPE_INTEGRATED.has(m.type)
          return (
            <li key={m._id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-3">
                <CreditCard className="h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  className={inputCls + ' w-auto max-w-[220px] flex-1'}
                  value={m.label}
                  onChange={(e) => setLabel(m._id, e.target.value)}
                  placeholder="Nome do método"
                  aria-label={`Nome do método ${previewKey || 'novo'}`}
                />
                <select
                  className={inputCls + ' w-auto'}
                  value={m.type}
                  onChange={(e) => setType(m._id, e.target.value)}
                  aria-label="Tipo de pagamento"
                >
                  {METHOD_TYPES.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">{previewKey ? `(${previewKey})` : '(novo)'}</span>
                <span
                  className={
                    'rounded-full px-2 py-[3px] text-[11px] font-semibold ' +
                    (integrated
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground')
                  }
                >
                  {integrated ? 'Integração (JotForm)' : 'Sem integração'}
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-[3px] text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
                  Comprovativo obrigatório
                </span>
                <label className="ml-auto inline-flex items-center gap-2 text-sm font-medium text-foreground">
                  <Switch checked={m.active} onCheckedChange={(v) => setActive(m._id, v)} />
                  {m.active ? 'Ativo' : 'Inativo'}
                </label>
                <button
                  type="button"
                  onClick={() => removeMethod(m._id)}
                  className="inline-flex items-center rounded-lg border border-destructive/40 bg-transparent px-2.5 py-2 text-destructive transition-colors hover:bg-destructive/10"
                  aria-label={`Eliminar método ${m.label || previewKey}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {m.type === 'mbway' ? (
                <div className="flex flex-col gap-1.5 rounded-lg bg-muted/40 p-2">
                  <span className="text-xs font-semibold text-muted-foreground">Números MB WAY (até 4)</span>
                  <div className="flex flex-wrap gap-2">
                    {(m.numbers || []).map((n, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background pl-2">
                        <input
                          className="w-32 bg-transparent py-1.5 text-sm text-foreground outline-none"
                          value={n}
                          onChange={(e) => setNumber(m._id, i, e.target.value)}
                          placeholder="9XX XXX XXX"
                          inputMode="numeric"
                          aria-label={`Número MB WAY ${i + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => removeNumber(m._id, i)}
                          className="rounded p-1 text-destructive hover:bg-destructive/10"
                          aria-label="Remover número"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                    {(m.numbers || []).length < 4 ? (
                      <button type="button" onClick={() => addNumber(m._id)} className={ghostBtn + ' py-1.5'}>
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        Número
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {m.type === 'transferencia' ? (
                <p className="m-0 text-xs text-muted-foreground">O NIB/beneficiário define-se nas Definições de convites.</p>
              ) : null}
              {m.type === 'referencia-multibanco' ? (
                <p className="m-0 text-xs text-muted-foreground">A entidade e a referência definem-se em cada bilhete.</p>
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3">
        <select className={inputCls + ' w-auto'} value={newType} onChange={(e) => setNewType(e.target.value)} aria-label="Tipo do novo método">
          {METHOD_TYPES.map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          className={inputCls + ' w-auto max-w-[240px] flex-1'}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addMethod()
            }
          }}
          placeholder="Nome do método (ex.: Numerário — livraria)"
          aria-label="Nome do novo método de pagamento"
        />
        <button type="button" onClick={addMethod} disabled={!newName.trim()} className={ghostBtn}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Adicionar
        </button>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={busy} className={primaryBtn}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Guardar
        </button>
      </div>
    </div>
  )
}
