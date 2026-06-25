const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

/**
 * Loading placeholder that mimics the month grid while events load.
 */
export default function CalendarSkeleton() {
  return (
    <div className="p-5" aria-hidden="true">
      <div className="mb-2.5 grid grid-cols-7 gap-2">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 42 }, (_, i) => (
          <div key={i} className="flex min-h-[92px] flex-col gap-1.5 rounded-md border border-border bg-muted/30 p-2 max-[700px]:min-h-[64px]">
            <div className="h-3.5 w-5 animate-pulse rounded bg-muted" />
            {(i * 7) % 5 === 0 && <div className="h-4 w-full animate-pulse rounded bg-muted" />}
            {(i * 3) % 7 === 0 && <div className="h-4 w-[65%] animate-pulse rounded bg-muted" />}
          </div>
        ))}
      </div>
    </div>
  )
}
