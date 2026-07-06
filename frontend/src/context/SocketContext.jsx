// src/context/SocketContext.jsx
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export const SocketProvider = ({ children }) => {
  const { user } = useAuth()
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!user) return

    const socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
      transports: ['websocket'],
      auth: { token: localStorage.getItem('edupay_token') },
    })

    socket.on('connect',    () => { setConnected(true);  console.log('🔌 Socket connected') })
    socket.on('disconnect', () => { setConnected(false); console.log('🔌 Socket disconnected') })

    // Auto-join school room
    if (user.schoolId) {
      socket.emit('join:school', typeof user.schoolId === 'object' ? user.schoolId._id : user.schoolId)
    }

    socketRef.current = socket

    return () => { socket.disconnect(); socketRef.current = null }
  }, [user])

  const on  = (event, cb) => socketRef.current?.on(event, cb)
  const off = (event, cb) => socketRef.current?.off(event, cb)

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, on, off }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
