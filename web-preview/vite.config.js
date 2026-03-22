import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const SC_BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://soundcloud.com',
  'Referer': 'https://soundcloud.com/',
};

// Fetch a URL with browser-like headers, returns a Promise<{statusCode, headers, body:Buffer}>
function httpsGet(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { ...SC_BROWSER_HEADERS, ...extraHeaders } }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

// In-process cache: { clientId, expiresAt }
let _cidCache = null;

// Scrape a fresh SoundCloud client_id from their JS assets (same approach as backend SoundCloudScraper)
async function scrapeFreshClientId() {
  if (_cidCache && Date.now() < _cidCache.expiresAt) return _cidCache.clientId;
  try {
    // 1. Fetch soundcloud.com homepage to find JS bundle URLs
    const homeRes = await httpsGet('https://soundcloud.com', { Accept: 'text/html,application/xhtml+xml,*/*' });
    const html = homeRes.body.toString();
    // Find all JS asset URLs from sndcdn
    const scriptMatches = [...html.matchAll(/https:\/\/a-v2\.sndcdn\.com\/assets\/[^"']+\.js/g)];
    const jsUrls = [...new Set(scriptMatches.map(m => m[0]))];
    // Try last few JS bundles (they're more likely to contain the client_id)
    for (const jsUrl of jsUrls.slice(-5).reverse()) {
      const jsRes = await httpsGet(jsUrl);
      const js = jsRes.body.toString();
      const m = js.match(/client_id:"([a-zA-Z0-9]{32})"/);
      if (m) {
        _cidCache = { clientId: m[1], expiresAt: Date.now() + 12 * 3600 * 1000 }; // 12h cache
        console.log('[sc-cid] scraped fresh client_id:', m[1].slice(0, 8) + '...');
        return m[1];
      }
    }
  } catch (e) {
    console.error('[sc-cid] scrape failed:', e.message);
  }
  return null;
}

function soundcloudMiddleware() {
  return {
    name: 'soundcloud-proxy',
    configureServer(server) {
      // /sc-cid → scrape & return fresh client_id JSON
      server.middlewares.use('/sc-cid', async (req, res) => {
        try {
          const clientId = await scrapeFreshClientId();
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');
          if (clientId) {
            res.statusCode = 200;
            res.end(JSON.stringify({ client_id: clientId }));
          } else {
            res.statusCode = 503;
            res.end(JSON.stringify({ error: 'Could not scrape client_id' }));
          }
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
        }
      });

      // /sc-api/* → proxy to https://api-v2.soundcloud.com/* with browser headers
      server.middlewares.use('/sc-api', (req, res) => {
        const target = 'https://api-v2.soundcloud.com' + req.url;
        https.get(target, { headers: SC_BROWSER_HEADERS }, (scRes) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', scRes.headers['content-type'] || 'application/json');
          res.statusCode = scRes.statusCode;
          scRes.pipe(res);
        }).on('error', (e) => {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: e.message }));
        });
      });
    },
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileSrc = path.resolve(__dirname, '../mobile/src');
const mocksDir  = path.resolve(__dirname, 'src/mocks');

// Mobile source files that need web mocks
const SOURCE_MOCKS = {
  [path.join(mobileSrc, 'contexts', 'AuthContext')]:           path.join(mocksDir, 'auth-context.jsx'),
  [path.join(mobileSrc, 'contexts', 'PlayerContext')]:         path.join(mocksDir, 'player-context.jsx'),
  [path.join(mobileSrc, 'contexts', 'NotificationContext')]:   path.join(mocksDir, 'notification-context.jsx'),
  [path.join(mobileSrc, 'contexts', 'AlertContext')]:          path.join(mocksDir, 'alert-context.jsx'),
  [path.join(mobileSrc, 'contexts', 'ScreenTimeContext')]:     path.join(mocksDir, 'noop-context.jsx'),
  [path.join(mobileSrc, 'contexts', 'InterstitialAdContext')]: path.join(mocksDir, 'noop-context.jsx'),
  [path.join(mobileSrc, 'contexts', 'AppColorsContext')]:      path.join(mocksDir, 'noop-context.jsx'),
  [path.join(mobileSrc, 'services', 'api')]:                   path.join(mocksDir, 'api.js'),
  [path.join(mobileSrc, 'services', 'biometricService')]:      path.join(mocksDir, 'biometric.js'),
  [path.join(mobileSrc, 'services', 'socketService')]:         path.join(mocksDir, 'socket.js'),
  [path.join(mobileSrc, 'services', 'trackPlayerService')]:    path.join(mocksDir, 'track-player.js'),
  [path.join(mobileSrc, 'services', 'audioService')]:          path.join(mocksDir, 'audio-service.js'),
  [path.join(mobileSrc, 'services', 'historyService')]:        path.join(mocksDir, 'history-service.js'),
  [path.join(mobileSrc, 'services', 'offlineService')]:        path.join(mocksDir, 'offline-service.js'),
  [path.join(mobileSrc, 'navigation', 'navigationRef')]:       path.join(mocksDir, 'nav-ref.js'),
  [path.join(mobileSrc, 'lib', 'firebase')]:                   path.join(mocksDir, 'firebase.js'),
  [path.join(mobileSrc, 'lib', 'trackPlayer')]:                path.join(mobileSrc, 'lib', 'trackPlayer.web.js'),
  [path.join(mobileSrc, 'lib', 'localeStore')]:                path.join(mocksDir, 'locale-store.js'),
  [path.join(mobileSrc, 'lib', 'localeUtils')]:                path.join(mocksDir, 'locale-utils.js'),
  [path.join(mobileSrc, 'lib', 'queryClient')]:                path.join(mocksDir, 'noop.js'),
};

// Normalize path: forward slashes + strip extension
const norm = (p) => p.replace(/\\/g, '/').replace(/\.(js|jsx|ts|tsx)$/, '');
// Pre-compute normalized SOURCE_MOCKS for fast lookup
const NORM_MOCKS = Object.fromEntries(
  Object.entries(SOURCE_MOCKS).map(([real, mock]) => [norm(real), mock.replace(/\\/g, '/')])
);

function mobileMocksPlugin() {
  return {
    name: 'mobile-mocks',
    enforce: 'pre',  // run before other plugins (including vite's own resolver)
    resolveId(id, importer) {
      // Handle relative imports
      if (id.startsWith('.') && importer) {
        const resolved = norm(path.resolve(path.dirname(importer), id));
        if (NORM_MOCKS[resolved]) return NORM_MOCKS[resolved];
      }
      // Handle already-resolved absolute paths (Vite sometimes passes these)
      if (path.isAbsolute(id)) {
        const n = norm(id);
        if (NORM_MOCKS[n]) return NORM_MOCKS[n];
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [react(), mobileMocksPlugin(), soundcloudMiddleware()],

  resolve: {
    alias: {
      // React Native → Web (with iOS shims)
      'react-native': path.join(mocksDir, 'react-native-shim.js'),

      // Expo packages
      '@expo/vector-icons':                         path.join(mocksDir, 'expo-icons.jsx'),
      'expo-linear-gradient':                       path.join(mocksDir, 'linear-gradient.jsx'),
      'expo-haptics':                               path.join(mocksDir, 'haptics.js'),
      'expo-local-authentication':                  path.join(mocksDir, 'local-auth.js'),
      'expo-status-bar':                            path.join(mocksDir, 'status-bar.js'),
      'expo-secure-store':                          path.join(mocksDir, 'secure-store.js'),
      'expo-notifications':                         path.join(mocksDir, 'notifications.js'),
      'expo-modules-core':                          path.join(mocksDir, 'noop.js'),
      'expo-battery':                               path.join(mocksDir, 'noop.js'),
      'expo-camera':                                path.join(mocksDir, 'noop.js'),
      'expo-image-picker':                          path.join(mocksDir, 'noop.js'),
      'expo-contacts':                              path.join(mocksDir, 'noop.js'),
      'expo-location':                              path.join(mocksDir, 'noop.js'),
      'expo-network':                               path.join(mocksDir, 'noop.js'),
      'expo-store-review':                          path.join(mocksDir, 'noop.js'),
      'expo-web-browser':                           path.join(mocksDir, 'noop.js'),
      'expo-auth-session':                          path.join(mocksDir, 'noop.js'),
      'expo-av':                                    path.join(mocksDir, 'expo-av.js'),
      'expo-file-system':                           path.join(mocksDir, 'noop.js'),
      'expo-sharing':                               path.join(mocksDir, 'noop.js'),
      'expo-document-picker':                       path.join(mocksDir, 'noop.js'),
      'expo-blur':                                  path.join(mocksDir, 'noop.js'),
      'expo-clipboard':                             path.join(mocksDir, 'noop.js'),
      'expo-media-library':                         path.join(mocksDir, 'noop.js'),
      'expo-barcode-scanner':                       path.join(mocksDir, 'noop.js'),
      'expo-face-detector':                         path.join(mocksDir, 'noop.js'),
      'expo-gl':                                    path.join(mocksDir, 'noop.js'),
      'expo-sensors':                               path.join(mocksDir, 'noop.js'),

      // React Native packages
      '@react-native-async-storage/async-storage':  path.join(mocksDir, 'async-storage.js'),
      'react-native-safe-area-context':             path.join(mocksDir, 'safe-area.jsx'),
      'react-native-reanimated':                    path.join(mocksDir, 'reanimated.js'),
      'react-native-track-player':                  path.join(mocksDir, 'track-player.js'),
      'react-native-get-random-values':             path.join(mocksDir, 'noop.js'),
      'react-native-webview':                       path.join(mocksDir, 'noop.js'),
      'react-native-qrcode-svg':                    path.join(mocksDir, 'noop.js'),
      'react-native-chart-kit':                     path.join(mocksDir, 'noop.js'),
      '@react-native-community/slider':             path.join(mocksDir, 'noop.js'),
      '@react-native-voice/voice':                  path.join(mocksDir, 'noop.js'),

      // Firebase
      'firebase/app':       path.join(mocksDir, 'firebase.js'),
      'firebase/auth':      path.join(mocksDir, 'firebase.js'),
      'firebase/firestore': path.join(mocksDir, 'firebase.js'),
      'firebase/storage':   path.join(mocksDir, 'firebase.js'),
      'firebase/messaging': path.join(mocksDir, 'firebase.js'),
      'firebase':           path.join(mocksDir, 'firebase.js'),

      // Navigation
      '@react-navigation/native':         path.join(mocksDir, 'react-navigation.js'),
      '@react-navigation/stack':          path.join(mocksDir, 'react-navigation.js'),
      '@react-navigation/bottom-tabs':    path.join(mocksDir, 'react-navigation.js'),
      '@react-navigation/native-stack':   path.join(mocksDir, 'react-navigation.js'),

      // AdMob
      'react-native-google-mobile-ads': path.join(mocksDir, 'google-mobile-ads.js'),

      // Others
      'socket.io-client': path.join(mocksDir, 'socket.js'),
      'shaka-player':     path.join(mocksDir, 'noop.js'),
    },
    extensions: ['.web.js', '.js', '.jsx', '.ts', '.tsx'],
  },

  server: {
    port: 3001,
    open: false,
    proxy: {
      '/music-api': {
        target: 'https://music-backend-45365938370.europe-west3.run.app',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/music-api/, ''),
      },
      '/sc-stream': {
        target: 'https://api.soundcloud.com',
        changeOrigin: true,
        secure: true,
        followRedirects: true,
        rewrite: path => path.replace(/^\/sc-stream/, ''),
      },
      '/sc-stream-v2': {
        target: 'https://api-v2.soundcloud.com',
        changeOrigin: true,
        secure: true,
        followRedirects: true,
        rewrite: path => path.replace(/^\/sc-stream-v2/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://soundcloud.com',
          'Referer': 'https://soundcloud.com/',
        },
      },
    },
  },

  define: {
    global: 'globalThis',
    __DEV__: 'true',
    'process.env.NODE_ENV': '"development"',
  },

  // Treat all .js files as JSX (mobile/src files use .js with JSX inside)
  esbuild: {
    loader: 'jsx',
    include: /.*\.jsx?$/,
    exclude: [],
  },

  optimizeDeps: {
    include: ['react-native-web'],
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
});
