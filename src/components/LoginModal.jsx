import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Lock, X } from 'lucide-react'

import { useAuth } from '../hooks/useAuth'
import { useModalA11y } from '../hooks/useModalA11y'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * LoginModal — autenticação passwordless por email + código (OTP).
 * Passo 1: pede o email. Passo 2: pede o código de 6 dígitos.
 */
export default function LoginModal({ onClose }) {
  const { requestCode, verifyCode } = useAuth()
  const containerRef = useModalA11y(onClose)

  const [step, setStep] = useState('email') // 'email' | 'code'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const handleRequest = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    try {
      await requestCode(email)
      toast.success('Se o email estiver autorizado, enviámos um código.')
      setStep('code')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (code.length !== 6) return
    setBusy(true)
    try {
      const user = await verifyCode(email, code)
      toast.success(`Bem-vindo(a), ${user.name || user.email}.`)
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[300] flex items-start justify-center bg-black/60 pt-20 max-[600px]:items-end max-[600px]:pt-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Entrar na gestão"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="w-[360px] max-w-[92vw] overflow-hidden rounded-lg border bg-background shadow-lg max-[600px]:w-full max-[600px]:max-w-full max-[600px]:rounded-b-none"
        ref={containerRef}
        tabIndex={-1}
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <div className="flex items-center justify-between px-[18px] pb-2 pt-4">
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-foreground">
            <Lock className="h-[18px] w-[18px] text-foreground" aria-hidden="true" />
            Entrar na gestão
          </h3>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>

        {step === 'email' ? (
          <form className="flex flex-col gap-2 px-[18px] pb-5 pt-2" onSubmit={handleRequest}>
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              placeholder="o-teu-email@cclx.pt"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Button className="mt-1" type="submit" disabled={busy}>
              {busy ? 'A enviar…' : 'Receber código'}
            </Button>
          </form>
        ) : (
          <form className="flex flex-col gap-2 px-[18px] pb-5 pt-2" onSubmit={handleVerify}>
            <p className="mb-1 text-xs text-muted-foreground">
              Enviámos um código de 6 dígitos para{' '}
              <strong className="text-foreground">{email}</strong>.
            </p>
            <Label htmlFor="login-code">Código</Label>
            <Input
              id="login-code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              className="text-center text-xl font-bold tracking-[8px]"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="one-time-code"
              required
            />
            <Button
              className="mt-1"
              type="submit"
              disabled={busy || code.length !== 6}
            >
              {busy ? 'A validar…' : 'Entrar'}
            </Button>
            <button
              type="button"
              className="p-1 text-xs text-muted-foreground underline transition-colors hover:text-foreground"
              onClick={() => {
                setStep('email')
                setCode('')
              }}
            >
              Usar outro email
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}
