import { useEffect, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/contexts/AuthContext';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000';

let sharedSocket: Socket | null = null;
let currentUserId: string | null = null;

const createSharedSocket = (userId: string): Socket => {
  if (sharedSocket && currentUserId === userId) {
    return sharedSocket;
  }

  if (sharedSocket) {
    sharedSocket.removeAllListeners();
    sharedSocket.close();
    sharedSocket = null;
  }

  currentUserId = userId;
  sharedSocket = io(SOCKET_URL, {
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionDelay: 1200,
    reconnectionDelayMax: 4000,
    reconnectionAttempts: 3,
    timeout: 10000,
    auth: {
      userId,
      token: localStorage.getItem('authToken'),
    },
  });

  return sharedSocket;
};

export const useSocket = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    if (!user?._id) return;

    const socket = createSharedSocket(user._id);

    const onConnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);

      socket.emit('user-connected', {
        userId: user._id,
        socketId: socket.id,
      });

      socket.emit('join-room', { roomId: `user_${user._id}`, userId: user._id });
      socket.emit('join-room', { roomId: `${user.role}_${user._id}`, userId: user._id });
    };

    const onDisconnect = () => {
      setIsConnected(false);
      setIsReconnecting(true);
    };

    const onReconnectAttempt = () => {
      setIsReconnecting(true);
    };

    const onReconnect = () => {
      setIsReconnecting(false);
    };

    const onConnectError = () => {
      setIsConnected(false);
      setIsReconnecting(true);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('reconnect_attempt', onReconnectAttempt);
    socket.on('reconnect', onReconnect);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('reconnect_attempt', onReconnectAttempt);
      socket.off('reconnect', onReconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [user?._id, user?.role]);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    sharedSocket?.on(event, callback);
  }, []);

  const emit = useCallback((event: string, data: any) => {
    sharedSocket?.emit(event, data);
  }, []);

  const off = useCallback((event: string, callback?: (data: any) => void) => {
    if (!sharedSocket) return;
    if (callback) {
      sharedSocket.off(event, callback);
      return;
    }
    sharedSocket.off(event);
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    if (!user?._id) return;
    sharedSocket?.emit('join-room', { roomId, userId: user._id });
  }, [user?._id]);

  const leaveRoom = useCallback((roomId: string) => {
    if (!user?._id) return;
    sharedSocket?.emit('leave-room', { roomId, userId: user._id });
  }, [user?._id]);

  const storeSessionData = useCallback((key: string, value: any) => {
    if (!user?._id) return;
    sharedSocket?.emit('store-session-data', { userId: user._id, key, value });
  }, [user?._id]);

  return {
    socket: sharedSocket,
    isConnected,
    isReconnecting,
    on,
    emit,
    off,
    joinRoom,
    leaveRoom,
    storeSessionData,
    getRooms: () => [],
    getSessionData: () => ({}),
  };
};

export default useSocket;
