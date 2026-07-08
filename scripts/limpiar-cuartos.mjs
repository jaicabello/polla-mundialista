import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!saKey) { console.error('FIREBASE_SERVICE_ACCOUNT_KEY no definida'); process.exit(1); }

const serviceAccount = JSON.parse(Buffer.from(saKey, 'base64').toString());
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const idsCuartos = ['537383', '537384', '537385', '537386'];

for (const pid of idsCuartos) {
  const partidoSnap = await db.collection('partidos').doc(pid).get();
  const partido = partidoSnap.data();
  if (!partido) { console.log(`${pid}: no existe`); continue; }
  if (partido.estado !== 'FT') { console.log(`${pid}: ya está NS, saltando`); continue; }

  console.log(`\n${partido.equipo1} vs ${partido.equipo2} (${partido.goles1Real}:${partido.goles2Real})`);

  // Buscar predicciones procesadas
  const predSnap = await db.collection('predicciones')
    .where('partidoId', '==', pid)
    .where('procesado', '==', true)
    .get();

  console.log(`  Predicciones procesadas: ${predSnap.size}`);

  const batch = db.batch();

  predSnap.forEach(d => {
    const p = d.data();
    const totalARevertir = (p.puntosGanados || 0) + (p.penalesPuntos || 0);
    console.log(`    ${d.id}: puntos=${p.puntosGanados} penales=${p.penalesPuntos} → revertir ${totalARevertir}`);

    batch.update(d.ref, {
      procesado: false,
      puntosGanados: 0,
      penalesPuntos: 0,
    });

    if (totalARevertir > 0) {
      batch.update(db.collection('usuarios').doc(p.usuarioId), {
        puntosTotales: FieldValue.increment(-totalARevertir),
      });
    }
  });

  // Limpiar resultados del partido
  batch.update(db.collection('partidos').doc(pid), {
    goles1Real: null,
    goles2Real: null,
    golesPenales1: null,
    golesPenales2: null,
    estado: 'NS',
  });

  await batch.commit();
  console.log(`  ✅ Partido reseteado y predicciones desprocesadas`);
}

console.log('\n✅ Todos los cuartos reseteados');
