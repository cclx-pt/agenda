import { Moon, Sun } from 'lucide-react'

import { cn } from '@/lib/utils'

export default function ThemeToggle({ isDark, onToggle }) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 bg-transparent p-0"
      onClick={onToggle}
      aria-label={isDark ? 'Mudar para modo dia' : 'Mudar para modo noite'}
      title={isDark ? 'Modo dia' : 'Modo noite'}
    >
      <span
        className={cn(
          'relative inline-block h-6 w-11 rounded-full border border-border transition-colors',
          isDark ? 'bg-secondary' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-200',
            isDark ? 'left-0.5' : 'left-[22px]',
          )}
        >
          {isDark ? (
            <Moon className="h-2.5 w-2.5" aria-hidden="true" />
          ) : (
            <Sun className="h-2.5 w-2.5" aria-hidden="true" />
          )}
        </span>
      </span>
      <span className="select-none text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {isDark ? 'Noite' : 'Dia'}
      </span>
    </button>
  )
}
