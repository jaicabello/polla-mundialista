import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!saKey) { console.error('FIREBASE_SERVICE_ACCOUNT_KEY no definida'); process.exit(1); }

const serviceAccount = JSON.parse(Buffer.from(saKey, 'base64').toString());
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

function calcularPuntos(g1, g2, p1, p2) {
  if (p1 === undefined || p2 === undefined) return 0;
  if (g1 === p1 && g2 === p2) return 6;
  if ((g1 > g2 && p1 > p2) || (g2 > g1 && p2 > p1) || (g1 === g2 && p1 === p2)) return 3;
  return 0;
}

function calcularPuntosPenales(r1, r2, p1, p2) {
  if (r1 == null || r2 == null) return 0;
  if (p1 == null || p2 == null) return 0;
  const rw = r1 > r2 ? 1 : r2 > r1 ? 2 : 0;
  const pw = p1 > p2 ? 1 : p2 > p1 ? 2 : 0;
  return (rw !== 0 && rw === pw) ? 3 : 0;
}

const matchId = '537383';
const goles1 = 2;
const goles2 = 0;

await db.collection('partidos').doc(matchId).update({
  goles1Real: goles1,
  goles2Real: goles2,
  golesPenales1: null,
  golesPenales2: null,
  estado: 'FT',
});

const predSnap = await db.collection('predicciones')
  .where('partidoId', '==', matchId)
  .where('procesado', '==', false)
  .get();

console.log(`Predicciones pendientes: ${predSnap.size}`);

const batch = db.batch();
predSnap.forEach(d => {
  const p = d.data();
  const puntos = calcularPuntos(goles1, goles2, p.goles1Pred, p.goles2Pred);
  const penalesPuntos = calcularPuntosPenales(null, null, p.penales1Pred, p.penales2Pred);
  const total = puntos + penalesPuntos;

  console.log(`  ${d.id}: pred=${p.goles1Pred}:${p.goles2Pred} → ${puntos} pts`);

  batch.update(d.ref, { puntosGanados: puntos, penalesPuntos, procesado: true });
  if (total > 0) {
    batch.update(db.collection('usuarios').doc(p.usuarioId), {
      puntosTotales: FieldValue.increment(total),
    });
  }
});

await batch.commit();
console.log('✅ Hecho');
