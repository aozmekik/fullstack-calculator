import styles from './Display.module.css'

interface DisplayProps {
  value: string
  expression: string
  error: string | null
  busy: boolean
}

export function Display({ value, expression, error, busy }: DisplayProps) {
  return (
    <div className={styles.display} aria-busy={busy}>
      <p className={styles.expression}>{expression}</p>
      {/* <output> is a polite live region: screen readers announce results. */}
      <output className={styles.value} data-size={sizeOf(value)}>
        {value}
      </output>
      <p className={styles.error} role="alert">
        {error}
      </p>
      <span className={styles.busy} aria-hidden="true" />
    </div>
  )
}

/** Shrinks long numbers so that they fit on one line. */
function sizeOf(value: string): 'large' | 'medium' | 'small' | 'tiny' {
  if (value.length <= 9) return 'large'
  if (value.length <= 13) return 'medium'
  if (value.length <= 17) return 'small'
  return 'tiny'
}
