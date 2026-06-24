import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combina classes condicionais (clsx) e resolve conflitos de utilitários
 * Tailwind (tailwind-merge). Usado por todos os componentes shadcn/ui.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
