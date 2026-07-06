export interface Usuario {
  id: string
  nombre: string
  puntosTotales: number
}

export interface Partido {
  id: string
  fase: string
  equipo1: string
  equipo2: string
  goles1Real: number | null
  goles2Real: number | null
  golesPenales1: number | null
  golesPenales2: number | null
  fechaLimite: string
  estado: 'NS' | 'FT'
}

export interface Prediccion {
  usuarioId: string
  partidoId: string
  goles1Pred: number
  goles2Pred: number
  penales1Pred: number | null
  penales2Pred: number | null
  puntosGanados: number
  penalesPuntos: number
  procesado: boolean
}
