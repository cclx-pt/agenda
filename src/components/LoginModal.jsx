import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import { useModalA11y } from '../hooks/useModalA11y'
import styles from './LoginModal.module.css'

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
      className={styles.overlay}
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
        className={styles.modal}
        ref={containerRef}
        tabIndex={-1}
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>
            <i className="ti ti-lock" aria-hidden="true" />
            Entrar na gestão
          </h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {step === 'email' ? (
          <form className={styles.form} onSubmit={handleRequest}>
            <label className={styles.label} htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              className={styles.input}
              placeholder="o-teu-email@cclx.pt"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <button className={styles.submit} type="submit" disabled={busy}>
              {busy ? 'A enviar…' : 'Receber código'}
            </button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={handleVerify}>
            <p className={styles.hint}>
              Enviámos um código de 6 dígitos para <strong>{email}</strong>.
            </p>
            <label className={styles.label} htmlFor="login-code">
              Código
            </label>
            <input
              id="login-code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              className={`${styles.input} ${styles.codeInput}`}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="one-time-code"
              required
            />
            <button className={styles.submit} type="submit" disabled={busy || code.length !== 6}>
              {busy ? 'A validar…' : 'Entrar'}
            </button>
            <button
              type="button"
              className={styles.linkBtn}
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
