import { io } from 'socket.io-client';

const SOCKET_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://social-music-fix.preview.emergentagent.com/api').replace(/\/api\/?$/, '');

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect(token) {
    if (this.socket?.connected) return;
    this.token = token;
    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      if (this.token) this.emit('authenticate', { token: this.token });
    });
    this.socket.on('disconnect', (reason) => console.log('Socket disconnected:', reason));
    this.socket.on('connect_error', (err) => console.error('Socket error:', err.message));
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  emit(event, data) {
    this.socket?.emit(event, data);
  }

  on(event, callback) {
    this.socket?.on(event, callback);
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    this.socket?.off(event, callback);
    const cbs = this.listeners.get(event);
    if (cbs) this.listeners.set(event, cbs.filter(cb => cb !== callback));
  }

  joinRoom(conversationId) {
    this.emit('join_conversation', { conversation_id: conversationId });
  }

  leaveRoom(conversationId) {
    this.emit('leave_conversation', { conversation_id: conversationId });
  }

  sendMessage(conversationId, message) {
    this.emit('send_message', { conversation_id: conversationId, ...message });
  }

  sendTyping(conversationId) {
    this.emit('typing_start', { conversation_id: conversationId });
  }

  stopTyping(conversationId) {
    this.emit('typing_stop', { conversation_id: conversationId });
  }
}

export default new SocketService();
