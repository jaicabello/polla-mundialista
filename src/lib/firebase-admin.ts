import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString()
    )
    return initializeApp({ credential: cert(serviceAccount) })
  }

  return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID })
}

export const adminDb = getFirestore(getAdminApp())
