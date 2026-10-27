import { useId } from 'react'
import { describeCalculation, formatNumber } from '../calculator/format'
import type { HistoryEntry } from '../calculator/reducer'
import styles from './History.module.css'

interface HistoryProps {
  entries: HistoryEntry[]
  onRecall: (value: number) => void
  onClear: () => void
}

export function History({ entries, onRecall, onClear }: HistoryProps) {
  const headingId = useId()

  return (
    <section className={styles.history} aria-labelledby={headingId}>
      <div className={styles.header}>
        <h2 id={headingId} className={styles.title}>
          History
        </h2>
        <button
          type="button"
          className={styles.clear}
          disabled={entries.length === 0}
          onClick={onClear}
        >
          Clear
        </button>
      </div>
      {entries.length === 0 ? (
        <p className={styles.empty}>
          Your calculations appear here. Select one to reuse its result.
        </p>
      ) : (
        <ol className={styles.list}>
          {entries.map(({ id, calculation }) => (
            <li key={id}>
              <button
                type="button"
                className={styles.item}
                onClick={() => onRecall(calculation.result)}
              >
                <span className={styles.itemExpression}>
                  {describeCalculation(calculation)} =
                </span>{' '}
                <span className={styles.itemResult}>
                  {formatNumber(calculation.result)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
