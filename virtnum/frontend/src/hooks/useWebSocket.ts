import { useEffect } from 'react';
import { wsClient } from '@/lib/websocket';
import { useAuthStore } from '@/store/authStore';

export const useWebSocket = () => {
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (accessToken && !wsClient.isConnected()) {
      wsClient.connect(accessToken);
    }
    return () => {};
  }, [accessToken]);

  return wsClient;
};

export const useWsEvent = (type: string, handler: (data: any) => void) => {
  const ws = useWebSocket();

  useEffect(() => {
    const unsubscribe = ws.on(type, handler);
    return unsubscribe;
  }, [type, handler]);
};
