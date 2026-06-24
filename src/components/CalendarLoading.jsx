import CalendarSkeleton from './CalendarSkeleton'
import logoUrl from '../assets/cclx_line_logo.png'
import styles from './CalendarLoading.module.css'

/**
 * Ecrã de carregamento do calendário: logótipo + mensagem de paciência
 * e o versículo de Tiago 5:7, sobre um esqueleto esbatido da grelha.
 */
export default function CalendarLoading() {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.skeleton}>
        <CalendarSkeleton />
      </div>

      <div className={styles.card}>
        <img src={logoUrl} alt="CCLX" className={styles.logo} />
        <div className={styles.spinner} aria-hidden="true" />
        <p className={styles.title}>A carregar calendário…</p>
        <p className={styles.subtitle}>
          <i className="ti ti-pray" aria-hidden="true" />
          Sê paciente comigo
        </p>
        <blockquote className={styles.verse}>
          <p>«Sede, pois, irmãos, pacientes até à vinda do Senhor…»</p>
          <cite className={styles.cite}>Tiago 5:7</cite>
        </blockquote>
      </div>
    </div>
  )
}
