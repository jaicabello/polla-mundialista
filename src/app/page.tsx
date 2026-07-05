'use client'

import { useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore'
import type { Usuario } from '@/types'

interface UsuarioConPosicion extends Usuario {
  posicion: number
}

const POSITION_COLORS = [
  'text-amber-500',
  'text-gray-400',
  'text-amber-700',
]

export default function HomePage() {
  const [usuarios, setUsuarios] = useState<UsuarioConPosicion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'usuarios'),
      orderBy('puntosTotales', 'desc')
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const users = snap.docs.map((d, i) => ({
          id: d.id,
          ...d.data(),
          posicion: i + 1,
        })) as UsuarioConPosicion[]
        setUsuarios(users)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching leaderboard:', err)
        setLoading(false)
      }
    )
    return unsub
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-center mb-6 dark:text-white">
        Ranking General
      </h1>

      {loading ? (
        <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
          Cargando...
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-100 dark:bg-zinc-800 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                  <th className="px-4 py-3 text-left w-12">#</th>
                  <th className="px-4 py-3 text-left">Nombre</th>
                  <th className="px-4 py-3 text-right w-24">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-12 text-center text-zinc-400 dark:text-zinc-500"
                    >
                      No hay usuarios registrados
                    </td>
                  </tr>
                ) : (
                  usuarios.map((u) => (
                    <tr
                      key={u.id}
                      className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={
                            u.posicion <= 3
                              ? `font-bold ${POSITION_COLORS[u.posicion - 1]}`
                              : 'text-zinc-500 dark:text-zinc-400'
                          }
                        >
                          {u.posicion <= 3
                            ? ['🥇', '🥈', '🥉'][u.posicion - 1]
                            : `#${u.posicion}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium dark:text-zinc-200">
                        {u.nombre}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold tabular-nums dark:text-zinc-100">
                        {u.puntosTotales}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">
              Sistema de puntuación
            </p>
            <p>⚽ Resultado exacto: <strong className="text-zinc-800 dark:text-zinc-200">6 puntos</strong></p>
            <p>✅ Ganador o empate acertado: <strong className="text-zinc-800 dark:text-zinc-200">3 puntos</strong></p>
            <p>❌ Pronóstico incorrecto: <strong className="text-zinc-800 dark:text-zinc-200">0 puntos</strong></p>
          </div>
        </>
      )}
    </div>
  )
}
