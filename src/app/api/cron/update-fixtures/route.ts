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
