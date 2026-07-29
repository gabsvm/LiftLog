import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { IronLogCloudSnapshot } from '@/services/ironlog-routine-importer';

const apiKey: unknown = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const authDomain: unknown = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId: unknown = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket: unknown = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId: unknown = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId: unknown = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;

const config: FirebaseOptions = {
  apiKey: typeof apiKey === 'string' ? apiKey : undefined,
  authDomain: typeof authDomain === 'string' ? authDomain : undefined,
  projectId: typeof projectId === 'string' ? projectId : undefined,
  storageBucket: typeof storageBucket === 'string' ? storageBucket : undefined,
  messagingSenderId: typeof messagingSenderId === 'string' ? messagingSenderId : undefined,
  appId: typeof appId === 'string' ? appId : undefined,
};

function isIronLogCloudSnapshot(value: unknown): value is IronLogCloudSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return candidate.program === undefined || Array.isArray(candidate.program);
}

function getFirebaseImportApp() {
  if (!config.apiKey || !config.projectId || !config.appId) {
    throw new Error('La importacion Firebase no esta configurada en este build.');
  }
  return getApps().some((app) => app.name === 'ironlog-import')
    ? getApp('ironlog-import')
    : initializeApp(config, 'ironlog-import');
}

/** One-way, ephemeral login used only to read the existing IronLog snapshot. */
export async function downloadIronLogCloudSnapshot(email: string, password: string): Promise<IronLogCloudSnapshot> {
  const app = getFirebaseImportApp();
  const auth = getAuth(app);
  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const snapshot = await getDoc(doc(getFirestore(app), 'users', credential.user.uid));
    if (!snapshot.exists()) throw new Error('No hay datos de IronLog para esta cuenta.');
    const data: unknown = snapshot.data();
    if (!isIronLogCloudSnapshot(data)) throw new Error('La copia cloud de IronLog tiene un formato invalido.');
    return data;
  } finally {
    await signOut(auth).catch(() => undefined);
  }
}
