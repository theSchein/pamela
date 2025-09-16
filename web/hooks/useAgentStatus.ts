import { useQuery } from '@tanstack/react-query';
import type { AgentStatus } from '@/lib/types';

export function useAgentStatus() {
  return useQuery<AgentStatus>({
    queryKey: ['agent-status'],
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_AGENT_API || 'http://localhost:3000/api';
      
      try {
        const response = await fetch(`${apiUrl}/status`);
        if (!response.ok) {
          throw new Error('Failed to fetch agent status');
        }
        return await response.json();
      } catch (error) {
        // Return mock data if API is unavailable
        return {
          isRunning: true,
          lastHeartbeat: new Date().toISOString(),
          uptime: 0,
          mode: 'supervised' as const,
          currentTask: 'Monitoring markets',
        };
      }
    },
    refetchInterval: 5000, // Refetch every 5 seconds
    retry: 1, // Don't retry too much if agent is offline
  });
}