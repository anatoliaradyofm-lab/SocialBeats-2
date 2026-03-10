/**
 * React Query hooks for playlists API
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export function usePlaylistsQuery(token) {
  return useQuery({
    queryKey: ['playlists', !!token],
    queryFn: () => api.get('/playlists', token),
    enabled: !!token,
    select: (res) => (Array.isArray(res) ? res : res?.playlists || res?.data || []),
  });
}

export function useCreatePlaylistMutation(token) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/playlists', data, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['playlists'] }),
  });
}
