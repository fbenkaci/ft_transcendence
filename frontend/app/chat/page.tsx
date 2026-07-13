"use client"

import Link from "next/link"
import { useEffect, useState, useRef, useCallback } from "react"
import { House, Send, User, MessageCircle } from 'lucide-react'
import { useRouter } from "next/navigation"

// --- HOOK WEBSOCKET & HISTORIQUE ---
export function useChat(room: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  // 1. Charger l'historique des messages au moment où on ouvre la room
  useEffect(() => {
    if (!room) return;
    
    const fetchHistory = async () => {
      const token = localStorage.getItem('access_token');
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://localhost:8443';
      
      try {
        const res = await fetch(`${backendUrl}/api/chat/${room}/history/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error("Erreur chargement historique:", err);
      }
    };

    fetchHistory();
  }, [room]);

  // 2. Connexion WebSocket pour les NOUVEAUX messages en temps réel
  useEffect(() => {
    if (!room) return;

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const origin = window.location.protocol === 'https:' ? window.location.host : `${window.location.hostname}:8000`;
    const token = localStorage.getItem('access_token');
    
    const ws = new WebSocket(`${proto}://${origin}/ws/chat/${room}/?token=${token||''}`);
    wsRef.current = ws;
    
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setMessages(m => [...m, data]);
    };
    
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [room]);

  const sendMessage = useCallback((content: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'send_message', content }));
    }
  }, []);

  return { messages, sendMessage };
}

// --- PAGE PRINCIPALE ---
export default function ChatPage() {
  const router = useRouter();
  
  const [myId, setMyId] = useState<number | null>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<any | null>(null);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas quand un nouveau message arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Récupérer mon ID et mes vrais amis depuis le backend Django
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://localhost:8443';

    const fetchMyData = async () => {
      try {
        // Récupérer mon profil
        const resMe = await fetch(`${backendUrl}/api/me/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resMe.ok) {
          const dataMe = await resMe.json();
          setMyId(dataMe.id);
        }

        // Récupérer mes amis
        const resFriends = await fetch(`${backendUrl}/api/my-friends/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resFriends.ok) {
          const dataFriends = await resFriends.json();
          setFriends(dataFriends);
        }
      } catch (err) {
        console.error("Erreur réseau", err);
      }
    };

    fetchMyData();

    // Polling: Rafraîchir la liste d'amis toutes les 10 secondes pour le "Temps réel" des statuts
    const interval = setInterval(fetchMyData, 10000);
    return () => clearInterval(interval);
  }, [router]);

  // Générer la room dynamique (ex: "chat_1_5")
  const getRoomName = () => {
    if (!myId || !selectedFriend) return null;
    const min = Math.min(myId, selectedFriend.id);
    const max = Math.max(myId, selectedFriend.id);
    return `chat_${min}_${max}`;
  };

  const { messages, sendMessage } = useChat(getRoomName());

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() !== "") {
      sendMessage(inputValue);
      setInputValue("");
    }
  };

  return (
    <div className="flex h-screen bg-black text-white p-4 gap-4">
      
      {/* BARRE LATÉRALE (Mes vrais amis) */}
      <div className="w-1/4 max-w-sm bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MessageCircle size={20} />
            Messages
          </h2>
          <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
            <House size={20} />
          </Link>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {friends.length === 0 ? (
            <p className="text-zinc-500 text-center text-sm mt-4">Vous n'avez pas encore d'amis.</p>
          ) : (
            friends.map(friend => (
              <button
                key={friend.id}
                onClick={() => setSelectedFriend(friend)}
                className={`w-full text-left p-3 rounded-lg mb-2 flex items-center gap-3 transition-colors ${
                  selectedFriend?.id === friend.id ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                }`}
              >
                <div className="relative">
                  <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center overflow-hidden">
                    {friend.avatar ? (
                      <img src={friend.avatar} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User size={20} className="text-zinc-400" />
                    )}
                  </div>
                  {/* Point de statut en temps réel */}
                  <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-900 ${
                    friend.status === 'online' ? 'bg-green-500' : 
                    friend.status === 'ingame' ? 'bg-blue-500' : 'bg-zinc-500'
                  }`}></span>
                </div>
                <div>
                  <p className="font-semibold">{friend.username}</p>
                  <p className="text-xs text-zinc-400 capitalize">{friend.status}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ZONE DE CHAT PRINCIPALE */}
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl flex flex-col">
        {selectedFriend ? (
          <>
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 rounded-t-lg">
              <h3 className="text-lg font-bold flex items-center gap-2">
                Chat avec <span className="text-blue-400">{selectedFriend.username}</span>
              </h3>
            </div>

            {/* Zone des messages dynamique */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                  <MessageCircle size={48} className="mb-4 opacity-20" />
                  <p>Envoyez un message pour démarrer la discussion.</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isMe = msg.sender === myId || msg.sender?.id === myId;
                  
                  return (
                    <div key={index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] p-3 rounded-xl ${
                        isMe 
                          ? 'bg-blue-600 text-white rounded-br-none' 
                          : 'bg-zinc-800 text-zinc-200 rounded-bl-none'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input d'envoi */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900 rounded-b-lg">
              <form onSubmit={handleSend} className="flex gap-3">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={`Écrire à ${selectedFriend.username}...`}
                  className="flex-1 bg-black border border-zinc-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button 
                  type="submit" 
                  disabled={!inputValue.trim()}
                  className="bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <MessageCircle size={64} className="mb-4 opacity-20" />
            <p className="text-xl">Sélectionnez un ami pour discuter</p>
          </div>
        )}
      </div>
      
    </div>
  );
}