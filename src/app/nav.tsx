'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from './theme-toggle'

const LINKS = [
  { href: '/', label: 'Ranking' },
  { href: '/dashboard', label: 'Fixture' },
  { href: '/pronosticos', label: 'Pronósticos' },
  { href: '/goleadores', label: 'Goleadores' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <div className="hidden md:flex items-center gap-2">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pathname === l.href
                ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-white'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            {l.label}
          </Link>
        ))}
        <ThemeToggle />
      </div>

      <button
        onClick={() => setOpen(!open)}
        className="md:hidden p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        aria-label="Menú"
      >
        <svg className="w-6 h-6 text-zinc-700 dark:text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {open && (
        <div className="absolute top-14 left-0 right-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-lg md:hidden">
          <div className="flex flex-col px-4 py-3 gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === l.href
                    ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-white'
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                {l.label}
              </Link>
            ))}
            <div className="px-3 py-2 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <span>Tema</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
