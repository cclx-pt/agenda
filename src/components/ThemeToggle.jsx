import styles from './ThemeToggle.module.css'

export default function ThemeToggle({ isDark, onToggle }) {
  return (
    <button
      className={styles.toggle}
      onClick={onToggle}
      aria-label={isDark ? 'Mudar para modo dia' : 'Mudar para modo noite'}
      title={isDark ? 'Modo dia' : 'Modo noite'}
    >
      <span className={`${styles.track} ${isDark ? styles.dark : styles.light}`}>
        <span className={styles.thumb}>
          {isDark
            ? <i className="ti ti-moon" aria-hidden="true" />
            : <i className="ti ti-sun" aria-hidden="true" />
          }
        </span>
      </span>
      <span className={styles.label}>
        {isDark ? 'Noite' : 'Dia'}
      </span>
    </button>
  )
}
