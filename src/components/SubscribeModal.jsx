import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Copy, Check, CalendarSync } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useModalA11y } from '../hooks/useModalA11y'

/**
 * SubscribeModal — mostra o endereço de subscrição (feed iCalendar) da agenda e
 * atalhos para adicionar ao Google / Apple / Outlook. Ao contrário da exportação
 * (cópia fixa), a subscrição sincroniza automaticamente.
 */
export default function SubscribeModal({ onClose }) {
  const ref = useModalA11y(onClose)
  const [copied, setCopied] = useState(false)

  const httpsUrl = `${window.location.origin}/data/events/calendar.ics`
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, 'webcal://')
  const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(httpsUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignora */
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 px-4 py-10"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog" aria-modal="true" aria-label="Subscrever calendário"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
    >
      <motion.div
        ref={ref} tabIndex={-1}
        className="w-[480px] max-w-[96vw] overflow-hidden rounded-xl border border-border bg-background shadow-lg"
        initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="m-0 flex items-center gap-2 text-base font-bold text-foreground">
            <CalendarSync className="h-5 w-5 text-primary" aria-hidden="true" />
            Subscrever calendário
          </h2>
          <button className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <p className="m-0 text-sm text-muted-foreground">
            Adicione a agenda ao seu calendário. Os eventos <strong className="text-foreground">atualizam-se sozinhos</strong> (sincronização periódica) — ao contrário da exportação, que é uma cópia fixa.
          </p>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Endereço de subscrição</span>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={httpsUrl}
                onFocus={(e) => e.target.select()}
                className="min-w-0 flex-1 rounded-lg border border-input bg-muted/40 px-3 py-2 text-xs text-foreground outline-none"
              />
              <Button variant="outline" size="sm" onClick={copy} title="Copiar endereço">
                {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={webcalUrl} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              Adicionar (Apple / Outlook)
            </a>
            <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent">
              Adicionar ao Google
            </a>
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="m-0 mb-1 font-semibold text-foreground">Adicionar manualmente</p>
            <ul className="m-0 list-disc pl-4">
              <li><strong>Google:</strong> Outros calendários → «+» → A partir do URL → colar o endereço.</li>
              <li><strong>Apple / iPhone:</strong> Definições → Calendário → Contas → Adicionar conta → Subscrição.</li>
              <li><strong>Outlook:</strong> Adicionar calendário → Subscrever a partir da Web.</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
