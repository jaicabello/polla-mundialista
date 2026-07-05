import { readFileSync, existsSync } from 'fs';

const API_KEY = process.env.FOOTBALL_DATA_API_KEY || 'b6b52222233447f9be2bf44f854e74fb';
const SA_KEY = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

const MAPA_EQUIPOS = {
  'canadá': 'Canada', 'canada': 'Canada',
  'marruecos': 'Morocco',
  'paraguay': 'Paraguay',
  'francia': 'France',
  'brasil': 'Brazil',
  'noruega': 'Norway',
  'méxico': 'Mexico', 'mexico': 'Mexico',
  'inglaterra': 'England',
  'portugal': 'Portugal',
  'españa': 'Spain', 'espana': 'Spain',
  'estados unidos': 'United States',
  'ee. uu.': 'United States',
  'bélgica': 'Belgium', 'belgica': 'Belgium',
  'argentina': 'Argentina',
  'egipto': 'Egypt',
  'suiza': 'Switzerland',
  'colombia': 'Colombia',
  'alemania': 'Germany',
  'italia': 'Italy',
  'países bajos': 'Netherlands',
  'paises bajos': 'Netherlands',
  'inglaterra': 'England',
};

function normalizar(nombre) {
  const key = nombre.toLowerCase().trim();
  return MAPA_EQUIPOS[key] || nombre;
}

function calcularPuntos(g1r, g2r, g1p, g2p) {
  if (g1r === g1p && g2r === g2p) return 6;
  const dr = g1r - g2r;
  const dp = g1p - g2p;
  if ((dr > 0 && dp > 0) || (dr < 0 && dp < 0) || (dr === 0 && dp === 0)) return 3;
  return 0;
}

(async () => {
  try {
    // Read predictions JSON from stdin or argument
    const inputPath = process.argv[2];
    let raw;

    if (inputPath && existsSync(inputPath)) {
      raw = readFileSync(inputPath, 'utf-8');
    } else if (!process.stdin.isTTY) {
      // Read from pipe
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      raw = Buffer.concat(chunks).toString();
    } else {
      console.error('Uso: node scripts/cargar-predicciones.mjs <archivo.json>');
      console.error('   o: cat predicciones.json | node scripts/cargar-predicciones.mjs');
      process.exit(1);
    }

    const data = JSON.parse(raw);
    const usuarioNombre = data.usuario;
    const predicciones = data.predicciones;

    if (!usuarioNombre || !predicciones?.length) {
      console.error('Formato inválido. Debe tener "usuario" y "predicciones".');
      process.exit(1);
    }

    console.log(`Usuario: ${usuarioNombre}`);
    console.log(`Predicciones: ${predicciones.length}\n`);

    // Fetch matches
    console.log('Buscando partidos...');
    const res = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches',
      { headers: { 'X-Auth-Token': API_KEY } }
    );
    const apiData = await res.json();
    const knockoutStages = ['LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];
    const matches = apiData.matches.filter(m => knockoutStages.includes(m.stage));
    console.log(`Encontrados ${matches.length} partidos de fase eliminatoria\n`);

    // Match predictions to API data
    const predictionsWithIds = [];
    for (const pred of predicciones) {
      const e1 = normalizar(pred.equipo1);
      const e2 = normalizar(pred.equipo2);
      const match = matches.find(m => {
        const h = m.homeTeam?.name || '';
        const a = m.awayTeam?.name || '';
        return (h === e1 && a === e2) || (h === e2 && a === e1);
      });
      if (!match) {
        console.warn(`⚠ No se encontró: ${pred.equipo1} vs ${pred.equipo2}`);
        continue;
      }
      const tienePenales = pred.detalles?.ganadorPenales != null;
      predictionsWithIds.push({
        partidoId: String(match.id),
        equipo1API: match.homeTeam.name,
        equipo2API: match.awayTeam.name,
        goles1Pred: pred.goles1Pred,
        goles2Pred: pred.goles2Pred,
        penales: tienePenales ? {
          ganador: pred.detalles.ganadorPenales,
          penales1Pred: pred.detalles.penales1Pred,
          penales2Pred: pred.detalles.penales2Pred,
        } : null,
      });
      const penalesStr = tienePenales ? ` (penales: ${pred.detalles.penales1Pred}-${pred.detalles.penales2Pred})` : '';
      console.log(`✓ ${match.homeTeam.name} vs ${match.awayTeam.name} → ${pred.goles1Pred}-${pred.goles2Pred}${penalesStr}`);
    }

    if (!SA_KEY) {
      console.log('\n⚠ FIREBASE_SERVICE_ACCOUNT_KEY no disponible');
      return;
    }

    // Load to Firestore
    const serviceAccount = JSON.parse(Buffer.from(SA_KEY, 'base64').toString());
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

    if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
    const adminDb = getFirestore();

    const usuarioId = usuarioNombre.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Create user if not exists
    const userRef = adminDb.collection('usuarios').doc(usuarioId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      await userRef.set({ nombre: usuarioNombre, puntosTotales: 0 });
      console.log(`\n✅ Usuario "${usuarioNombre}" (ID: ${usuarioId}) creado`);
    } else {
      console.log(`\nℹ️ Usuario "${usuarioNombre}" ya existe`);
    }

    let creadas = 0;
    let calculadas = 0;
    let totalPts = 0;

    for (const p of predictionsWithIds) {
      const docId = `${usuarioId}_${p.partidoId}`;
      const ref = adminDb.collection('predicciones').doc(docId);

      const snap = await ref.get();
      if (snap.exists) {
        console.log(`ℹ️ Ya existe predicción para partido ${p.partidoId}`);
        continue;
      }

      const partidoRef = adminDb.collection('partidos').doc(p.partidoId);
      const partidoSnap = await partidoRef.get();
      const partido = partidoSnap.data();

      let puntosGanados = 0;
      let procesado = false;

      if (partido && partido.goles1Real !== null && partido.goles2Real !== null) {
        puntosGanados = calcularPuntos(
          partido.goles1Real, partido.goles2Real,
          p.goles1Pred, p.goles2Pred
        );
        procesado = true;
        totalPts += puntosGanados;
        calculadas++;
      }

      const docData = {
        usuarioId,
        partidoId: p.partidoId,
        goles1Pred: p.goles1Pred,
        goles2Pred: p.goles2Pred,
        puntosGanados,
        procesado,
      };

      if (p.penales) {
        docData.penalesGanador = p.penales.ganador;
        docData.penales1Pred = p.penales.penales1Pred;
        docData.penales2Pred = p.penales.penales2Pred;
      }

      await ref.set(docData);

      if (procesado && puntosGanados > 0) {
        await userRef.update({ puntosTotales: FieldValue.increment(puntosGanados) });
      }

      creadas++;
    }

    console.log(`\n✅ ${creadas} predicciones guardadas`);
    if (calculadas > 0) console.log(`   ${calculadas} ya finalizadas → ${totalPts} puntos asignados`);

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
