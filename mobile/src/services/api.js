/**
 * API Service - Centralized API client for SocialBeats mobile
 * Adds Accept-Language and X-Country-Code from locale store.
 * Falls back to cached data when offline.
 */
import { getLocale } from '../lib/localeStore';
import { isOnline, cacheData, getCachedData, setApiRef, getOfflineQueue } from './offlineService';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://social-music-fix.preview.emergentagent.com/api';
const DEFAULT_TIMEOUT = 15000;

const SECURITY_HEADERS = {
  'X-Requested-With': 'SocialBeats',
  'X-Client-Version': '1.0.0',
};

export const getApiUrl = () => API_BASE;

function getLocaleHeaders() {
  try {
    const { language, countryCode } = getLocale();
    return {
      'Accept-Language': language || 'en',
      'X-Country-Code': countryCode || 'US',
    };
  } catch {
    return {};
  }
}

const validateResponse = (response) => {
  const contentType = response.headers?.get?.('content-type') || '';
  if (!contentType.includes('application/json') && !contentType.includes('text/')) {
    console.warn('Unexpected content type:', contentType);
  }
  return response;
};

function fetchWithTimeout(url, options, timeout = DEFAULT_TIMEOUT) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    ),
  ]);
}

let authToken = null;

export const api = {
  setToken(token) {
    authToken = token;
  },

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const cacheKey = `api:${endpoint}`;
    const isGet = !options.method || options.method === 'GET';

    if (!isOnline() && isGet) {
      const cached = await getCachedData(cacheKey);
      if (cached) return cached;
      const err = new Error('Offline - no cached data');
      err.status = 0;
      err.offline = true;
      throw err;
    }

    const localeHeaders = getLocaleHeaders();
    const headers = {
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS,
      ...localeHeaders,
      ...options.headers,
    };

    // Auto-add token if not present in options
    const finalToken = options.token || authToken;
    if (finalToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${finalToken}`;
    }

    try {
      const response = validateResponse(
        await fetchWithTimeout(url, { ...options, headers })
      );
      if (!response.ok) {
        const err = new Error(response.statusText || 'API Error');
        err.status = response.status;
        err.data = await response.json().catch(() => ({}));
        throw err;
      }
      const data = await response.json();
      if (isGet) {
        cacheData(cacheKey, data).catch(() => { });
      }
      return data;
    } catch (err) {
      if (err.offline) throw err;
      const isNetworkError = err.message === 'Network request failed' || err.name === 'TypeError' || !isOnline();
      if (!isGet && isNetworkError) {
        const method = (options.method || 'GET').toUpperCase();
        if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
          try {
            const token = options.headers?.Authorization?.replace(/^Bearer\s+/i, '') || null;
            const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined;
            await getOfflineQueue().enqueue({ method, url: endpoint, body, token });
          } catch (e) {
            // Skip enqueue if body parsing fails (e.g. non-JSON payload)
          }
        }
      }
      if (isGet && (err.message === 'Network request failed' || !isOnline())) {
        const cached = await getCachedData(cacheKey);
        if (cached) return cached;
      }
      throw err;
    }
  },

  get(endpoint, token) {
    return this.request(endpoint, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },

  post(endpoint, data, token) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },

  put(endpoint, data, token) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },

  delete(endpoint, token) {
    return this.request(endpoint, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },

  async uploadFile(fileUri, token, uploadType = 'post', mimeType = 'image/jpeg', extraForm = {}) {
    const isVideo = mimeType?.startsWith('video/') || fileUri?.includes('.mp4') || fileUri?.includes('.mov');
    const isAudio = mimeType?.startsWith('audio/') || fileUri?.includes('.m4a') || fileUri?.includes('.mp3');
    let url, type, name;
    if (isAudio) {
      url = `${API_BASE}/upload/audio`;
      type = mimeType || 'audio/m4a';
      name = 'voice.m4a';
    } else if (isVideo) {
      url = `${API_BASE}/upload/video`;
      type = 'video/mp4';
      name = 'video.mp4';
    } else {
      url = `${API_BASE}/upload/image`;
      type = mimeType || 'image/jpeg';
      name = 'photo.jpg';
    }
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type,
      name,
    });
    formData.append('upload_type', uploadType);
    Object.entries(extraForm).forEach(([k, v]) => {
      if (v !== undefined) formData.append(k, String(v));
    });
    const localeHeaders = getLocaleHeaders();
    const headers = { ...SECURITY_HEADERS, ...localeHeaders };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    delete headers['Content-Type'];
    const res = validateResponse(
      await fetchWithTimeout(url, {
        method: 'POST',
        body: formData,
        headers,
      }, DEFAULT_TIMEOUT * 4)
    );
    if (!res.ok) {
      const err = new Error(res.statusText || 'Upload failed');
      err.status = res.status;
      err.data = await res.json().catch(() => ({}));
      throw err;
    }
    const data = await res.json();
    const urlPath = data.url || data.file_url || '';
    return urlPath.startsWith('http') ? urlPath : `${API_BASE.replace(/\/api\/?$/, '')}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
  },
};

setApiRef(api);

export default api;
