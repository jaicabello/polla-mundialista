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
  fechaLimite: string
  estado: 'NS' | 'FT'
}

export interface Prediccion {
  usuarioId: string
  partidoId: string
  goles1Pred: number
  goles2Pred: number
  puntosGanados: number
  procesado: boolean
}
