import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!saKey) { console.error('FIREBASE_SERVICE_ACCOUNT_KEY no definida'); process.exit(1); }

const serviceAccount = JSON.parse(Buffer.from(saKey, 'base64').toString());
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const adminDb = getFirestore();

const ids = ['537415', '537418', '537428', '537382'];
for (const id of ids) {
  const snap = await adminDb.collection('partidos').doc(id).get();
  if (snap.exists) {
    const d = snap.data();
    console.log(`${d.equipo1} vs ${d.equipo2} → ${d.goles1Real}:${d.goles2Real}  PEN: ${d.golesPenales1}:${d.golesPenales2}`);
  }
}
