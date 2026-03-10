/**
 * React Query client configuration
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 min
      gcTime: 5 * 60 * 1000, // 5 min (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
