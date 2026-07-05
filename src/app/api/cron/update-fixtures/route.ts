import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { calcularPuntos } from '@/lib/puntajes'

interface FinishedMatch {
  id: string
  goles1: number
  goles2: number
}

async function fetchFromFootballData(): Promise<FinishedMatch[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) throw new Error('FOOTBALL_DATA_API_KEY no configurada')

  const competitionId = process.env.FOOTBALL_COMPETITION_ID || 'WC'
  const res = await fetch(
    `https://api.football-data.org/v4/competitions/${competitionId}/matches`,
    { headers: { 'X-Auth-Token': apiKey } }
  )
  if (!res.ok) throw new Error(`Error Football API: ${res.status}`)

  const data = await res.json()

  return data.matches
    .filter((m: any) => m.status === 'FINISHED')
    .map((m: any) => ({
      id: String(m.id),
      goles1: m.score.fullTime.home,
      goles2: m.score.fullTime.away,
    }))
}

async function fetchFromApiFootball(): Promise<FinishedMatch[]> {
  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) throw new Error('RAPIDAPI_KEY no configurada')

  const leagueId = process.env.API_FOOTBALL_LEAGUE_ID || '1'
  const season = process.env.API_FOOTBALL_SEASON || '2022'
  const res = await fetch(
    `https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${leagueId}&season=${season}`,
    {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
      },
    }
  )
  if (!res.ok) throw new Error(`Error API-Football: ${res.status}`)

  const data = await res.json()

  return data.response
    .filter((f: any) => f.fixture.status.short === 'FT')
    .map((f: any) => ({
      id: String(f.fixture.id),
      goles1: f.goals.home ?? f.score.fulltime.home,
      goles2: f.goals.away ?? f.score.fulltime.away,
    }))
}

export async function GET() {
  try {
    const provider = process.env.FOOTBALL_API_PROVIDER || 'football-data'
    const finishedMatches =
      provider === 'api-football'
        ? await fetchFromApiFootball()
        : await fetchFromFootballData()

    if (finishedMatches.length === 0) {
      return NextResponse.json({
        message: 'No hay partidos finalizados nuevos',
        processed: 0,
      })
    }

    const partidosRef = adminDb.collection('partidos')
    const prediccionesRef = adminDb.collection('predicciones')
    const usuariosRef = adminDb.collection('usuarios')
    let processedCount = 0

    for (const match of finishedMatches) {
      const partidoSnap = await partidosRef.doc(match.id).get()
      if (!partidoSnap.exists) continue

      const partidoData = partidoSnap.data()!
      if (partidoData.estado === 'FT') continue

      const prediccionesSnap = await prediccionesRef
        .where('partidoId', '==', match.id)
        .where('procesado', '==', false)
        .get()

      const batch = adminDb.batch()
      batch.update(partidosRef.doc(match.id), {
        goles1Real: match.goles1,
        goles2Real: match.goles2,
        estado: 'FT',
      })

      prediccionesSnap.forEach((predDoc) => {
        const pred = predDoc.data()
        const puntos = calcularPuntos(
          match.goles1,
          match.goles2,
          pred.goles1Pred,
          pred.goles2Pred
        )

        batch.update(prediccionesRef.doc(predDoc.id), {
          puntosGanados: puntos,
          procesado: true,
        })

        batch.update(usuariosRef.doc(pred.usuarioId), {
          puntosTotales: FieldValue.increment(puntos),
        })

        processedCount++
      })

      await batch.commit()
    }

    return NextResponse.json({
      message: 'Fixture actualizado correctamente',
      processed: processedCount,
      finished: finishedMatches.length,
    })
  } catch (error) {
    console.error('Error en cron update-fixtures:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
