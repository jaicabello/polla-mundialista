import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { calcularPuntos, calcularPuntosPenales } from '@/lib/puntajes';

interface FinishedMatch {
  id: string;
  goles1: number;
  goles2: number;
  penales1: number | null;
  penales2: number | null;
}

interface PartidoDoc {
  id: string;
  fase: string;
  equipo1: string;
  equipo2: string;
  goles1Real: number | null;
  goles2Real: number | null;
  golesPenales1: number | null;
  golesPenales2: number | null;
  fechaLimite: string;
  estado: string;
}

function getGanador(p: PartidoDoc): string | null {
  if (p.goles1Real === null || p.goles2Real === null) return null;
  if (p.goles1Real > p.goles2Real) return p.equipo1;
  if (p.goles2Real > p.goles1Real) return p.equipo2;
  if (p.golesPenales1 !== null && p.golesPenales2 !== null) {
    if (p.golesPenales1 > p.golesPenales2) return p.equipo1;
    if (p.golesPenales2 > p.golesPenales1) return p.equipo2;
  }
  return null;
}

function getPerdedor(p: PartidoDoc): string | null {
  if (p.goles1Real === null || p.goles2Real === null) return null;
  if (p.goles1Real > p.goles2Real) return p.equipo2;
  if (p.goles2Real > p.goles1Real) return p.equipo1;
  return null;
}

// Mapa de avance: partidoId actual → [{ partidoId destino, posición }]
const AVANCE_ELIMINATORIA: Record<string, { partidoId: string; posicion: 'equipo1' | 'equipo2'; tipo: 'ganador' | 'perdedor' }[]> = {
  // Cuartos → Semifinal
  '537383': [{ partidoId: '537387', posicion: 'equipo1', tipo: 'ganador' }],
  '537384': [{ partidoId: '537387', posicion: 'equipo2', tipo: 'ganador' }],
  '537385': [{ partidoId: '537388', posicion: 'equipo1', tipo: 'ganador' }],
  '537386': [{ partidoId: '537388', posicion: 'equipo2', tipo: 'ganador' }],
  // Semifinal → Final & Tercer Puesto
  '537387': [
    { partidoId: '537390', posicion: 'equipo1', tipo: 'ganador' },
    { partidoId: '537389', posicion: 'equipo1', tipo: 'perdedor' },
  ],
  '537388': [
    { partidoId: '537390', posicion: 'equipo2', tipo: 'ganador' },
    { partidoId: '537389', posicion: 'equipo2', tipo: 'perdedor' },
  ],
};

interface FootballDataMatch {
  id: number | string;
  status: string;
  score: {
    fullTime: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null } | null;
  };
}

async function fetchFromFootballData(): Promise<FinishedMatch[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) throw new Error('FOOTBALL_DATA_API_KEY no configurada');

  const competitionId = process.env.FOOTBALL_COMPETITION_ID || 'WC';
  const res = await fetch(
    `https://api.football-data.org/v4/competitions/${competitionId}/matches`,
    { headers: { 'X-Auth-Token': apiKey } },
  );
  if (!res.ok) throw new Error(`Error Football API: ${res.status}`);

  const data = await res.json();

  return (data.matches as FootballDataMatch[])
    .filter((m) => m.status === 'FINISHED')
    .map((m) => {
      const penales = m.score.penalties
      return {
        id: String(m.id),
        goles1: m.score.fullTime.home ?? 0,
        goles2: m.score.fullTime.away ?? 0,
        penales1: penales?.home ?? null,
        penales2: penales?.away ?? null,
      }
    });
}

