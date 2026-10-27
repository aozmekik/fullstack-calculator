import type { CalculatorClient } from '../api/client'
import { displayExpression, displayValue } from '../calculator/selectors'
import { useCalculator } from '../calculator/useCalculator'
import { useKeyboardInput } from '../calculator/useKeyboardInput'
import styles from './Calculator.module.css'
import { Display } from './Display'
import { History } from './History'
import { Keypad } from './Keypad'

interface CalculatorProps {
  client: CalculatorClient
}

export function Calculator({ client }: CalculatorProps) {
  const [state, dispatch] = useCalculator(client)
  useKeyboardInput(dispatch)

  return (
    <div className={styles.layout}>
      <section className={styles.calculator} aria-label="Calculator">
        <Display
          value={displayValue(state)}
          expression={displayExpression(state)}
          error={state.error}
          busy={state.request !== null}
        />
        <Keypad onPress={dispatch} />
      </section>
      <History
        entries={state.history}
        onRecall={(value) => dispatch({ type: 'recall', value })}
        onClear={() => dispatch({ type: 'clearHistory' })}
      />
    </div>
  )
}
