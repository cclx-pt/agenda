import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Loader2, CreditCard, Plus, Trash2, Lock } from 'lucide-react'
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

// Gestão dos métodos de pagamento dos convites (dentro da Administração de
// convites). Os 3 métodos INTEGRADOS (MB WAY, Transferência, Referência) têm
// comportamento próprio no código: renomeiam-se e ativam/desativam mas não se
// eliminam. Além destes, pode CRIAR novos tipos de pagamento (manuais). Só os
// métodos ativos aparecem para configurar nos bilhetes.
export default function PaymentMethodsAdmin() {
  const [methods, setMethods] = useState(null)
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('')
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

  const setLabel = (id, label) => setMethods((ms) => ms.map((m) => (m._id === id ? { ...m, label } : m)))
  const setActive = (id, active) => setMethods((ms) => ms.map((m) => (m._id === id ? { ...m, active } : m)))
  const setRequireReceipt = (id, requireReceipt) =>
    setMethods((ms) => ms.map((m) => (m._id === id ? { ...m, requireReceipt } : m)))
  const removeMethod = (id) => setMethods((ms) => ms.filter((m) => m._id !== id))

  const addMethod = () => {
    const label = newName.trim()
    if (!label) return
    tmpId.current += 1
    setMethods((ms) => [...ms, { _id: `tmp-${tmpId.current}`, key: '', label, active: true, builtin: false, integrated: false, requireReceipt: true }])
    setNewName('')
  }

  const save = async () => {
    // Valida: nenhum método personalizado sem nome.
    if (methods.some((m) => !m.builtin && !m.label.trim())) {
      toast.error('Indique o nome de todos os métodos de pagamento.')
      return
    }
    setBusy(true)
    try {
      const saved = await updatePaymentMethods(
        methods.map((m) => ({ key: m.key, label: m.label, active: m.active, requireReceipt: m.requireReceipt !== false }))
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
        Faça a gestão dos métodos de pagamento dos convites. Os 3 métodos base (MB WAY, Transferência e
        Referência) podem renomear-se e ativar/desativar; pode ainda criar novos tipos. Só o <strong>MB WAY</strong>{' '}
        tem integração automática — os restantes são manuais. Ative <strong>Exigir comprovativo</strong> se o
        convidado tiver de carregar o comprovativo de pagamento. Só os métodos ativos aparecem nos bilhetes.
      </p>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {methods.map((m) => {
          const previewKey = m.builtin ? m.key : m.key || slugPreview(m.label)
          return (
            <li key={m._id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
              {m.builtin ? (
                <Lock className="h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : (
                <CreditCard className="h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <input
                className={inputCls + ' w-auto max-w-[240px] flex-1'}
                value={m.label}
                onChange={(e) => setLabel(m._id, e.target.value)}
                placeholder="Nome do método"
                aria-label={`Nome do método ${previewKey || 'novo'}`}
              />
              <span className="text-xs text-muted-foreground">{previewKey ? `(${previewKey})` : '(novo)'}</span>
              <span
                className={
                  'rounded-full px-2 py-[3px] text-[11px] font-semibold ' +
                  (m.integrated
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground')
                }
              >
                {m.integrated ? 'Integração' : 'Sem integração'}
              </span>
              <label className="ml-auto inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <Switch checked={m.requireReceipt !== false} onCheckedChange={(v) => setRequireReceipt(m._id, v)} />
                Exigir comprovativo
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <Switch checked={m.active} onCheckedChange={(v) => setActive(m._id, v)} />
                {m.active ? 'Ativo' : 'Inativo'}
              </label>
              {!m.builtin ? (
                <button
                  type="button"
                  onClick={() => removeMethod(m._id)}
                  className="inline-flex items-center rounded-lg border border-destructive/40 bg-transparent px-2.5 py-2 text-destructive transition-colors hover:bg-destructive/10"
                  aria-label={`Eliminar método ${m.label || previewKey}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3">
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
          placeholder="Novo tipo de pagamento (ex.: Numerário, PayPal)"
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
