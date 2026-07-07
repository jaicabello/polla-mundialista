import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!saKey) { console.error('FIREBASE_SERVICE_ACCOUNT_KEY no definida'); process.exit(1); }

const serviceAccount = JSON.parse(Buffer.from(saKey, 'base64').toString());
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// IDs de partidos con penales
const partidosPenales = ['537415', '537418', '537428', '537382'];

for (const pid of partidosPenales) {
  const partidoSnap = await db.collection('partidos').doc(pid).get();
  const partido = partidoSnap.data();
  console.log(`\n${partido.equipo1} vs ${partido.equipo2}`);

  const predSnap = await db.collection('predicciones')
    .where('partidoId', '==', pid)
    .get();

  console.log(`  Predicciones: ${predSnap.size}`);
  predSnap.forEach(d => {
    const p = d.data();
    console.log(`    ${d.id}: goles1=${p.goles1Pred} goles2=${p.goles2Pred} penales1=${p.penales1Pred} penales2=${p.penales2Pred} procesado=${p.procesado} puntos=${p.puntosGanados} penPuntos=${p.penalesPuntos}`);
  });
}
