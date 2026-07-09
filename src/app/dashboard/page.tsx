'use client'

import { useEffect, useState, useMemo } from 'react'
import { db } from '@/lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
import type { Partido } from '@/types'
import { getFlag } from '@/lib/flags'

const ORDEN_FASES = [
  'Dieciseisavos',
  'Octavos de Final',
  'Cuartos de Final',
  'Semifinal',
  'Tercer Puesto',
  'Final',
]

const ICONOS_FASE: Record<string, string> = {
  Dieciseisavos: '1/16',
  'Octavos de Final': '1/8',
  'Cuartos de Final': '1/4',
  Semifinal: '1/2',
  'Tercer Puesto': '3°',
  Final: '🏆',
}

type EstadoPartido = 'pasado' | 'hoy' | 'futuro'

function getEstadoPartido(fechaLimite: string): EstadoPartido {
  const ahora = new Date()
  const partido = new Date(fechaLimite)
  const diff = partido.getTime() - ahora.getTime()
  if (diff < 0) return 'pasado'
  if (diff < 24 * 60 * 60 * 1000) return 'hoy'
  return 'futuro'
}

function formatFecha(fechaLimite: string) {
  const d = new Date(fechaLimite)
  const hoy = new Date()
  const esHoy =
    d.getDate() === hoy.getDate() &&
    d.getMonth() === hoy.getMonth() &&
    d.getFullYear() === hoy.getFullYear()
  const manana = new Date(hoy)
  manana.setDate(manana.getDate() + 1)
  const esManana =
    d.getDate() === manana.getDate() &&
    d.getMonth() === manana.getMonth() &&
    d.getFullYear() === manana.getFullYear()

  const hora = d.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  if (esHoy) return `Hoy ${hora}`
  if (esManana) return `Mañana ${hora}`

  return d.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function getGanador(p: Partido): string | null {
  if (p.goles1Real === null || p.goles2Real === null) return null
  if (p.goles1Real > p.goles2Real) return p.equipo1
  if (p.goles2Real > p.goles1Real) return p.equipo2
  if (p.golesPenales1 !== null && p.golesPenales2 !== null) {
    if (p.golesPenales1 > p.golesPenales2) return p.equipo1
    if (p.golesPenales2 > p.golesPenales1) return p.equipo2
  }
  return null
}

function getPerdedor(p: Partido): string | null {
  if (p.goles1Real === null || p.goles2Real === null) return null
  if (p.goles1Real > p.goles2Real) return p.equipo2
  if (p.goles2Real > p.goles1Real) return p.equipo1
  return null
}

interface MatchForm {
  goles1: string
  goles2: string
  penales1: string
  penales2: string
}

export default function DashboardPage() {
  const [partidos, setPartidos] = useState<Partido[]>([])
  const [loading, setLoading] = useState(true)
  const [forms, setForms] = useState<Record<string, MatchForm>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [faseActiva, setFaseActiva] = useState<string | null>(null)

  useEffect(() => {
    const cargar = async () => {
      try {
        const snap = await getDocs(collection(db, 'partidos'))
        const matches = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Partido
        )
        matches.sort((a, b) => {
          const idxA = ORDEN_FASES.indexOf(
            a.fase as (typeof ORDEN_FASES)[number]
          )
          const idxB = ORDEN_FASES.indexOf(
            b.fase as (typeof ORDEN_FASES)[number]
          )
          if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB
          return (
            new Date(a.fechaLimite).getTime() -
            new Date(b.fechaLimite).getTime()
          )
        })
        setPartidos(matches)

        for (const fase of ORDEN_FASES) {
          const match = matches.find(
            (m) =>
              m.fase === fase &&
              (m.goles1Real === null || m.goles2Real === null)
          )
          if (match) {
            setFaseActiva(fase)
            return
          }
        }
        setFaseActiva(ORDEN_FASES[ORDEN_FASES.length - 1])
      } catch (err) {
        console.error(err)
        setError('Error al cargar partidos')
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const fases = useMemo(() => {
    const map: Record<string, Partido[]> = {}
    for (const p of partidos) {
      if (!map[p.fase]) map[p.fase] = []
      map[p.fase].push(p)
    }
    return map
  }, [partidos])

  const fasesOrdenadas = useMemo(
    () =>
      Object.keys(fases).sort((a, b) => {
        const idxA = ORDEN_FASES.indexOf(a as (typeof ORDEN_FASES)[number])
        const idxB = ORDEN_FASES.indexOf(b as (typeof ORDEN_FASES)[number])
        if (idxA !== -1 && idxB !== -1) return idxA - idxB
        if (idxA !== -1) return -1
        if (idxB !== -1) return 1
        return a.localeCompare(b)
      }),
    [fases]
  )

  const handleGuardar = async (partidoId: string) => {
    const form = forms[partidoId]
    if (!form) return
    const goles1 = parseInt(form.goles1, 10)
    const goles2 = parseInt(form.goles2, 10)
    if (isNaN(goles1) || isNaN(goles2) || goles1 < 0 || goles2 < 0) {
      setError('Ingresá goles válidos')
      return
    }
    const penales1 = form.penales1 ? parseInt(form.penales1, 10) : undefined
    const penales2 = form.penales2 ? parseInt(form.penales2, 10) : undefined
    if (penales1 !== undefined && (isNaN(penales1) || penales1 < 0)) {
      setError('Goles de penales inválidos')
      return
    }
    if (penales2 !== undefined && (isNaN(penales2) || penales2 < 0)) {
      setError('Goles de penales inválidos')
      return
    }
    setSaving(partidoId)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/set-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partidoId, goles1Real: goles1, goles2Real: goles2,
          penales1Real: penales1, penales2Real: penales2,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }
      setPartidos((prev) =>
        prev.map((p) =>
          p.id === partidoId
            ? {
                ...p, goles1Real: goles1, goles2Real: goles2,
                golesPenales1: penales1 ?? null, golesPenales2: penales2 ?? null,
                estado: 'FT',
              }
            : p
        )
      )
      setForms((prev) => {
        const next = { ...prev }
        delete next[partidoId]
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(null)
    }
  }

  const equiposAvanzan = useMemo(() => {
    const avanzan: Record<string, string[]> = {}
    for (let i = 0; i < fasesOrdenadas.length - 1; i++) {
      const faseActual = fasesOrdenadas[i]
      const partidosFase = fases[faseActual] || []
      const ganadores: string[] = []
      for (const p of partidosFase) {
        const g = getGanador(p)
        if (g) ganadores.push(g)
      }
      avanzan[faseActual] = ganadores
    }
    return avanzan
  }, [fases, fasesOrdenadas])

  const equiposVienen = useMemo(() => {
    const vienen: Record<string, number> = {}
    for (let i = 1; i < fasesOrdenadas.length; i++) {
      const fase = fasesOrdenadas[i]
      const faseAnt = fasesOrdenadas[i - 1]
      const ganadoresAnt = equiposAvanzan[faseAnt] || []
      const partidosFase = fases[fase] || []
      let encontrados = 0
      for (const p of partidosFase) {
        if (ganadoresAnt.includes(p.equipo1)) encontrados++
        if (ganadoresAnt.includes(p.equipo2)) encontrados++
      }
      vienen[fase] = encontrados
    }
    return vienen
  }, [fasesOrdenadas, fases, equiposAvanzan])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center text-zinc-500 dark:text-zinc-400">
        Cargando fixture...
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold dark:text-white">Fixture Mundial 2026</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Fase eliminatoria — resultados oficiales
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
          {error}
        </div>
      )}

      {partidos.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
          No hay partidos cargados
        </div>
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto pb-2 mb-6 scrollbar-none">
            {fasesOrdenadas.map((fase) => {
              const total = fases[fase].length
              const jugados = fases[fase].filter(
                (p) => p.goles1Real !== null
              ).length
              return (
                <button
                  key={fase}
                  onClick={() => setFaseActiva(fase)}
                  className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    faseActiva === fase
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                  }`}
                >
                  <span className="block leading-tight">
                    {ICONOS_FASE[fase] || fase}
                  </span>
                  <span className="block text-[10px] opacity-70 mt-0.5">
                    {jugados}/{total}
                  </span>
                </button>
              )
            })}
          </div>

          {faseActiva &&
            fases[faseActiva] &&
            (() => {
              const matches = fases[faseActiva]
              const idx = fasesOrdenadas.indexOf(faseActiva)
              const noEsPrimera = idx > 0
              const equiposQueVienen = noEsPrimera
                ? equiposAvanzan[fasesOrdenadas[idx - 1]] || []
                : []
              const vienenCount = equiposVienen[faseActiva] || 0

              return (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold px-2.5 py-1 rounded">
                      {ICONOS_FASE[faseActiva] || faseActiva}
                    </div>
                    <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                      {faseActiva}
                    </h2>
                    {noEsPrimera && vienenCount > 0 && (
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 ml-auto">
                        {vienenCount} equipo{vienenCount !== 1 ? 's' : ''} desde fase anterior
                      </span>
                    )}
                  </div>

                  {noEsPrimera && equiposQueVienen.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {equiposQueVienen.map((eq) => {
                        const estaEnFase = matches.some(
                          (m) => m.equipo1 === eq || m.equipo2 === eq
                        )
                        return (
                          <span
                            key={eq}
                            className={`text-[11px] px-2 py-0.5 rounded-full border ${
                              estaEnFase
                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
                                : 'bg-zinc-50 text-zinc-400 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700'
                            }`}
                          >
                            {getFlag(eq)} {eq}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  <div
                    className={`grid gap-3 ${
                      matches.length > 2
                        ? 'sm:grid-cols-2 xl:grid-cols-3'
                        : 'sm:grid-cols-1'
                    }`}
                  >
                    {matches.map((p) => {
                      const tieneResultado =
                        p.goles1Real !== null && p.goles2Real !== null
                      const ganador = tieneResultado ? getGanador(p) : null
                      const perdedor = tieneResultado ? getPerdedor(p) : null
                      const empate =
                        tieneResultado && p.goles1Real === p.goles2Real
                      const estado = getEstadoPartido(p.fechaLimite)
                      const form = forms[p.id] || { goles1: '', goles2: '', penales1: '', penales2: '' }

                      return (
                        <div
                          key={p.id}
                          className={`bg-white dark:bg-zinc-900 rounded-xl border shadow-sm overflow-hidden ${
                            tieneResultado
                              ? 'border-zinc-200 dark:border-zinc-700'
                              : estado === 'hoy'
                              ? 'border-amber-400 border-2'
                              : estado === 'pasado'
                              ? 'border-zinc-200 dark:border-zinc-700 opacity-70'
                              : 'border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          <div
                            className={`flex items-center justify-between px-3 py-1.5 text-[11px] font-medium ${
                              tieneResultado
                                ? 'bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                                : estado === 'hoy'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                : estado === 'pasado'
                                ? 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-300'
                                : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                            }`}
                          >
                            <span>{formatFecha(p.fechaLimite)}</span>
                            <span>
                              {tieneResultado
                                ? empate
                                  ? 'Empate'
                                  : 'Finalizado'
                                : estado === 'hoy'
                                ? 'Hoy'
                                : estado === 'pasado'
                                ? 'Pendiente'
                                : 'Próximo'}
                            </span>
                          </div>

                          <div className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 min-w-0 flex items-center gap-1">
                                {ganador === p.equipo1 && (
                                  <span className="shrink-0 text-green-600 dark:text-green-400 mr-1">▶</span>
                                )}
                                <span className="shrink-0">{getFlag(p.equipo1)}</span>
                                <span
                                  className={`text-sm font-semibold truncate ${
                                    ganador === p.equipo1
                                      ? 'text-green-700 dark:text-green-400'
                                      : perdedor === p.equipo1
                                      ? 'text-zinc-400 dark:text-zinc-500'
                                      : 'text-zinc-800 dark:text-zinc-200'
                                  }`}
                                >
                                  {p.equipo1}
                                </span>
                              </div>

                              <div className="shrink-0 flex flex-col items-center gap-0.5">
                                {tieneResultado ? (
                                  <>
                                    <div className="flex items-center gap-1">
                                      <span
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${
                                          ganador === p.equipo1
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                                        }`}
                                      >
                                        {p.goles1Real}
                                      </span>
                                      <span className="text-zinc-300 dark:text-zinc-600 font-bold text-xs">
                                        :
                                      </span>
                                      <span
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${
                                          ganador === p.equipo2
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                                        }`}
                                      >
                                        {p.goles2Real}
                                      </span>
                                    </div>
                                    {p.golesPenales1 !== null && p.golesPenales2 !== null && (
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <span className="text-[9px] text-amber-500 dark:text-amber-400 font-medium mr-0.5">PEN</span>
                                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">{p.golesPenales1}</span>
                                        <span className="text-[9px] text-zinc-300 dark:text-zinc-600 font-bold">-</span>
                                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">{p.golesPenales2}</span>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      min={0}
                                      max={99}
                                      placeholder="-"
                                      value={form.goles1}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) =>
                                        setForms((prev) => ({
                                          ...prev,
                                          [p.id]: {
                                            ...prev[p.id],
                                            goles1: e.target.value.replace(/\D/g, ''),
                                          },
                                        }))
                                      }
                                      className="w-8 h-8 text-center text-sm font-bold rounded-lg border border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                    />
                                    <span className="text-zinc-300 dark:text-zinc-600 font-bold text-xs">
                                      :
                                    </span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      min={0}
                                      max={99}
                                      placeholder="-"
                                      value={form.goles2}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) =>
                                        setForms((prev) => ({
                                          ...prev,
                                          [p.id]: {
                                            ...prev[p.id],
                                            goles2: e.target.value.replace(/\D/g, ''),
                                          },
                                        }))
                                      }
                                      className="w-8 h-8 text-center text-sm font-bold rounded-lg border border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                    />
                                  </div>
                                )}
                              </div>

                              <div className="flex-1 min-w-0 flex items-center justify-end gap-1">
                                <span
                                  className={`text-sm font-semibold truncate ${
                                    ganador === p.equipo2
                                      ? 'text-green-700 dark:text-green-400'
                                      : perdedor === p.equipo2
                                      ? 'text-zinc-400 dark:text-zinc-500'
                                      : 'text-zinc-800 dark:text-zinc-200'
                                  }`}
                                >
                                  {p.equipo2}
                                </span>
                                <span className="shrink-0">{getFlag(p.equipo2)}</span>
                                {ganador === p.equipo2 && (
                                  <span className="shrink-0 text-green-600 dark:text-green-400 ml-1">▶</span>
                                )}
                              </div>
                            </div>

                            <div className="mt-2 flex items-center justify-between">
                              {tieneResultado ? (
                                <div className="flex items-center gap-2 text-[11px]">
                                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                    <svg
                                      className="w-3 h-3"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                      />
                                    </svg>
                                    Bloqueado
                                  </span>
                                  {!empate && ganador && (
                                    <span className="text-green-700 dark:text-green-400 font-medium">
                                      Avanza: {getFlag(ganador)} {ganador}
                                    </span>
                                  )}
                                  {empate && (
                                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                                      Empate
                                    </span>
                                  )}
                                </div>
                              ) : (
                                  <div className="flex flex-col gap-2 w-full">
                                    <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={form.penales1 !== ''}
                                        onChange={(e) =>
                                          setForms((prev) => ({
                                            ...prev,
                                            [p.id]: {
                                              ...prev[p.id],
                                              penales1: e.target.checked ? '0' : '',
                                              penales2: e.target.checked ? '0' : '',
                                            },
                                          }))
                                        }
                                        className="rounded border-zinc-300 dark:border-zinc-600 text-amber-500 focus:ring-amber-500"
                                      />
                                      Fue a penales
                                    </label>
                                    {form.penales1 !== '' && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">PEN</span>
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          min={0}
                                          max={99}
                                          placeholder="0"
                                          value={form.penales1}
                                          onFocus={(e) => e.target.select()}
                                          onChange={(e) =>
                                            setForms((prev) => ({
                                              ...prev,
                                              [p.id]: {
                                                ...prev[p.id],
                                                penales1: e.target.value.replace(/\D/g, ''),
                                              },
                                            }))
                                          }
                                          className="w-8 h-7 text-center text-xs font-bold rounded border border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                        />
                                        <span className="text-zinc-300 dark:text-zinc-600 font-bold text-[10px]">-</span>
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          min={0}
                                          max={99}
                                          placeholder="0"
                                          value={form.penales2}
                                          onFocus={(e) => e.target.select()}
                                          onChange={(e) =>
                                            setForms((prev) => ({
                                              ...prev,
                                              [p.id]: {
                                                ...prev[p.id],
                                                penales2: e.target.value.replace(/\D/g, ''),
                                              },
                                            }))
                                          }
                                          className="w-8 h-7 text-center text-xs font-bold rounded border border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                        />
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                      {estado === 'pasado' && (
                                        <span className="text-[11px] text-red-500 dark:text-red-400 font-medium">
                                          Fecha límite vencida
                                        </span>
                                      )}
                                      <button
                                        onClick={() => handleGuardar(p.id)}
                                        disabled={
                                          saving === p.id ||
                                          (!form.goles1 && !form.goles2)
                                        }
                                        className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors ${
                                          saving === p.id ||
                                          (!form.goles1 && !form.goles2)
                                            ? 'bg-zinc-300 dark:bg-zinc-600 cursor-not-allowed'
                                            : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 dark:bg-amber-500 dark:hover:bg-amber-600'
                                        }`}
                                      >
                                        {saving === p.id
                                          ? 'Guardando...'
                                          : 'Guardar Resultado'}
                                      </button>
                                    </div>
                                  </div>
                              )}
                            </div>

                            {tieneResultado && ganador && (
                              <div className="mt-2 pt-2 border-t border-dashed border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                                <svg
                                  className="w-3 h-3 text-green-500"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                                  />
                                </svg>
                                <span>
                                  <strong className="text-green-700 dark:text-green-400 font-medium">
                                    {getFlag(ganador)} {ganador}
                                  </strong>{' '}
                                  pasa a{' '}
                                  {fasesOrdenadas[idx + 1] || 'siguiente fase'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {idx < fasesOrdenadas.length - 1 && (
                    <div className="mt-6 flex items-center gap-3">
                      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium shrink-0">
                        Siguiente: {fasesOrdenadas[idx + 1]}
                      </span>
                      <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                    </div>
                  )}
                </div>
              )
            })()}
        </>
      )}
    </div>
  )
}
