import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { loadRemote } from '@/lib/remoteStorage'
import { useSettingsStore } from '@/store/settingsStore'
import { usePlannerStore } from '@/store/plannerStore'

const root = ReactDOM.createRoot(document.getElementById('root')!)

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-300 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-3">{children}</div>
    </div>
  )
}

/**
 * Nothing renders until the saved settings are loaded. If the load fails the
 * app stays on this screen: showing defaults would let the next edit save over
 * the real settings.
 */
async function start() {
  root.render(<Splash><p>Loading your settings…</p></Splash>)
  try {
    await loadRemote()
    await Promise.all([
      useSettingsStore.persist.rehydrate(),
      usePlannerStore.persist.rehydrate(),
    ])
  } catch (e) {
    root.render(
      <Splash>
        <p className="text-lg font-semibold text-white">Couldn't load your settings</p>
        <p className="text-sm text-slate-400">{e instanceof Error ? e.message : 'Unknown error.'}</p>
        <p className="text-xs text-slate-500">
          Nothing is shown rather than defaults, so a stray edit can't overwrite what you saved.
        </p>
        <button
          onClick={() => void start()}
          className="mt-2 px-4 py-2 rounded-md bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium"
        >
          Try again
        </button>
      </Splash>,
    )
    return
  }
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void start()
