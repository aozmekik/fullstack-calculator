import type { CalculatorClient } from './api/client'
import styles from './App.module.css'
import { Calculator } from './components/Calculator'

interface AppProps {
  client: CalculatorClient
}

export function App({ client }: AppProps) {
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>Calculator</h1>
        <p className={styles.subtitle}>
          Every result is computed by the Go API.
        </p>
      </header>
      <main className={styles.main}>
        <Calculator client={client} />
      </main>
      <footer className={styles.footer}>
        <p>
          Keyboard: <kbd>0</kbd>–<kbd>9</kbd> <kbd>.</kbd> <kbd>+</kbd>{' '}
          <kbd>-</kbd> <kbd>*</kbd> <kbd>/</kbd> <kbd>^</kbd> <kbd>%</kbd> ·{' '}
          <kbd>r</kbd> √ · <kbd>n</kbd> ± · <kbd>Enter</kbd> = ·{' '}
          <kbd>Backspace</kbd> ⌫ · <kbd>Esc</kbd> AC
        </p>
        <p>You can also paste a number.</p>
      </footer>
    </div>
  )
}
