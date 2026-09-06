import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useToast } from '../components/ui/use-toast';
import api from '../services/api';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [socket, setSocket] = useState(null);
  const [notifCount, setNotifCount] = useState(0); // coach request count
  const [unreadByConnection, setUnreadByConnection] = useState({}); // { [connectionId]: count }
  const [activeChatId, setActiveChatId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const activeChatIdRef = useRef(null);
  activeChatIdRef.current = activeChatId;

  // Fetch persisted unread messages on login / mount
  const fetchPersistedUnread = useCallback(async () => {
    if (!user?._id) return;
    try {
      const res = await api.get(`/chat/unread/${user._id}`);
      if (res.data?.byConnection) {
        setUnreadByConnection(res.data.byConnection);
      }
    } catch (err) {
      console.error('Error fetching unread counts:', err);
    }
  }, [user?._id]);

  useEffect(() => {
    fetchPersistedUnread();
  }, [fetchPersistedUnread]);

  // Connect socket once per user session
  useEffect(() => {
    if (!user?._id) {
      setSocket(prev => {
        if (prev) prev.disconnect();
        return null;
      });
      setIsConnected(false);
      return;
    }

    const s = io(SOCKET_URL, {
      query: { userId: user._id },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    s.on('connect', () => {
      console.log('Socket connected successfully to server for user:', user._id);
      setIsConnected(true);
    });

    s.on('connect_error', (err) => {
      // Gracefully handle socket connection errors in serverless environments
      setIsConnected(false);
    });

    s.on('error', (err) => {
      setIsConnected(false);
    });

    s.on('disconnect', () => {
      console.log('Socket disconnected from server');
      setIsConnected(false);
    });

    // 1. Incoming mentorship request (for coach)
    s.on('connection-request', (data) => {
      if (user.role === 'coach') {
        setNotifCount(n => n + 1);
        toastRef.current?.({
          title: '📩 New Mentorship Request!',
          description: `Athlete ${data.athlete?.name || 'an athlete'} (${data.athlete?.sport || 'Sport'}) has requested your mentorship.`,
          variant: 'default'
        });
      }
    });

    // 2. Incoming chat message notification (for both athlete & coach)
    s.on('new-message-notification', (data) => {
      console.log('[Socket] Received new-message-notification:', data);

      // If user currently has this chat open, don't show toast
      if (activeChatIdRef.current === data.connectionId) {
        return;
      }

      setUnreadByConnection(prev => ({
        ...prev,
        [data.connectionId]: (prev[data.connectionId] || 0) + 1
      }));

      const previewText = data.text?.length > 45 ? data.text.slice(0, 45) + '…' : data.text;
      toastRef.current?.({
        title: `💬 New message from ${data.senderName || 'Coach'}`,
        description: `"${previewText}"`,
        variant: 'default'
      });
    });

    // 3. Mentorship accepted (for athlete)
    s.on('connection-accepted', (data) => {
      toastRef.current?.({
        title: '🎉 Mentorship Request Accepted!',
        description: `Coach ${data.coach?.name || ''} has accepted your request. Real-time chat & session notes are now open!`,
        variant: 'success'
      });
    });

    // 4. Mentorship rejected (for athlete)
    s.on('connection-rejected', (data) => {
      toastRef.current?.({
        title: 'Request Update',
        description: `Coach ${data.coachName || ''} was unable to accept your request at this time.`,
        variant: 'default'
      });
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [user?._id, user?.role]);

  const clearNotifs = useCallback(() => setNotifCount(0), []);

  const openChatForConnection = useCallback((connectionId) => {
    setActiveChatId(connectionId);
    setUnreadByConnection(prev => ({
      ...prev,
      [connectionId]: 0
    }));
    // Mark as read in database
    if (user?._id && connectionId) {
      api.put(`/chat/${connectionId}/read`, { userId: user._id }).catch(() => {});
    }
  }, [user?._id]);

  const closeChat = useCallback(() => {
    setActiveChatId(null);
  }, []);

  const totalUnreadMessages = useMemo(() => {
    return Object.values(unreadByConnection).reduce((a, b) => a + (Number(b) || 0), 0);
  }, [unreadByConnection]);

  const value = useMemo(() => ({
    socket,
    notifCount,
    clearNotifs,
    unreadByConnection,
    totalUnreadMessages,
    openChatForConnection,
    closeChat,
    activeChatId,
    isConnected,
  }), [socket, notifCount, clearNotifs, unreadByConnection, totalUnreadMessages, openChatForConnection, closeChat, activeChatId, isConnected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
}
