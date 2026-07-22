import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { getInviteSettings, updateInviteSettings } from '../../services/invitesService'

const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelCls = 'flex flex-col gap-1 text-sm font-medium text-foreground'
const primaryBtn =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60'

// Definições gerais partilhadas por todos os convites (dentro da Administração
// de convites). Por agora: os dados de pagamento (IBAN / beneficiário / entidade
// Multibanco) que o fluxo de pagamento "manual" mostra ao convidado nas
// instruções de transferência e referência. Campos vazios usam o valor por
// omissão do servidor (variáveis de ambiente).
export default function InviteSettingsAdmin() {
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    getInviteSettings()
      .then((s) => {
        if (!alive) return
        setForm({
          iban: s.paymentInfo?.iban ?? '',
          beneficiary: s.paymentInfo?.beneficiary ?? '',
          mbEntity: s.paymentInfo?.mbEntity ?? '',
        })
      })
      .catch((err) => toast.error(err.message))
    return () => {
      alive = false
    }
  }, [])

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const save = async () => {
    setBusy(true)
    try {
      const saved = await updateInviteSettings({ paymentInfo: form })
      setForm({
        iban: saved.paymentInfo?.iban ?? '',
        beneficiary: saved.paymentInfo?.beneficiary ?? '',
        mbEntity: saved.paymentInfo?.mbEntity ?? '',
      })
      toast.success('Definições guardadas.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!form) {
    return <p className="py-8 text-center text-sm text-muted-foreground">A carregar…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted-foreground">
        Dados de pagamento usados nas instruções de <strong>transferência</strong> e <strong>referência</strong> que o
        convidado vê ao pagar. Deixe em branco para usar o valor por omissão do servidor.
      </p>

      <div className="flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <label className={labelCls}>
          IBAN
          <input
            className={inputCls}
            value={form.iban}
            onChange={setField('iban')}
            placeholder="PT50 0000 0000 0000 0000 0000 0"
            autoComplete="off"
          />
        </label>
        <label className={labelCls}>
          Beneficiário
          <input
            className={inputCls}
            value={form.beneficiary}
            onChange={setField('beneficiary')}
            placeholder="CCLX"
            autoComplete="off"
          />
        </label>
        <label className={labelCls}>
          Entidade Multibanco
          <input
            className={inputCls}
            value={form.mbEntity}
            onChange={setField('mbEntity')}
            placeholder="00000"
            inputMode="numeric"
            autoComplete="off"
          />
          <span className="text-xs text-muted-foreground">
            Usada nas referências Multibanco de exemplo (um conector real emite a referência final).
          </span>
        </label>
      </div>

      <div>
        <button type="button" onClick={save} disabled={busy} className={primaryBtn}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Guardar definições
        </button>
      </div>
    </div>
  )
}
