'use client'

import { useEffect, useState } from 'react'
import { Icon } from './fern/icon'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('fern-theme')
    if (stored === 'dark') {
      setDark(true)
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    localStorage.setItem('fern-theme', next ? 'dark' : 'light')
  }

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
