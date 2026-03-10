/**
 * Firebase Auth service - exchanges Firebase idToken for backend JWT
 * Call after signInWithPopup / signInWithEmailAndPassword / createUserWithEmailAndPassword
 */
const API_BASE = process.env.EXPO_PUBLIC_API_URL || process.env.VITE_API_URL || 'http://localhost:8000/api';

export async function exchangeFirebaseForBackendJWT(idToken, uid, email, username, displayName, isNewUser) {
  const path = isNewUser ? '/auth/firebase-register' : '/auth/firebase-login';
  const body = isNewUser
    ? { firebase_id_token: idToken, firebase_uid: uid, email, username, display_name: displayName || username }
    : { firebase_id_token: idToken, firebase_uid: uid };
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || 'Auth failed');
  }
  const data = await res.json();
  const jwt = data.access_token || data.token;
  if (!jwt) throw new Error('No token in response');
  const userData = {
    id: data.id,
    email: data.email,
    username: data.username,
    display_name: data.display_name || data.username,
    avatar_url: data.avatar_url,
    firebase_uid: data.firebase_uid,
  };
  return { token: jwt, user: userData };
}
