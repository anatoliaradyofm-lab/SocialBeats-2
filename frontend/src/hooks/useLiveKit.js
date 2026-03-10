/**
 * LiveKit / WebRTC hook - Sesli/görüntülü arama için token alır ve LiveKit Room'a bağlanır
 * Backend LiveKit yoksa fallback olarak mevcut basit arama devam eder
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export function useLiveKit(roomName, token, userId) {
  const [info, setInfo] = useState(null);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);

  const fetchToken = useCallback(async () => {
    if (!roomName || !token) return null;
    try {
      return await api.post('/calls/token', { room_name: roomName }, token);
    } catch (e) {
      setError(e?.message || 'Token alınamadı');
      return null;
    }
  }, [roomName, token]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const callInfo = await fetchToken();
      if (!mounted || !callInfo) return;
      setInfo(callInfo);
      if (callInfo.url && callInfo.token && callInfo.backend === 'livekit') {
        try {
          const { Room } = await import('livekit-client');
          const r = new Room();
          await r.connect(callInfo.url, callInfo.token);
          setRoom(r);
        } catch (e) {
          setError(e?.message || 'LiveKit bağlantı hatası');
        }
      }
    })();
    return () => {
      mounted = false;
      if (room) room.disconnect();
    };
  }, [fetchToken]);

  return { info, room, error, hasLiveKit: info?.backend === 'livekit' };
}
