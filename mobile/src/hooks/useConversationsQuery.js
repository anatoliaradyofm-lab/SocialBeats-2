/**
 * React Query hooks for conversations API
 */
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export function useConversationsQuery(token) {
  return useQuery({
    queryKey: ['conversations', !!token],
    queryFn: () => api.get('/messages/conversations?limit=50', token),
    enabled: !!token,
    select: (res) => res?.conversations || [],
  });
}

export function useArchivedConversationsQuery(token) {
  return useQuery({
    queryKey: ['conversationsArchived', !!token],
    queryFn: () => api.get('/messages/conversations/archived', token),
    enabled: !!token,
    select: (res) => res?.conversations || (Array.isArray(res) ? res : []),
  });
}
