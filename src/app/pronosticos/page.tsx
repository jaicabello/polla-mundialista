'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
} from 'firebase/firestore'
import type { Partido, Usuario, Prediccion } from '@/types'
import { getFlag } from '@/lib/flags'

const ICONOS_FASE: Record<string, string> = {
  Dieciseisavos: '1/16',
  'Octavos de Final': '1/8',
  'Cuartos de Final': '1/4',
  Semifinal: '1/2',
  'Tercer Puesto': '3°',
  Final: '🏆',
}

export default function PronosticosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [usuarioId, setUsuarioId] = useState('')
  const [partidos, setPartidos] = useState<Partido[]>([])
  const [predicciones, setPredicciones] = useState<
    Record<string, { goles1Pred: number; goles2Pred: number; penales1Pred: number | null; penales2Pred: number | null }>
  >({})
  const [saving, setSaving] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    tipo: 'ok' | 'error'
    msg: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())
  const [faseActiva, setFaseActiva] = useState('Todos')

  const fases = useMemo(() => {
    const set = new Set(partidos.map((p) => p.fase))
    return ['Todos', ...set]
  }, [partidos])

  const partidosFiltrados = useMemo(
    () => (faseActiva === 'Todos' ? partidos : partidos.filter((p) => p.fase === faseActiva)),
    [partidos, faseActiva]
  )

  useEffect(() => {
    const cargarUsuarios = async () => {
      const snap = await getDocs(collection(db, 'usuarios'))
      const users = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Usuario
      )
      setUsuarios(users)
      const stored =
        typeof window !== 'undefined'
          ? localStorage.getItem('polla-usuario-id')
          : null
      if (stored && users.find((u) => u.id === stored)) {
        setUsuarioId(stored)
      } else if (users.length > 0) {
        setUsuarioId(users[0].id)
      }
    }

    const cargarPartidos = async () => {
      const snap = await getDocs(collection(db, 'partidos'))
      const matches = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Partido
      )
      matches.sort(
        (a, b) =>
          new Date(a.fechaLimite).getTime() -
          new Date(b.fechaLimite).getTime()
      )
      setPartidos(matches)
      setLoading(false)
    }

    Promise.all([cargarUsuarios(), cargarPartidos()])
  }, [])

  useEffect(() => {
    if (!usuarioId) return
    localStorage.setItem('polla-usuario-id', usuarioId)

    const cargarPredicciones = async () => {
      const q = query(
        collection(db, 'predicciones'),
        where('usuarioId', '==', usuarioId)
      )
      const snap = await getDocs(q)
      const preds: Record<
        string,
        { goles1Pred: number; goles2Pred: number; penales1Pred: number | null; penales2Pred: number | null }
      > = {}
      snap.docs.forEach((d) => {
        const data = d.data() as Prediccion
        preds[data.partidoId] = {
          goles1Pred: data.goles1Pred,
          goles2Pred: data.goles2Pred,
          penales1Pred: data.penales1Pred ?? null,
          penales2Pred: data.penales2Pred ?? null,
        }
      })
      setPredicciones(preds)
    }

    cargarPredicciones()
  }, [usuarioId])

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const isExpired = useCallback(
    (fechaLimite: string) => now >= new Date(fechaLimite),
    [now]
  )

  const handleChange = (
    partidoId: string,
    campo: 'goles1Pred' | 'goles2Pred' | 'penales1Pred' | 'penales2Pred',
    valor: string
  ) => {
    const limpio = valor.replace(/\D/g, '')
    const num = limpio === '' ? 0 : Math.max(0, parseInt(limpio, 10) || 0)
    setPredicciones((prev) => ({
      ...prev,
      [partidoId]: {
        ...prev[partidoId],
        [campo]: num,
      },
    }))
  }

  const guardar = async (
    partidoId: string,
    goles1: number,
    goles2: number,
    penales1: number | null,
    penales2: number | null
  ) => {
    if (!usuarioId) return
    setSaving(partidoId)
    setFeedback(null)
    try {
      const docId = `${usuarioId}_${partidoId}`
      await setDoc(doc(db, 'predicciones', docId), {
        usuarioId,
        partidoId,
        goles1Pred: goles1,
        goles2Pred: goles2,
        penales1Pred: penales1,
        penales2Pred: penales2,
        puntosGanados: 0,
        penalesPuntos: 0,
        procesado: false,
      })
      setPredicciones((prev) => ({
        ...prev,
        [partidoId]: { goles1Pred: goles1, goles2Pred: goles2, penales1Pred: penales1, penales2Pred: penales2 },
      }))
      setFeedback({ tipo: 'ok', msg: 'Pronóstico guardado' })
      setTimeout(() => setFeedback(null), 2000)
    } catch {
      setFeedback({ tipo: 'error', msg: 'Error al guardar' })
      setTimeout(() => setFeedback(null), 2000)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-zinc-500 dark:text-zinc-400">
        Cargando...
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-center mb-6 dark:text-white">
        Mis Pronósticos
      </h1>

      <div className="mb-6">
        <label
          htmlFor="usuario-select"
          className="block text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-1"
        >
          Seleccionar usuario
        </label>
        <select
          id="usuario-select"
          value={usuarioId}
          onChange={(e) => setUsuarioId(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        >
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>
      </div>

      {feedback && (
        <div
          className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${
            feedback.tipo === 'ok'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {partidos.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
          No hay partidos cargados
        </div>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto pb-2 mb-4 scrollbar-none">
            {fases.map((fase) => {
              const count = fase === 'Todos' ? partidos.length : partidos.filter((p) => p.fase === fase).length
              return (
                <button
                  key={fase}
                  onClick={() => setFaseActiva(fase)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    faseActiva === fase
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                  }`}
                >
                  <span className="leading-tight">{ICONOS_FASE[fase] || fase}</span>
                  <span className="text-[10px] opacity-70 ml-1">({count})</span>
                </button>
              )
            })}
          </div>

          {partidosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
              No hay partidos en esta fase
            </div>
          ) : (
            <div className="space-y-4">
              {partidosFiltrados.map((p) => {
            const expired = isExpired(p.fechaLimite)
            const tieneResultado = p.goles1Real !== null && p.goles2Real !== null
            const pred = predicciones[p.id]
            const g1 = pred?.goles1Pred
            const g2 = pred?.goles2Pred
            const isSaving = saving === p.id

            return (
              <div
                key={p.id}
                className={`bg-white dark:bg-zinc-900 rounded-xl border p-4 shadow-sm ${
                  tieneResultado
                    ? 'border-green-200 dark:border-green-800'
                    : expired
                    ? 'border-zinc-200 dark:border-zinc-700 opacity-60'
                    : 'border-zinc-200 dark:border-zinc-700'
                }`}
              >
                {tieneResultado ? (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                        {p.fase}
                      </span>
                      <span className="text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                        Finalizado
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                      {new Date(p.fechaLimite).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>

                    <div className="text-center mb-3 flex items-center justify-center gap-2">
                      <span className="shrink-0">{getFlag(p.equipo1)}</span>
                      <span className="text-base font-semibold dark:text-zinc-200 truncate max-w-[120px]">
                        {p.equipo1}
                      </span>
                      <span className="shrink-0 text-zinc-400 dark:text-zinc-500 text-xs">vs</span>
                      <span className="text-base font-semibold dark:text-zinc-200 truncate max-w-[120px]">
                        {p.equipo2}
                      </span>
                      <span className="shrink-0">{getFlag(p.equipo2)}</span>
                    </div>

                    <div className="flex items-center justify-center gap-4">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Pronóstico</span>
                        <span className="w-12 h-8 flex items-center justify-center text-sm font-bold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                          {pred ? g1 : '-'}
                        </span>
                      </div>
                      <span className="text-zinc-300 dark:text-zinc-600 font-bold">:</span>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Pronóstico</span>
                        <span className="w-12 h-8 flex items-center justify-center text-sm font-bold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                          {pred ? g2 : '-'}
                        </span>
                      </div>
                      <div className="mx-1 h-8 w-px bg-zinc-200 dark:bg-zinc-700" />
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-green-600 dark:text-green-400">Real</span>
                        <span className="w-12 h-8 flex items-center justify-center text-sm font-bold rounded-lg bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          {p.goles1Real}
                        </span>
                      </div>
                      <span className="text-zinc-300 dark:text-zinc-600 font-bold">:</span>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-green-600 dark:text-green-400">Real</span>
                        <span className="w-12 h-8 flex items-center justify-center text-sm font-bold rounded-lg bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          {p.goles2Real}
                        </span>
                      </div>
                    </div>

                    {pred && (
                      <div className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                        <div>
                          {g1 === p.goles1Real && g2 === p.goles2Real
                            ? '⚽ ¡Resultado exacto!'
                            : ((g1 > g2 && p.goles1Real! > p.goles2Real!) ||
                               (g2 > g1 && p.goles2Real! > p.goles1Real!) ||
                               (g1 === g2 && p.goles1Real === p.goles2Real))
                            ? '✅ Ganador acertado'
                            : '❌ Incorrecto'}
                        </div>
                        {p.golesPenales1 !== null && p.golesPenales2 !== null && (
                          <div className="flex items-center justify-center gap-2 text-[11px]">
                            <span className="text-amber-500 dark:text-amber-400 font-medium">Penales</span>
                            <span className="font-bold">
                              {pred.penales1Pred != null ? pred.penales1Pred : '-'} : {pred.penales2Pred != null ? pred.penales2Pred : '-'}
                            </span>
                            <span className="text-zinc-300 dark:text-zinc-600">→</span>
                            <span className="font-bold text-green-600 dark:text-green-400">
                              {p.golesPenales1} : {p.golesPenales2}
                            </span>
                            {pred.penales1Pred != null && pred.penales2Pred != null && (
                              <span className="ml-1">
                                {((pred.penales1Pred > pred.penales2Pred && p.golesPenales1 > p.golesPenales2) ||
                                  (pred.penales2Pred > pred.penales1Pred && p.golesPenales2 > p.golesPenales1))
                                  ? '✅'
                                  : '❌'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                        {p.fase}
                      </span>
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                      {new Date(p.fechaLimite).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>

                    <div className="flex items-center justify-center gap-2">
                      <span className="shrink-0">{getFlag(p.equipo1)}</span>
                      <span className="text-base font-semibold w-24 text-right truncate dark:text-zinc-200">
                        {p.equipo1}
                      </span>
                      <div className="shrink-0 flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min={0}
                          max={99}
                          value={g1 !== undefined ? String(g1) : ''}
                          disabled={expired}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            handleChange(p.id, 'goles1Pred', e.target.value)
                          }
                          className={`w-14 h-10 text-center text-lg font-bold rounded-lg border ${
                            expired
                              ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500'
                              : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 focus:ring-2 focus:ring-blue-500 focus:outline-none text-zinc-900 dark:text-zinc-100'
                          }`}
                        />
                        <span className="text-zinc-400 dark:text-zinc-500 font-bold">-</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min={0}
                          max={99}
                          value={g2 !== undefined ? String(g2) : ''}
                          disabled={expired}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            handleChange(p.id, 'goles2Pred', e.target.value)
                          }
                          className={`w-14 h-10 text-center text-lg font-bold rounded-lg border ${
                            expired
                              ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500'
                              : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 focus:ring-2 focus:ring-blue-500 focus:outline-none text-zinc-900 dark:text-zinc-100'
                          }`}
                        />
                      </div>
                      <span className="text-base font-semibold w-24 truncate dark:text-zinc-200">
                        {p.equipo2}
                      </span>
                      <span className="shrink-0">{getFlag(p.equipo2)}</span>
                    </div>

                    {!expired && (
                      <div className="mt-3 space-y-3">
                        <label className="flex items-center justify-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={pred?.penales1Pred != null}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setPredicciones((prev) => ({
                                ...prev,
                                [p.id]: {
                                  ...prev[p.id],
                                  goles1Pred: prev[p.id]?.goles1Pred ?? 0,
                                  goles2Pred: prev[p.id]?.goles2Pred ?? 0,
                                  penales1Pred: checked ? 0 : null,
                                  penales2Pred: checked ? 0 : null,
                                },
                              }))
                            }}
                            className="rounded border-zinc-300 dark:border-zinc-600 text-amber-500 focus:ring-amber-500"
                          />
                          ¿Cree que va a penales?
                        </label>
                        {pred?.penales1Pred != null && (
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-xs text-amber-500 dark:text-amber-400 font-medium">PEN</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              min={0}
                              max={99}
                              value={pred.penales1Pred ?? ''}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) =>
                                handleChange(p.id, 'penales1Pred', e.target.value)
                              }
                              className="w-14 h-10 text-center text-lg font-bold rounded-lg border border-zinc-300 dark:border-zinc-600 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                            />
                            <span className="text-zinc-400 dark:text-zinc-500 font-bold">-</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              min={0}
                              max={99}
                              value={pred.penales2Pred ?? ''}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) =>
                                handleChange(p.id, 'penales2Pred', e.target.value)
                              }
                              className="w-14 h-10 text-center text-lg font-bold rounded-lg border border-zinc-300 dark:border-zinc-600 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                            />
                          </div>
                        )}
                        <div className="text-center">
                          <button
                            onClick={() => guardar(p.id, g1 ?? 0, g2 ?? 0, pred?.penales1Pred ?? null, pred?.penales2Pred ?? null)}
                            disabled={isSaving || g1 === undefined || g2 === undefined}
                            className={`px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                              isSaving || g1 === undefined || g2 === undefined
                                ? 'bg-blue-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                            }`}
                          >
                            {isSaving ? 'Guardando...' : 'Guardar Pronóstico'}
                          </button>
                        </div>
                      </div>
                    )}

                    {expired && (
                      <p className="mt-3 text-center text-xs text-zinc-400 dark:text-zinc-500">
                        Tiempo límite expirado — esperando resultado
                      </p>
                    )}
                  </>
                )}
              </div>
            )
          })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
