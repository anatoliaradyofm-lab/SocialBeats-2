// Firebase — full mock for web preview
export const initializeApp   = () => ({});
export const getApp          = () => ({});
export const getApps         = () => [];

// Auth
export const getAuth            = () => mockAuth;
export const signInWithPopup    = () => Promise.resolve({ user: mockUser, _tokenResponse: {} });
export const signInWithRedirect = () => Promise.resolve();
export const signInWithEmailAndPassword = () => Promise.resolve({ user: mockUser });
export const createUserWithEmailAndPassword = () => Promise.resolve({ user: mockUser });
export const signOut         = () => Promise.resolve();
export const onAuthStateChanged = (auth, cb) => { setTimeout(() => cb(null), 0); return () => {}; };
export const sendPasswordResetEmail = () => Promise.resolve();
export class GoogleAuthProvider {
  static credential() { return {}; }
  static credentialFromResult() { return null; } // falls through to result.user path
}
export class OAuthProvider { constructor() {} addScope() { return this; } static credential() { return {}; } }
export class FacebookAuthProvider { static credential() { return {}; } }
export class TwitterAuthProvider { static credential() { return {}; } }
export const signInWithCredential = () => Promise.resolve({ user: mockUser });

// Firestore
export const getFirestore    = () => ({});
export const collection      = () => ({});
export const doc             = () => ({});
export const getDoc          = () => Promise.resolve({ exists: () => false, data: () => ({}) });
export const getDocs         = () => Promise.resolve({ docs: [] });
export const setDoc          = () => Promise.resolve();
export const updateDoc       = () => Promise.resolve();
export const deleteDoc       = () => Promise.resolve();
export const addDoc          = () => Promise.resolve({ id: 'mock-id' });
export const query           = (ref) => ref;
export const where           = () => ({});
export const orderBy         = () => ({});
export const limit           = () => ({});
export const onSnapshot      = () => () => {};
export const serverTimestamp = () => new Date();
export const Timestamp       = { now: () => ({ toDate: () => new Date() }) };

// Storage
export const getStorage      = () => ({});
export const ref             = () => ({});
export const uploadBytesResumable = () => ({ on: () => {}, snapshot: {} });
export const getDownloadURL  = () => Promise.resolve('');

// Messaging
export const getMessaging    = () => ({});
export const getToken        = () => Promise.resolve('');
export const onMessage       = () => () => {};

const mockUser = {
  uid: 'preview-user',
  email: 'preview@socialbeats.app',
  displayName: 'SocialBeats User',
  photoURL: 'https://i.pravatar.cc/200?u=preview1',
  getIdToken: () => Promise.resolve('mock-google-id-token'),
};
const mockAuth = { currentUser: null, onAuthStateChanged: (cb) => { setTimeout(() => cb(null), 0); return () => {}; } };

// Named exports used by mobile/src/lib/firebase.js
export const auth           = mockAuth;
export const googleProvider = {};
export const db             = {};
export const storage        = {};
export const messaging      = null;
export const app            = {};
