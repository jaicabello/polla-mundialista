'use client'

import { useEffect, useState, useRef } from 'react'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
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
  const [nombre, setNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  const crearUsuario = async () => {
    const name = nombre.trim()
    if (!name) return
    const id = name.toLowerCase().replace(/\s+/g, '')
    if (usuarios.find((u) => u.id === id)) {
      setError(`El usuario "${name}" ya existe`)
      return
    }
    setCreando(true)
    setError(null)
    try {
      await setDoc(doc(db, 'usuarios', id), {
        nombre: name,
        puntosTotales: 0,
      })
      setNombre('')
      inputRef.current?.focus()
    } catch {
      setError('Error al crear usuario')
    } finally {
      setCreando(false)
    }
  }

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
          <div className="flex items-center gap-2 mb-4">
            <input
              ref={inputRef}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && crearUsuario()}
              placeholder="Nombre del nuevo usuario"
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={crearUsuario}
              disabled={creando || !nombre.trim()}
              className="shrink-0 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-600 transition-colors"
            >
              {creando ? 'Agregando...' : 'Agregar'}
            </button>
          </div>

          {error && (
            <div className="mb-4 px-4 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
              {error}
            </div>
          )}

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
