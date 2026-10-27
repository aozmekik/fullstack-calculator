import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCalculatorClient } from './client'

/** A fetch that answers every request with `body`. */
function respond(status: number, body: unknown) {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
      }),
  )
}

/** A fetch that never answers, but rejects once its signal aborts. */
function hang() {
  return vi.fn<typeof fetch>(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(init.signal?.reason),
        )
      }),
  )
}

describe('createCalculatorClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the operands as JSON to the operation endpoint', async () => {
    const fetch = respond(200, {
      operation: 'divide',
      operands: [10, 4],
      result: 2.5,
    })
    const client = createCalculatorClient({ baseUrl: '/api/v1', fetch })

    await client.calculate('divide', [10, 4])

    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/divide',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: '{"operands":[10,4]}',
      }),
    )
  })

  it('returns the calculation', async () => {
    const calculation = { operation: 'add', operands: [2, 3], result: 5 }
    const client = createCalculatorClient({ fetch: respond(200, calculation) })

    await expect(client.calculate('add', [2, 3])).resolves.toEqual(calculation)
  })

  it('uses the global fetch by default', async () => {
    const fetch = respond(200, { operation: 'sqrt', operands: [9], result: 3 })
    vi.stubGlobal('fetch', fetch)

    await createCalculatorClient().calculate('sqrt', [9])

    expect(fetch).toHaveBeenCalledWith('/api/v1/sqrt', expect.anything())
  })

  it('turns an error response into an ApiError with its code', async () => {
    const client = createCalculatorClient({
      fetch: respond(422, {
        error: { code: 'division_by_zero', message: 'division by zero' },
      }),
    })

    await expect(client.calculate('divide', [1, 0])).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      code: 'division_by_zero',
      message: 'division by zero',
    })
  })

  it('reports an error response that is not the documented JSON', async () => {
    const client = createCalculatorClient({
      fetch: respond(502, '<h1>Bad Gateway</h1>'),
    })

    await expect(client.calculate('add', [1, 2])).rejects.toMatchObject({
      name: 'ApiError',
      status: 502,
      code: 'unexpected_response',
    })
  })

  it('rejects a success response with an unexpected shape', async () => {
    const client = createCalculatorClient({
      fetch: respond(200, { result: 'five' }),
    })

    await expect(client.calculate('add', [2, 3])).rejects.toMatchObject({
      name: 'ApiError',
      code: 'unexpected_response',
    })
  })

  it('reports an unreachable service as a NetworkError', async () => {
    const offline = new TypeError('Failed to fetch')
    const client = createCalculatorClient({
      fetch: vi.fn<typeof fetch>(async () => {
        throw offline
      }),
    })

    await expect(client.calculate('add', [1, 2])).rejects.toMatchObject({
      name: 'NetworkError',
      reason: 'unreachable',
      cause: offline,
    })
  })

  it('gives up after the timeout', async () => {
    const client = createCalculatorClient({ fetch: hang(), timeoutMs: 10 })

    await expect(client.calculate('add', [1, 2])).rejects.toMatchObject({
      name: 'NetworkError',
      reason: 'timeout',
    })
  })

  it('passes a cancellation through instead of reporting a failure', async () => {
    const client = createCalculatorClient({ fetch: hang() })
    const controller = new AbortController()

    const calculation = client.calculate('add', [1, 2], {
      signal: controller.signal,
    })
    controller.abort()

    await expect(calculation).rejects.toMatchObject({ name: 'AbortError' })
  })
})
