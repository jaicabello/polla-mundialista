import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!saKey) { console.error('FIREBASE_SERVICE_ACCOUNT_KEY no definida'); process.exit(1); }

const serviceAccount = JSON.parse(Buffer.from(saKey, 'base64').toString());
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const adminDb = getFirestore();

const snap = await adminDb.collection('partidos').get();
const fases = {};
snap.docs.forEach(d => {
  const data = d.data();
  const fase = data.fase || '(sin fase)';
  if (!fases[fase]) fases[fase] = [];
  fases[fase].push({
    id: d.id,
    eq1: data.equipo1 || '(vacio)',
    eq2: data.equipo2 || '(vacio)',
    g1: data.goles1Real,
    g2: data.goles2Real,
    estado: data.estado,
    fecha: data.fechaLimite,
  });
});

for (const [fase, matches] of Object.entries(fases)) {
  console.log(`\n## ${fase} (${matches.length})`);
  for (const m of matches) {
    const fecha = new Date(m.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    console.log(`  ${m.id}: ${m.eq1} vs ${m.eq2} → ${m.g1 ?? '-'}:${m.g2 ?? '-'} [${m.estado}] (${fecha})`);
  }
}