async function fetchFromApiFootball(): Promise<FinishedMatch[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error('RAPIDAPI_KEY no configurada');

  const leagueId = process.env.API_FOOTBALL_LEAGUE_ID || '1';
  const season = process.env.API_FOOTBALL_SEASON || '2022';
  const res = await fetch(
    `https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${leagueId}&season=${season}`,
    {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
      },
    },
  );
  if (!res.ok) throw new Error(`Error API-Football: ${res.status}`);

  const data = await res.json();

  return (data.response as any[])
    .filter((f) => f.fixture?.status?.short === 'FT')
    .map((f) => ({
      id: String(f.fixture.id),
      goles1: f.goals?.home ?? f.score?.fulltime?.home ?? 0,
      goles2: f.goals?.away ?? f.score?.fulltime?.away ?? 0,
      penales1: f.score?.penalties?.home ?? null,
      penales2: f.score?.penalties?.away ?? null,
    }));
}

export async function GET() {
  try {
    const provider = process.env.FOOTBALL_API_PROVIDER || 'football-data';
    const finishedMatches =
      provider === 'api-football'
        ? await fetchFromApiFootball()
        : await fetchFromFootballData();

    if (finishedMatches.length === 0) {
      return NextResponse.json({
        message: 'No hay partidos finalizados nuevos',
        processed: 0,
      });
    }

    const partidosRef = adminDb.collection('partidos');
    const prediccionesRef = adminDb.collection('predicciones');
    const usuariosRef = adminDb.collection('usuarios');
    let processedCount = 0;

    for (const match of finishedMatches) {
      const partidoSnap = await partidosRef.doc(match.id).get();
      if (!partidoSnap.exists) continue;

      const partidoData = partidoSnap.data()!;
      if (partidoData.estado === 'FT') continue;
      if (new Date(partidoData.fechaLimite) > new Date()) continue;

      const prediccionesSnap = await prediccionesRef
        .where('partidoId', '==', match.id)
        .where('procesado', '==', false)
        .get();

      const updateData: Record<string, any> = {
        goles1Real: match.goles1,
        goles2Real: match.goles2,
        estado: 'FT',
      }
      if (match.penales1 !== null && match.penales2 !== null) {
        updateData.golesPenales1 = match.penales1
        updateData.golesPenales2 = match.penales2
      }
      const batch = adminDb.batch();
      batch.update(partidosRef.doc(match.id), updateData);

      prediccionesSnap.forEach((predDoc) => {
        const pred = predDoc.data();
        const puntos = calcularPuntos(
          match.goles1,
          match.goles2,
          pred.goles1Pred,
          pred.goles2Pred,
        );
        const penalesPuntos = calcularPuntosPenales(
          match.penales1, match.penales2,
          pred.penales1Pred, pred.penales2Pred,
        );
        const total = puntos + penalesPuntos;

        batch.update(prediccionesRef.doc(predDoc.id), {
          puntosGanados: puntos,
          penalesPuntos,
          procesado: true,
        });

        batch.update(usuariosRef.doc(pred.usuarioId), {
          puntosTotales: FieldValue.increment(total),
        });

        processedCount++;
      });

      await batch.commit();

      // Avanzar ganadores a la siguiente fase
      const avance = AVANCE_ELIMINATORIA[match.id];
      if (avance) {
        const partidoActual = { ...partidoData, id: match.id, goles1Real: match.goles1, goles2Real: match.goles2, golesPenales1: match.penales1, golesPenales2: match.penales2 } as PartidoDoc;
        for (const dest of avance) {
          const equipo = dest.tipo === 'ganador' ? getGanador(partidoActual) : getPerdedor(partidoActual);
          if (!equipo) continue;
          const destRef = partidosRef.doc(dest.partidoId);
          const destSnap = await destRef.get();
          if (!destSnap.exists) continue;
          const destData = destSnap.data()!;
          if (destData[dest.posicion] && destData[dest.posicion] !== '') continue;
          await destRef.update({ [dest.posicion]: equipo });
          processedCount++;
        }
      }
    }

    return NextResponse.json({
      message: 'Fixture actualizado correctamente',
      processed: processedCount,
      finished: finishedMatches.length,
    });
  } catch (error) {
    console.error('Error en cron update-fixtures:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 },
    );
  }
}
