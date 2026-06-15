import styles from './CalendarSkeleton.module.css'

const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

/**
 * Loading placeholder that mimics the month grid while events load.
 */
export default function CalendarSkeleton() {
  return (
    <div className={styles.wrap} aria-hidden="true">
      <div className={styles.weekRow}>
        {WEEKDAYS.map((d, i) => (
          <div key={i} className={styles.weekday}>{d}</div>
        ))}
      </div>
      <div className={styles.grid}>
        {Array.from({ length: 42 }, (_, i) => (
          <div key={i} className={styles.cell}>
            <div className={styles.dayNum} />
            {(i * 7) % 5 === 0 && <div className={styles.pill} />}
            {(i * 3) % 7 === 0 && <div className={`${styles.pill} ${styles.pillShort}`} />}
          </div>
        ))}
      </div>
    </div>
  )
}
