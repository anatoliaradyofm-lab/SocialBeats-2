/**
 * React Query hooks for stories API
 */
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export function useStoriesQuery(token) {
  return useQuery({
    queryKey: ['stories', !!token],
    queryFn: () => api.get('/stories/feed', token),
    enabled: !!token,
    select: (res) => res?.stories || res || [],
  });
}
