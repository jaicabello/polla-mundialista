'use client'

import { useEffect, useState } from 'react'

interface Scorer {
  player: { name: string; nationality: string }
  team: { name: string; crest: string }
  goals: number
  assists: number | null
  playedMatches: number
  penalties: number | null
}

export default function GoleadoresPage() {
  const [scorers, setScorers] = useState<Scorer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/scorers')
      .then((r) => r.json())
      .then((data) => {
        setScorers(data.scorers || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-center mb-2 dark:text-white">
        Goleadores
      </h1>
      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        Mundial 2026 — Top 10
      </p>

      {loading ? (
        <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
          Cargando...
        </div>
      ) : scorers.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
          No hay datos disponibles
        </div>
      ) : (
        <div className="space-y-2">
          {scorers.map((s, i) => (
            <div
              key={s.player.name}
              className="flex items-center gap-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 shadow-sm"
            >
              <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${
                i === 0
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  : i === 1
                  ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300'
                  : i === 2
                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                  : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
              }`}>
                {i + 1}
              </span>
              <img
                src={s.team.crest}
                alt={s.team.name}
                className="w-6 h-6 object-contain shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold dark:text-white truncate">
                  {s.player.name}
                </div>
                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                  {s.team.name} · {s.player.nationality}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
                  {s.goals}
                </div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  {s.playedMatches} PJ
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
