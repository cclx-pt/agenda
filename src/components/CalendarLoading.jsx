import CalendarSkeleton from './CalendarSkeleton'
import logoUrl from '../assets/cclx_line_logo.png'
import { useI18n } from '../hooks/useI18n'

/**
 * Ecrã de carregamento do calendário: logótipo + mensagem de paciência
 * e o versículo de Tiago 5:7, sobre um esqueleto esbatido da grelha.
 */
export default function CalendarLoading() {
  const { logoUrl: customLogoUrl } = useI18n()
  return (
    <div className="relative flex min-h-[62vh] items-center justify-center px-4 py-6 max-[600px]:min-h-[56vh] max-[600px]:px-3 max-[600px]:py-4" role="status" aria-live="polite">
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
        <CalendarSkeleton />
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 relative z-[1] flex w-[min(440px,100%)] flex-col items-center gap-3.5 rounded-2xl border border-border bg-card px-7 pb-[26px] pt-[30px] text-center text-card-foreground shadow-xl duration-300 max-[600px]:rounded-[14px] max-[600px]:px-5 max-[600px]:pb-[22px] max-[600px]:pt-6">
        <img src={customLogoUrl || logoUrl} alt="CCLX" className="h-[30px] w-auto object-contain invert dark:invert-0" />
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-muted border-t-primary" aria-hidden="true" />
        <p className="m-0 text-[17px] font-bold text-foreground max-[600px]:text-base">A carregar calendário…</p>
        <p className="m-0 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <i className="ti ti-pray" aria-hidden="true" />
          Sê paciente comigo
        </p>
        <blockquote className="mt-1.5 border-l-[3px] border-primary py-1 pl-3.5 text-left text-[13.5px] italic leading-relaxed text-muted-foreground max-[600px]:text-[13px]">
          <p className="mb-1.5">«Sede, pois, irmãos, pacientes até à vinda do Senhor…»</p>
          <cite className="block text-xs font-bold uppercase not-italic tracking-wide text-primary">Tiago 5:7</cite>
        </blockquote>
      </div>
    </div>
  )
}
