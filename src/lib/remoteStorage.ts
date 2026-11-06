import { create } from 'zustand'
import type { PersistStorage, StorageValue } from 'zustand/middleware'

/**
 * Settings live on the server, never in the browser.
 *
 * One JSON document holds every persisted store, keyed by store name. It is
 * loaded once at start-up (the app does not render until that succeeds) and
 * saved back with a debounce. Each save carries the version it was based on;
 * the server refuses with 409 if someone else saved first, so two tabs or two
 * people can't silently overwrite each other.
 *
 * Why the app refuses to start when the load fails: if it rendered defaults
 * and the user then touched anything, the next save would replace their real
 * settings with defaults. Failing loudly is the safe behaviour.
 *
 * In `npm run dev` the same URL is answered by a local file (vite.config.ts).
 */

export type SyncState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

interface SyncStatus {
  state: SyncState
  message: string | null
}

export const useSyncStatus = create<SyncStatus>(() => ({
  state: 'idle',
  message: null,
}))

const setStatus = (state: SyncState, message: string | null = null) =>
  useSyncStatus.setState({ state, message })

const API = `${import.meta.env.BASE_URL}api/settings`
const DEBOUNCE_MS = 1500
// Vitest has no server to talk to; stores just behave as in-memory there.
const ENABLED = !import.meta.env.VITEST

let doc: Record<string, unknown> = {}
let version = 0
let loading: Promise<void> | null = null
let dirty = false
let timer: ReturnType<typeof setTimeout> | undefined
let inflight: Promise<void> | null = null

async function call(method: 'GET' | 'PUT', body?: unknown, keepalive = false) {
  return fetch(API, {
    method,
    credentials: 'same-origin',
    keepalive,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function fetchRemote(): Promise<{ doc: Record<string, unknown>; version: number }> {
  const res = await call('GET')
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      res.status === 401
        ? 'Your session has expired. Sign in to the admin again, then reload.'
        : 'Only owners and admins can open the cost calculator.',
    )
  }
  if (!res.ok) throw new Error(`The server answered ${res.status}.`)
  const body = await res.json()
  return {
    doc: (body?.data?.doc ?? {}) as Record<string, unknown>,
    version: Number(body?.data?.version ?? 0),
  }
}

/** Load the document once. A failed load can be retried by calling it again. */
export function loadRemote(): Promise<void> {
  if (!ENABLED) return Promise.resolve()
  if (!loading) {
    loading = fetchRemote().then(
      (remote) => {
        doc = remote.doc
        version = remote.version
      },
      (e) => {
        loading = null
        throw e
      },
    )
  }
  return loading
}

async function save(keepalive = false): Promise<void> {
  if (!dirty) return
  // One save at a time, so versions are always taken in order.
  if (inflight) {
    await inflight
    return save(keepalive)
  }
  dirty = false
  setStatus('saving')
  inflight = (async () => {
    try {
      const res = await call('PUT', { doc, expected_version: version }, keepalive)
      if (res.ok) {
        const body = await res.json()
        version = Number(body?.data?.version ?? version + 1)
        setStatus(dirty ? 'saving' : 'saved')
      } else if (res.status === 409) {
        dirty = true
        setStatus('conflict', 'These settings were changed somewhere else.')
      } else {
        dirty = true
        setStatus(
          'error',
          res.status === 401
            ? 'Your session expired. Sign in again; your edits are still on screen.'
            : `Could not save (server answered ${res.status}).`,
        )
      }
    } catch {
      dirty = true
      setStatus('error', 'Could not reach the server. Your edits are still on screen.')
    }
  })()
  await inflight
  inflight = null
  const { state } = useSyncStatus.getState()
  if (dirty && state === 'saving') await save()
}

function schedule() {
  clearTimeout(timer)
  timer = setTimeout(() => void save(), DEBOUNCE_MS)
}

/** Save now, ignoring the debounce (the Retry button, and when the tab closes). */
export function saveNow(): Promise<void> {
  clearTimeout(timer)
  return save()
}

/** Conflict, option 1: throw away this tab's edits and show what is saved. */
export function reloadFromServer(): void {
  window.location.reload()
}

/** Conflict, option 2: keep this tab's edits and save them over the newer version. */
export async function overwriteServer(): Promise<void> {
  try {
    // Only the current version is wanted; `doc` keeps this tab's edits.
    version = (await fetchRemote()).version
  } catch (e) {
    setStatus('error', e instanceof Error ? e.message : 'Could not reach the server.')
    return
  }
  dirty = true
  setStatus('saving')
  await save()
}

export function remotePersistStorage<S>(): PersistStorage<S> {
  return {
    async getItem(name) {
      if (!ENABLED) return null
      await loadRemote()
      const value = doc[name] as StorageValue<S> | undefined
      return value ?? null
    },
    setItem(name, value) {
      if (!ENABLED) return
      // Strip functions and anything JSON can't carry, exactly as a real save would.
      const plain = JSON.parse(JSON.stringify(value)) as unknown
      doc[name] = plain
      dirty = true
      if (useSyncStatus.getState().state === 'conflict') return // wait for the user's choice
      setStatus('saving')
      schedule()
    },
    removeItem(name) {
      if (!ENABLED) return
      delete doc[name]
      dirty = true
      if (useSyncStatus.getState().state === 'conflict') return
      setStatus('saving')
      schedule()
    },
  }
}

if (ENABLED && typeof window !== 'undefined') {
  // Closing the tab inside the debounce window must not lose the last edit.
  const flushOnLeave = () => {
    if (dirty && useSyncStatus.getState().state === 'saving') {
      clearTimeout(timer)
      void save(true)
    }
  }
  window.addEventListener('pagehide', flushOnLeave)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnLeave()
  })
  window.addEventListener('beforeunload', (e) => {
    const { state } = useSyncStatus.getState()
    if (dirty && state !== 'saved') e.preventDefault()
  })
}
