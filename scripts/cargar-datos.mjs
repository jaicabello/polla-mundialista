// Script para cargar partidos de la fase eliminatoria a Firestore
// Uso: node scripts/cargar-datos.mjs

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_KEY = process.env.FOOTBALL_DATA_API_KEY || 'b6b52222233447f9be2bf44f854e74fb';

const MAPA_FASES = {
  'LAST_32': 'Treintaidosavos',
  'LAST_16': 'Octavos de Final',
  'QUARTER_FINALS': 'Cuartos de Final',
  'SEMI_FINALS': 'Semifinal',
  'THIRD_PLACE': 'Tercer Puesto',
  'FINAL': 'Final',
};

function obtenerGoles(match) {
  // Para penales: usar resultado de 90 min (regularTime)
  // Para extra time sin penales: usar fullTime (incluye extra time)
  // Para partidos normales: usar fullTime
  const penalties = match.score?.penalties;
  const regularTime = match.score?.regularTime;
  const fullTime = match.score?.fullTime;

  if (penalties && regularTime) {
    // Partido definido por penales → usar 90 min
    return { goles1: regularTime.home, goles2: regularTime.away };
  }
  // Para partidos con extra time (sin penales) o normales
  if (fullTime && fullTime.home !== null && fullTime.away !== null) {
    return { goles1: fullTime.home, goles2: fullTime.away };
  }
  return { goles1: null, goles2: null };
}

(async () => {
  try {
    console.log('Obteniendo partidos desde Football-Data.org...');
    const res = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches',
      { headers: { 'X-Auth-Token': API_KEY } }
    );
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    const matches = data.matches;
    console.log(`Total: ${matches.length} partidos\n`);

    const knockoutStages = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];
    const knockout = matches.filter(m => knockoutStages.includes(m.stage));

    const partidos = knockout.map(m => {
      const { goles1, goles2 } = obtenerGoles(m);
      return {
        id: String(m.id),
        fase: MAPA_FASES[m.stage] || m.stage,
        equipo1: m.homeTeam?.name || '',
        equipo2: m.awayTeam?.name || '',
        goles1Real: goles1,
        goles2Real: goles2,
        fechaLimite: m.utcDate,
        estado: goles1 !== null ? 'FT' : 'NS',
      };
    });

    // ============================================
    // 1. Mostrar datos para copiar manualmente
    // ============================================
    console.log('========= PARTIDOS (copiar a Firestore) =========\n');
    for (const p of partidos) {
      console.log(`ID: ${p.id}`);
      console.log(JSON.stringify({
        fase: p.fase,
        equipo1: p.equipo1,
        equipo2: p.equipo2,
        goles1Real: p.goles1Real,
        goles2Real: p.goles2Real,
        fechaLimite: p.fechaLimite,
        estado: p.estado,
      }, null, 2));
      console.log('');
    }

    console.log('========= USUARIOS =========\n');
    console.log('ID: jaime');
    console.log(JSON.stringify({ nombre: 'Jaime', puntosTotales: 0 }, null, 2));
    console.log('');

    // ============================================
    // 2. Intentar cargar directo a Firestore (si hay service account)
    // ============================================
    const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (saKey) {
      try {
        const serviceAccount = JSON.parse(
          Buffer.from(saKey, 'base64').toString()
        );

        const { initializeApp, cert, getApps } = await import('firebase-admin/app');
        const { getFirestore } = await import('firebase-admin/firestore');

        if (!getApps().length) {
          initializeApp({ credential: cert(serviceAccount) });
        }
        const adminDb = getFirestore();

        // Cargar partidos
        const batch = adminDb.batch();
        for (const p of partidos) {
          const ref = adminDb.collection('partidos').doc(p.id);
          batch.set(ref, {
            fase: p.fase,
            equipo1: p.equipo1,
            equipo2: p.equipo2,
            goles1Real: p.goles1Real,
            goles2Real: p.goles2Real,
            fechaLimite: p.fechaLimite,
            estado: p.estado,
          });
        }
        await batch.commit();
        console.log(`✅ ${partidos.length} partidos cargados a Firestore`);

        // Crear usuario si no existe
        const userRef = adminDb.collection('usuarios').doc('jaime');
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
          await userRef.set({ nombre: 'Jaime', puntosTotales: 0 });
          console.log('✅ Usuario "Jaime" creado');
        } else {
          console.log('ℹ️ Usuario "Jaime" ya existe');
        }

      } catch (err) {
        console.log('⚠️ No se pudo cargar directo a Firestore:', err.message);
        console.log('   Copiá los datos manualmente desde arriba ☝️');
      }
    } else {
      console.log('ℹ️ Para carga automática, definí FIREBASE_SERVICE_ACCOUNT_KEY');
      console.log('   O copiá los datos manualmente desde arriba ☝️');
    }

    // Guardar JSON
    const outPath = join(__dirname, 'datos-firestore.json');
    writeFileSync(outPath, JSON.stringify({ partidos }, null, 2));
    console.log(`\n✅ JSON guardado en: ${outPath}`);

  } catch (err) {
    console.error('Error:', err.message);
  }
})();
