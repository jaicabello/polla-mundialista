import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!saKey) { console.error('FIREBASE_SERVICE_ACCOUNT_KEY no definida'); process.exit(1); }

const serviceAccount = JSON.parse(Buffer.from(saKey, 'base64').toString());
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Fix Switzerland vs Colombia — la API devuelve fullTime 4-3 y penalties 3-3.
// El ganador de penales es Suiza (4-3). Actualizamos.
const ref = db.collection('partidos').doc('537382');
await ref.set({
  golesPenales1: 4,
  golesPenales2: 3,
}, { merge: true });

console.log('✅ Switzerland vs Colombia: penales corregidos a 4-3 (gana Suiza)');

// Verificar
const snap = await db.collection('partidos').doc('537382').get();
const d = snap.data();
console.log(`  ${d.equipo1} vs ${d.equipo2} → ${d.goles1Real}:${d.goles2Real} PEN: ${d.golesPenales1}:${d.golesPenales2}`);
