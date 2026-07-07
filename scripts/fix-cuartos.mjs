import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!saKey) { console.error('FIREBASE_SERVICE_ACCOUNT_KEY no definida'); process.exit(1); }

const serviceAccount = JSON.parse(Buffer.from(saKey, 'base64').toString());
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Actualizar 4to cuartos: Argentina vs Switzerland
const ref = db.collection('partidos').doc('537386');
await ref.set({
  equipo1: 'Argentina',
  equipo2: 'Switzerland',
  fase: 'Cuartos de Final',
  fechaLimite: '2026-07-11T17:00:00Z',
  estado: 'NS',
  goles1Real: null,
  goles2Real: null,
  golesPenales1: null,
  golesPenales2: null,
}, { merge: true });

console.log('✅ Cuarto de Final 4 actualizado: Argentina vs Switzerland');

// Verificar
const snap = await db.collection('partidos').doc('537386').get();
if (snap.exists) {
  const d = snap.data();
  console.log(`  ${d.equipo1} vs ${d.equipo2} (fase: ${d.fase}, estado: ${d.estado})`);
}
