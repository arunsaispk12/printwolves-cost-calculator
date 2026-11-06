import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The adapter is switched off under Vitest (there is no server). These tests
// switch it on and talk to a fake one, loading a fresh copy of the module each
// time because it keeps its document and version in module state.
type Server = { doc: Record<string, unknown>; version: number; calls: Array<{ method: string; body?: any }> }

function fakeServer(initial: Partial<Server> = {}, opts: { getStatus?: number } = {}) {
  const server: Server = { doc: {}, version: 0, calls: [], ...initial }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const method = init.method ?? 'GET'
      const body = init.body ? JSON.parse(String(init.body)) : undefined
      server.calls.push({ method, body })
      if (method === 'GET') {
        if (opts.getStatus) return { ok: false, status: opts.getStatus, json: async () => ({}) }
        return { ok: true, status: 200, json: async () => structuredClone({ data: { doc: server.doc, version: server.version } }) }
      }
      if (body.expected_version !== server.version) {
        return { ok: false, status: 409, json: async () => ({}) }
      }
      server.doc = structuredClone(body.doc)
      server.version += 1
      return { ok: true, status: 200, json: async () => ({ data: { version: server.version } }) }
    }),
  )
  return server
}

async function load() {
  vi.resetModules()
  vi.stubEnv('VITEST', '')
  return import('@/lib/remoteStorage')
}

const puts = (s: Server) => s.calls.filter((c) => c.method === 'PUT')

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('remote storage', () => {
  it('reads a stored value from the server document', async () => {
    fakeServer({ doc: { 'pw-planner': { state: { x: 1 }, version: 0 } }, version: 4 })
    const m = await load()
    const storage = m.remotePersistStorage<unknown>()
    expect(await storage.getItem('pw-planner')).toEqual({ state: { x: 1 }, version: 0 })
    expect(await storage.getItem('missing')).toBeNull()
  })

  it('waits for a quiet moment, then saves once with the version it loaded', async () => {
    const server = fakeServer({ version: 4 })
    const m = await load()
    const storage = m.remotePersistStorage<unknown>()
    await storage.getItem('a')

    storage.setItem('a', { state: { n: 1 }, version: 0 })
    storage.setItem('a', { state: { n: 2 }, version: 0 })
    await vi.advanceTimersByTimeAsync(1000)
    expect(puts(server)).toHaveLength(0) // still inside the debounce window
    expect(m.useSyncStatus.getState().state).toBe('saving')

    await vi.advanceTimersByTimeAsync(600)
    expect(puts(server)).toHaveLength(1)
    expect(puts(server)[0].body).toEqual({ doc: { a: { state: { n: 2 }, version: 0 } }, expected_version: 4 })
    expect(m.useSyncStatus.getState().state).toBe('saved')

    // The next save is based on the version the server just handed back.
    storage.setItem('a', { state: { n: 3 }, version: 0 })
    await vi.advanceTimersByTimeAsync(1600)
    expect(puts(server)[1].body.expected_version).toBe(5)
  })

  it('reports a conflict instead of overwriting, and stops auto-saving', async () => {
    const server = fakeServer({ version: 4 })
    const m = await load()
    const storage = m.remotePersistStorage<unknown>()
    await storage.getItem('a')

    server.version = 9 // someone else saved first
    storage.setItem('a', { state: { mine: true }, version: 0 })
    await vi.advanceTimersByTimeAsync(1600)
    expect(m.useSyncStatus.getState().state).toBe('conflict')
    expect(server.doc).toEqual({}) // not overwritten

    storage.setItem('a', { state: { mine: 'again' }, version: 0 })
    await vi.advanceTimersByTimeAsync(5000)
    expect(puts(server)).toHaveLength(1) // no retry loop while the user decides
  })

  it('"keep mine" saves this tab\'s edits over the newer version', async () => {
    const server = fakeServer({ version: 4 })
    const m = await load()
    const storage = m.remotePersistStorage<unknown>()
    await storage.getItem('a')
    server.version = 9
    storage.setItem('a', { state: { mine: true }, version: 0 })
    await vi.advanceTimersByTimeAsync(1600)

    await m.overwriteServer()
    expect(server.doc).toEqual({ a: { state: { mine: true }, version: 0 } })
    expect(server.version).toBe(10)
    expect(m.useSyncStatus.getState().state).toBe('saved')
  })

  it('keeps unsaved edits and says so when the server is unreachable', async () => {
    const server = fakeServer({ version: 1 })
    const m = await load()
    const storage = m.remotePersistStorage<unknown>()
    await storage.getItem('a')

    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('offline'))
    storage.setItem('a', { state: { n: 1 }, version: 0 })
    await vi.advanceTimersByTimeAsync(1600)
    expect(m.useSyncStatus.getState().state).toBe('error')

    await m.saveNow() // Retry button
    expect(server.doc).toEqual({ a: { state: { n: 1 }, version: 0 } })
    expect(m.useSyncStatus.getState().state).toBe('saved')
  })

  it('refuses to hand out defaults when the load fails, and can be retried', async () => {
    const down = fakeServer({}, { getStatus: 401 })
    const m = await load()
    await expect(m.loadRemote()).rejects.toThrow(/session has expired/i)
    await expect(m.remotePersistStorage<unknown>().getItem('a')).rejects.toThrow()

    down.calls.length = 0
    fakeServer({ doc: { a: { state: {}, version: 0 } }, version: 2 })
    await expect(m.loadRemote()).resolves.toBeUndefined()
    expect(await m.remotePersistStorage<unknown>().getItem('a')).toEqual({ state: {}, version: 0 })
  })

  it('drops functions from the saved state and never touches browser storage', async () => {
    const server = fakeServer({ version: 1 })
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    const m = await load()
    const storage = m.remotePersistStorage<unknown>()
    await storage.getItem('a')

    storage.setItem('a', { state: { n: 1, action: () => 1 }, version: 0 })
    await vi.advanceTimersByTimeAsync(1600)
    expect(puts(server)[0].body.doc.a).toEqual({ state: { n: 1 }, version: 0 })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
