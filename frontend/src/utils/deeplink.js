import { Linking, Platform } from 'react-native';
import { navigate } from '../navigation/navigationRef';

const APP_SCHEME = 'socialbeats';
const WEB_DOMAIN = 'socialbeats.app';

const ROUTE_MAP = [
  { pattern: /^\/@([^\/]+)$/, handler: (m) => navigate('UserProfile', { username: m[1] }) },
  { pattern: /^\/post\/([^\/]+)$/, handler: (m) => navigate('PostDetail', { postId: m[1] }) },
  { pattern: /^\/playlist\/([^\/]+)$/, handler: (m) => navigate('PlaylistDetail', { playlistId: m[1] }) },
  { pattern: /^\/track\/([^\/]+)$/, handler: (m) => navigate('FullPlayer', { trackId: m[1] }) },
  { pattern: /^\/story\/([^\/]+)$/, handler: (m) => navigate('StoryViewer', { storyId: m[1] }) },
  { pattern: /^\/chat\/([^\/]+)$/, handler: (m) => navigate('Chat', { conversationId: m[1] }) },
  { pattern: /^\/profile$/, handler: () => navigate('Profile') },
  { pattern: /^\/settings$/, handler: () => navigate('Settings') },
  { pattern: /^\/search$/, handler: () => navigate('Search') },
  { pattern: /^\/notifications$/, handler: () => navigate('Notifications') },
];

function extractPath(url) {
  if (!url) return null;
  try {
    if (url.startsWith(`${APP_SCHEME}://`)) {
      return '/' + url.replace(`${APP_SCHEME}://`, '');
    }
    const parsed = new URL(url);
    if (parsed.hostname === WEB_DOMAIN || parsed.hostname === `www.${WEB_DOMAIN}`) {
      return parsed.pathname;
    }
  } catch {}
  return null;
}

function handleDeepLink(url) {
  const path = extractPath(url);
  if (!path) return false;

  for (const route of ROUTE_MAP) {
    const match = path.match(route.pattern);
    if (match) {
      route.handler(match);
      return true;
    }
  }
  return false;
}

export function setupDeepLinking() {
  Linking.getInitialURL().then(url => {
    if (url) setTimeout(() => handleDeepLink(url), 500);
  }).catch(() => {});

  const sub = Linking.addEventListener('url', ({ url }) => {
    handleDeepLink(url);
  });

  return () => sub?.remove?.();
}

export const linking = {
  prefixes: [`${APP_SCHEME}://`, `https://${WEB_DOMAIN}`, `https://www.${WEB_DOMAIN}`],
  config: {
    screens: {
      Main: {
        screens: {
          FeedTab: 'feed',
          SearchTab: 'search',
          ProfileTab: 'profile',
        },
      },
      UserProfile: '/@:username',
      PostDetail: 'post/:postId',
      PlaylistDetail: 'playlist/:playlistId',
      FullPlayer: 'track/:trackId',
      StoryViewer: 'story/:storyId',
      Chat: 'chat/:conversationId',
      Settings: 'settings',
      Notifications: 'notifications',
    },
  },
};

export function buildAppLink(type, id) {
  return `https://${WEB_DOMAIN}/${type === 'profile' ? '@' : type + '/'}${id}`;
}

export function buildDeepLinkUrl(type, id) {
  return `${APP_SCHEME}://${type}/${id}`;
}
