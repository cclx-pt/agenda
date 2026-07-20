import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, CreditCard } from 'lucide-react'
import { getPaymentMethods, updatePaymentMethods } from '../services/eventsService'
import { Switch } from '@/components/ui/switch'

const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const primaryBtn =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60'

// Gestão global dos métodos de pagamento (flag ativo/inativo + rótulo). Só os
// métodos ativos aparecem para configurar nos bilhetes dos convites.
export default function PaymentMethodsAdmin() {
  const [methods, setMethods] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    getPaymentMethods()
      .then((m) => {
        if (alive) setMethods(m)
      })
      .catch((err) => toast.error(err.message))
    return () => {
      alive = false
    }
  }, [])

  const setLabel = (i, label) => setMethods((ms) => ms.map((m, idx) => (idx === i ? { ...m, label } : m)))
  const setActive = (i, active) => setMethods((ms) => ms.map((m, idx) => (idx === i ? { ...m, active } : m)))

  const save = async () => {
    setBusy(true)
    try {
      const saved = await updatePaymentMethods(
        methods.map((m) => ({ key: m.key, label: m.label, active: m.active }))
      )
      setMethods(saved)
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
        Ative/desative e renomeie os métodos de pagamento. Só os métodos ativos aparecem para configurar nos
        bilhetes dos convites (podem oferecer-se vários por bilhete).
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {methods.map((m, i) => (
          <li key={m.key} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
            <CreditCard className="h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              className={inputCls + ' w-auto max-w-[240px] flex-1'}
              value={m.label}
              onChange={(e) => setLabel(i, e.target.value)}
              aria-label={`Nome do método ${m.key}`}
            />
            <span className="text-xs text-muted-foreground">({m.key})</span>
            <label className="ml-auto inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <Switch checked={m.active} onCheckedChange={(v) => setActive(i, v)} />
              {m.active ? 'Ativo' : 'Inativo'}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={busy} className={primaryBtn}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Guardar
        </button>
      </div>
    </div>
  )
}
