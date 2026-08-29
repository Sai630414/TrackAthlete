import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { Send, X, MessageCircle, Check, CheckCheck } from 'lucide-react';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(dateStr) {
  if (!dateStr) return 'Today';
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ChatPanel({ connectionId, otherPersonName, onClose }) {
  const { user } = useAuth();
  const { socket, openChatForConnection, closeChat } = useSocket();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Sync activeChatId in SocketContext so notifications work immediately when closed
  useEffect(() => {
    if (!connectionId) return;
    openChatForConnection?.(connectionId);
    return () => {
      closeChat?.();
    };
  }, [connectionId, openChatForConnection, closeChat]);

  // Fetch message history & mark existing as read
  useEffect(() => {
    if (!connectionId) return;
    setLoading(true);
    const userIdQuery = user?._id ? `?userId=${user._id}` : '';
    api.get(`/chat/${connectionId}${userIdQuery}`)
      .then(res => setMessages(res.data || []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [connectionId, user?._id]);

  // Join connection room for real-time chat
  useEffect(() => {
    if (!socket || !connectionId) return;
    socket.emit('join-connection-room', connectionId);

    const handleMessage = (msg) => {
      const senderId = (msg.sender?._id || msg.sender)?.toString();
      const currentUserId = user?._id?.toString();

      // If message is from other party and chat is currently open, mark as read
      if (senderId && currentUserId && senderId !== currentUserId) {
        api.put(`/chat/${connectionId}/read`, { userId: currentUserId }).catch(() => {});
      }

      setMessages(prev => {
        // If message already exists by ID, ignore
        if (prev.some(m => m._id === msg._id)) return prev;

        // If sent by current user, replace any matching optimistic message
        if (senderId === currentUserId) {
          const optIdx = prev.findIndex(m => m.isOptimistic && m.text === msg.text);
          if (optIdx !== -1) {
            const next = [...prev];
            next[optIdx] = msg;
            return next;
          }
        }
        return [...prev, msg];
      });
    };

    socket.on('chat-message', handleMessage);

    return () => {
      socket.off('chat-message', handleMessage);
      socket.emit('leave-connection-room', connectionId);
    };
  }, [socket, connectionId, user?._id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setText('');

    // Optimistic temporary message
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      _id: tempId,
      connectionId,
      sender: { _id: user._id, name: user.name, role: user.role },
      text: trimmed,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const res = await api.post(`/chat/${connectionId}`, { sender: user._id, text: trimmed });
      // When server responds, replace temp message or filter out temp if socket already added it
      setMessages(prev => {
        if (prev.some(m => m._id === res.data._id)) {
          return prev.filter(m => m._id !== tempId);
        }
        return prev.map(m => m._id === tempId ? res.data : m);
      });
    } catch {
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m._id !== tempId));
      setText(trimmed);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [text, sending, connectionId, user]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const label = formatDate(msg.createdAt);
    if (!groups[label]) groups[label] = [];
    groups[label].push(msg);
    return groups;
  }, {});

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '520px',
      border: '1px solid #d8ded5',
      borderRadius: '16px',
      overflow: 'hidden',
      background: '#fcfcf8',
      boxShadow: '0 12px 36px rgba(23, 50, 53, 0.12)',
    }}>
      {/* Sleek Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        background: 'linear-gradient(135deg, #173d3c, #0c292c)',
        borderBottom: '1px solid #2f6d5a',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: '#e2eee4', border: '2px solid #2f6d5a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 16, color: '#194e42', flexShrink: 0
          }}>
            {otherPersonName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{otherPersonName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#b7da78', boxShadow: '0 0 0 2px rgba(183,218,120,0.3)' }} />
              <span style={{ color: '#b9d9bf', fontSize: 11, fontWeight: 600 }}>Active Mentorship Channel</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.12)', border: 'none',
                borderRadius: 8, padding: '6px 8px', cursor: 'pointer',
                color: '#c5d3ce', display: 'flex', alignItems: 'center',
                transition: 'background 0.2s',
              }}
              title="Close chat"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Message History */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#697c7c', fontSize: 13 }}>Loading conversation…</div>
          </div>
        ) : Object.keys(groupedMessages).length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e2eee4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageCircle size={24} color="#194e42" />
            </div>
            <div style={{ color: '#526668', fontSize: 13, textAlign: 'center', fontWeight: 500 }}>
              No messages yet.<br />
              <span style={{ fontSize: 11, color: '#8a9d9a' }}>Say hello and share training updates or tournament questions!</span>
            </div>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([dateLabel, msgs]) => (
            <div key={dateLabel}>
              {/* Date divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 10px' }}>
                <div style={{ flex: 1, height: 1, background: '#e2ede4' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#8a9d9a', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {dateLabel}
                </span>
                <div style={{ flex: 1, height: 1, background: '#e2ede4' }} />
              </div>

              {msgs.map((msg) => {
                const isMine = (msg.sender?._id === user._id || msg.sender === user._id);
                return (
                  <div
                    key={msg._id}
                    style={{
                      display: 'flex',
                      justifyContent: isMine ? 'flex-end' : 'flex-start',
                      marginBottom: 8,
                    }}
                  >
                    <div style={{
                      maxWidth: '75%',
                      padding: '10px 14px',
                      borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: isMine ? '#e07050' : '#ffffff',
                      color: isMine ? '#ffffff' : '#173235',
                      border: isMine ? 'none' : '1px solid #d8ded5',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                      opacity: msg.isOptimistic ? 0.75 : 1,
                      transition: 'opacity 0.2s',
                    }}>
                      <div style={{ fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.text}</div>
                      <div style={{
                        fontSize: 10, marginTop: 4, textAlign: isMine ? 'right' : 'left',
                        color: isMine ? 'rgba(255,255,255,0.75)' : '#8a9d9a',
                        display: 'flex', alignItems: 'center', justifyContent: isMine ? 'flex-end' : 'flex-start', gap: 4
                      }}>
                        <span>{formatTime(msg.createdAt)}</span>
                        {isMine && !msg.isOptimistic && <Check size={11} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 18px',
        borderTop: '1px solid #e2ede4',
        background: '#ffffff',
      }}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message… (Press Enter to send)"
          style={{
            flex: 1,
            height: 42,
            border: '1px solid #d2dad2',
            borderRadius: 10,
            padding: '0 16px',
            fontSize: 13,
            background: '#f9faf8',
            color: '#1d2c31',
            outline: 'none',
            transition: 'border 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = '#2f6d5a'}
          onBlur={e => e.target.style.borderColor = '#d2dad2'}
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim() || sending}
          style={{
            height: 42,
            padding: '0 18px',
            borderRadius: 10,
            border: 'none',
            background: text.trim() && !sending ? '#e07050' : '#d8ded5',
            color: '#fff',
            cursor: text.trim() && !sending ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 800,
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            transition: 'background 0.2s, transform 0.15s',
            transform: text.trim() && !sending ? 'scale(1)' : 'scale(0.98)',
            boxShadow: text.trim() && !sending ? '0 4px 12px rgba(224,112,80,0.25)' : 'none',
          }}
        >
          <Send size={14} />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
}
