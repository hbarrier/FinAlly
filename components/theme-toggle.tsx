'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { Icon } from './fern/icon'

const THEME_EVENT = 'fern-theme-change'

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(THEME_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

function getSnapshot() {
  return localStorage.getItem('fern-theme') === 'dark'
}

function getServerSnapshot() {
  return false
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = useCallback(() => {
    const next = localStorage.getItem('fern-theme') !== 'dark'
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    localStorage.setItem('fern-theme', next ? 'dark' : 'light')
    window.dispatchEvent(new Event(THEME_EVENT))
  }, [])

  return (
    <button
      onClick={toggle}
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 34,
        height: 34,
        borderRadius: 10,
        background: 'var(--bg-sunken)',
        color: 'var(--ink-soft)',
        border: 'none',
        cursor: 'pointer',
        flexShrink: 0,
      }}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={16} />
    </button>
  )
}
