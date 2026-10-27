import { useEffect, useReducer } from 'react'
import type { CalculatorClient } from '../api/client'
import { errorMessage } from './messages'
import { calculatorReducer, initialState } from './reducer'

/**
 * Runs the calculator state machine and performs the calculations it asks
 * for. A request is aborted when it is superseded (AC) or the component
 * unmounts, and its late answer is ignored.
 */
export function useCalculator(client: CalculatorClient) {
  const [state, dispatch] = useReducer(calculatorReducer, initialState)
  const { request } = state

  useEffect(() => {
    if (!request) return
    const controller = new AbortController()
    client
      .calculate(request.operation, request.operands, {
        signal: controller.signal,
      })
      .then(
        (calculation) =>
          dispatch({ type: 'succeeded', id: request.id, calculation }),
        (error: unknown) => {
          if (controller.signal.aborted) return
          dispatch({
            type: 'failed',
            id: request.id,
            message: errorMessage(error),
          })
        },
      )
    return () => controller.abort()
  }, [client, request])

  return [state, dispatch] as const
}
