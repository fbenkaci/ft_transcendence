import { useEffect, useRef, useState, useCallback } from 'react';

export function useChat(room: string) {
  const wsRef = useRef<WebSocket|null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const origin = window.location.protocol === 'https:' ? window.location.host : `${window.location.hostname}:8000`;
    const token = localStorage.getItem('access_token');
    const ws = new WebSocket(`${proto}://${origin}/ws/chat/${room}/?token=${token||''}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setMessages(m => [...m, data]);
    };
    return () => ws.close();
  }, [room]);

  const sendMessage = useCallback((content: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'send_message', content }));
    }
  }, []);

  return { messages, sendMessage };
}