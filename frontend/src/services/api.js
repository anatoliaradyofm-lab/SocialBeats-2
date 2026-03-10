import * as Localization from 'expo-localization';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://social-music-fix.preview.emergentagent.com/api';
const DEFAULT_TIMEOUT = 15000;

let _countryCode = null;
try {
  const locales = Localization.getLocales?.();
  _countryCode = locales?.[0]?.regionCode || locales?.[0]?.languageTag?.split('-')?.[1] || null;
} catch {}

const SECURITY_HEADERS = {
  'X-Requested-With': 'SocialBeats',
  'X-Client-Version': '1.0.0',
  ...(_countryCode ? { 'X-Country-Code': _countryCode } : {}),
};

function fetchWithTimeout(url, options, timeout = DEFAULT_TIMEOUT) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    ),
  ]);
}

export const api = {
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS,
      ...options.headers,
    };

    const response = await fetchWithTimeout(url, { ...options, headers });
    if (!response.ok) {
      const err = new Error(response.statusText || 'API Error');
      err.status = response.status;
      err.data = await response.json().catch(() => ({}));
      throw err;
    }
    return response.json();
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

  async uploadPostMedia(fileUris, token) {
    const url = `${API_BASE}/storage/post-media`;
    const formData = new FormData();
    for (let i = 0; i < fileUris.length; i++) {
      const uri = fileUris[i];
      const ext = (uri.split('.').pop() || '').toLowerCase();
      let type = 'image/jpeg';
      let name = `photo_${i}.jpg`;
      if (['mp4', 'mov', 'webm'].includes(ext)) { type = 'video/mp4'; name = `video_${i}.mp4`; }
      else if (['jpg', 'jpeg'].includes(ext)) { type = 'image/jpeg'; name = `photo_${i}.jpg`; }
      else if (ext === 'png') { type = 'image/png'; name = `photo_${i}.png`; }
      else { name = `file_${i}.${ext}`; }
      formData.append('files', { uri, type, name });
    }
    const headers = { ...SECURITY_HEADERS };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetchWithTimeout(url, { method: 'POST', body: formData, headers }, DEFAULT_TIMEOUT * 4);
    if (!res.ok) {
      const err = new Error(res.statusText || 'Upload failed');
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    const raw = data.urls || data.media_urls || (data.url ? [data.url] : []);
    return raw.map(u => {
      const url = typeof u === 'string' ? u : (u?.url || u);
      return url && url.startsWith('http') ? url : `${API_BASE.replace(/\/api\/?$/, '')}${url?.startsWith('/') ? '' : '/'}${url || ''}`;
    });
  },

  async uploadFile(endpoint, fileUri, token, mimeType = 'image/jpeg') {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const ext = fileUri.split('.').pop()?.toLowerCase() || '';
    let type = mimeType;
    let name = 'file';
    if (['mp4', 'mov', 'webm'].includes(ext)) { type = 'video/mp4'; name = 'video.mp4'; }
    else if (['m4a', 'mp3', 'aac', 'wav', 'ogg'].includes(ext)) { type = `audio/${ext}`; name = `audio.${ext}`; }
    else if (['jpg', 'jpeg'].includes(ext)) { type = 'image/jpeg'; name = 'photo.jpg'; }
    else if (ext === 'png') { type = 'image/png'; name = 'photo.png'; }
    else { name = `file.${ext}`; }

    const formData = new FormData();
    formData.append('file', { uri: fileUri, type, name });

    const headers = { ...SECURITY_HEADERS };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetchWithTimeout(url, { method: 'POST', body: formData, headers }, DEFAULT_TIMEOUT * 4);
    if (!res.ok) {
      const err = new Error(res.statusText || 'Upload failed');
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    const urlPath = data.url || data.file_url || data.avatar_url || '';
    return urlPath.startsWith('http') ? urlPath : `${API_BASE.replace(/\/api\/?$/, '')}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
  },
};

export const getApiUrl = () => API_BASE;
export default api;
