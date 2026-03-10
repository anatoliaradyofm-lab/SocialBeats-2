import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://localhost:8080';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.connected = false;
  }

  async connect() {
    if (this.socket?.connected) return;

    const token = await AsyncStorage.getItem('token');
    
    this.socket = io(API_URL, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  joinRoom(roomId) {
    if (this.socket?.connected) {
      this.socket.emit('join_room', { room_id: roomId });
    }
  }

  leaveRoom(roomId) {
    if (this.socket?.connected) {
      this.socket.emit('leave_room', { room_id: roomId });
    }
  }

  sendMessage(conversationId, message) {
    if (this.socket?.connected) {
      this.socket.emit('send_message', {
        conversation_id: conversationId,
        ...message,
      });
    }
  }

  sendTyping(conversationId, isTyping) {
    if (this.socket?.connected) {
      this.socket.emit('typing', {
        conversation_id: conversationId,
        is_typing: isTyping,
      });
    }
  }

  onNewMessage(callback) {
    this.socket?.on('new_message', callback);
    this.listeners.set('new_message', callback);
  }

  onTyping(callback) {
    this.socket?.on('user_typing', callback);
    this.listeners.set('user_typing', callback);
  }

  onMessageDeleted(callback) {
    this.socket?.on('message_deleted', callback);
  }

  onMessageEdited(callback) {
    this.socket?.on('message_edited', callback);
  }

  onRoomUpdate(callback) {
    this.socket?.on('room_update', callback);
  }

  removeAllListeners() {
    this.listeners.forEach((callback, event) => {
      this.socket?.off(event, callback);
    });
    this.listeners.clear();
  }

  isConnected() {
    return this.connected;
  }
}

export default new SocketService();
