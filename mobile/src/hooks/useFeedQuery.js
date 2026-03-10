/**
 * React Query hooks for feed API
 * Caches feed data for offline access.
 */
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { cacheData, getCachedData, isOnline } from '../services/offlineService';

export function useFeedQuery(token) {
  const q = useInfiniteQuery({
    queryKey: ['feed', !!token],
    queryFn: async ({ pageParam = 1 }) => {
      try {
        const result = await api.get(`/social/feed?page=${pageParam}&limit=20`, token);
        if (pageParam === 1) {
          cacheData('feed:page1', result).catch(() => { });
        }
        return result;
      } catch (err) {
        if (pageParam === 1 && (!isOnline() || err.offline)) {
          const cached = await getCachedData('feed:page1');
          if (cached) return cached;
        }
        throw err;
      }
    },
    enabled: !!token,
    getNextPageParam: (lastPage, pages) => {
      const items = Array.isArray(lastPage) ? lastPage : lastPage?.posts || [];
      return items.length >= 20 ? pages.length + 1 : undefined;
    },
    initialPageParam: 1,
  });
  const data = q.data?.pages?.flatMap((p) => (Array.isArray(p) ? p : p?.posts || [])) ?? [];
  return { ...q, data, fetchNextPage: q.fetchNextPage, hasNextPage: !!q.hasNextPage, isFetchingNextPage: q.isFetchingNextPage };
}

export function useCreatePostMutation(token) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/social/posts', data, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });
}

export function useReactPostMutation(token) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId }) => api.post(`/social/posts/${postId}/react?reaction_type=heart`, {}, token),
    onMutate: async ({ postId }) => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      const previousFeed = queryClient.getQueryData(['feed']);
      queryClient.setQueryData(['feed'], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map(page => {
            const items = Array.isArray(page) ? page : page.posts || [];
            return Array.isArray(page) ?
              items.map(p => p.id === postId ? { ...p, user_reaction: p.user_reaction === 'heart' ? null : 'heart', likes_count: p.user_reaction === 'heart' ? Math.max(0, (p.likes_count || 0) - 1) : (p.likes_count || 0) + 1 } : p)
              : { ...page, posts: items.map(p => p.id === postId ? { ...p, user_reaction: p.user_reaction === 'heart' ? null : 'heart', likes_count: p.user_reaction === 'heart' ? Math.max(0, (p.likes_count || 0) - 1) : (p.likes_count || 0) + 1 } : p) }
          })
        };
      });
      return { previousFeed };
    },
    onError: (err, variables, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(['feed'], context.previousFeed);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });
}

export function useSavePostMutation(token) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId }) => api.post(`/social/posts/${postId}/save`, {}, token),
    onMutate: async ({ postId }) => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      const previousFeed = queryClient.getQueryData(['feed']);
      queryClient.setQueryData(['feed'], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map(page => {
            const items = Array.isArray(page) ? page : page.posts || [];
            return Array.isArray(page) ?
              items.map(p => p.id === postId ? { ...p, is_saved: !p.is_saved } : p)
              : { ...page, posts: items.map(p => p.id === postId ? { ...p, is_saved: !p.is_saved } : p) }
          })
        };
      });
      return { previousFeed };
    },
    onError: (err, variables, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(['feed'], context.previousFeed);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });
}

export function useSharePostMutation(token) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId }) => api.post(`/social/posts/${postId}/share`, {}, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });
}
