import { overwriteServer, reloadFromServer, saveNow, useSyncStatus } from '@/lib/remoteStorage'

const PILL = 'text-xs px-2 py-1 rounded border'

/** The real state of the server save — replaces the old always-green "All saved". */
export function SaveStatus() {
  const { state, message } = useSyncStatus()

  if (state === 'conflict') {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className={`${PILL} text-amber-300 bg-amber-900/30 border-amber-700/40`} title={message ?? ''}>
          Changed elsewhere
        </span>
        <button onClick={reloadFromServer} className="text-slate-300 underline hover:text-white">
          Load the latest (drops my edits)
        </button>
        <button onClick={() => void overwriteServer()} className="text-orange-400 underline hover:text-orange-300">
          Keep mine
        </button>
      </div>
    )
  }
  if (state === 'error') {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className={`${PILL} text-red-300 bg-red-900/30 border-red-700/40`} title={message ?? ''}>
          {message ?? 'Not saved'}
        </span>
        <button onClick={() => void saveNow()} className="text-orange-400 underline hover:text-orange-300">
          Retry
        </button>
      </div>
    )
  }
  if (state === 'saving') {
    return <span className={`${PILL} text-amber-300 bg-amber-900/30 border-amber-700/40`}>Saving…</span>
  }
  return (
    <span className={`${PILL} text-emerald-400 bg-emerald-900/30 border-emerald-700/40`}>
      {state === 'saved' ? 'Saved' : 'All saved'}
    </span>
  )
}
