import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/gmail.send'] as const;

const FIRESTORE_DATABASE_ID =
  (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId ||
  'ai-studio-78d01849-0839-46bb-960e-ac864472028e';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, FIRESTORE_DATABASE_ID);
export const auth = getAuth(app);

// Standard Google Sign-In provider (no restricted Workspace scopes) so any Google account can sign in
export const basicGoogleProvider = new GoogleAuthProvider();
basicGoogleProvider.setCustomParameters({ prompt: 'select_account' });

// Incremental Gmail provider requested only when a user explicitly chooses to send via Gmail API
export const googleProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => googleProvider.addScope(scope));
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Strict in-memory OAuth access token cache (never stored in localStorage or sessionStorage)
let cachedAccessToken: string | null = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedAccessToken = null;
  }
});

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, basicGoogleProvider);
  cachedAccessToken = null;
  return result.user;
}

export async function signInWithGoogleAndGmail(): Promise<{
  user: User;
  accessToken: string | null;
}> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  cachedAccessToken = credential?.accessToken ?? null;
  return { user: result.user, accessToken: cachedAccessToken };
}

export async function authorizeGmailAccess(): Promise<string> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Could not obtain Gmail sending permission from Google Sign-In.');
  }
  cachedAccessToken = credential.accessToken;
  return cachedAccessToken;
}

export type AuthErrorKind =
  | 'unauthorized-domain'
  | 'popup-blocked'
  | 'operation-not-allowed'
  | 'network'
  | 'cancelled'
  | 'generic';

export interface AuthErrorInfo {
  kind: AuthErrorKind;
  message: string;
  hostname?: string;
  firebaseSettingsUrl?: string;
}

export function getFirebaseAuthSettingsUrl(): string {
  return `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;
}

export function parseFirebaseAuthError(
  error: unknown,
  fallbackMessage = 'Unable to sign in with Google. Please try again.'
): AuthErrorInfo {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const rawMessage = error instanceof Error ? error.message : String(error ?? '');
  const combined = `${code} ${rawMessage}`.toLowerCase();

  if (
    combined.includes('popup-closed-by-user') ||
    combined.includes('cancelled-popup-request')
  ) {
    return {
      kind: 'cancelled',
      message: '',
    };
  }

  if (combined.includes('unauthorized-domain')) {
    const hostname =
      typeof window !== 'undefined' && window.location?.hostname
        ? window.location.hostname
        : '';
    return {
      kind: 'unauthorized-domain',
      message:
        'Google Sign-In is blocked on this host until the domain is added to Firebase Authentication Authorized Domains.',
      hostname,
      firebaseSettingsUrl: getFirebaseAuthSettingsUrl(),
    };
  }

  if (combined.includes('popup-blocked')) {
    return {
      kind: 'popup-blocked',
      message:
        'Your browser blocked the Google sign-in popup. Please allow popups for this site and try again.',
    };
  }

  if (combined.includes('operation-not-allowed')) {
    return {
      kind: 'operation-not-allowed',
      message:
        'Google Sign-In is not enabled in Firebase Authentication for this project yet.',
      firebaseSettingsUrl: getFirebaseAuthSettingsUrl(),
    };
  }

  if (combined.includes('network-request-failed')) {
    return {
      kind: 'network',
      message:
        'Network connection failed while contacting Google Sign-In. Check your connection and try again.',
    };
  }

  return {
    kind: 'generic',
    message: rawMessage || fallbackMessage,
  };
}

export async function confirmWithGoogleForSubmission(): Promise<{
  user: User;
  accessToken: string | null;
  gmailScopeGranted: boolean;
}> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken ?? null;
    cachedAccessToken = token;
    return {
      user: result.user,
      accessToken: token,
      gmailScopeGranted: Boolean(token),
    };
  } catch (err) {
    const parsed = parseFirebaseAuthError(err);
    // Short-circuit errors that a second popup cannot resolve (user close, domain mismatch, popup block, network)
    if (
      parsed.kind === 'cancelled' ||
      parsed.kind === 'unauthorized-domain' ||
      parsed.kind === 'popup-blocked' ||
      parsed.kind === 'operation-not-allowed' ||
      parsed.kind === 'network'
    ) {
      throw err;
    }
    // Fallback to standard Google Sign-In (no restricted scope) so any Google account can confirm
    const fallbackResult = await signInWithPopup(auth, basicGoogleProvider);
    cachedAccessToken = null;
    return {
      user: fallbackResult.user,
      accessToken: null,
      gmailScopeGranted: false,
    };
  }
}

export function getGmailAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearGmailAccessToken(): void {
  cachedAccessToken = null;
}

export async function signOutUser(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}

export const FIREBASE_CONFIG_META = {
  projectId: firebaseConfig.projectId,
  firestoreDatabaseId: FIRESTORE_DATABASE_ID,
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
