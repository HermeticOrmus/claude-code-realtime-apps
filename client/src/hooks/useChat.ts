import { useState, useEffect, useCallback } from 'react'
import { useWebSocket } from './useWebSocket'
import type { ChatMessage, TypingIndicator } from '@realtime-apps/shared'

export interface UseChatOptions {
  roomId: string
  url: string
  getToken: () => string | null
}

export function useChat({ roomId, url, getToken }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const { connected, emit, on } = useWebSocket({
    url,
    getToken,
    autoConnect: true
  })

  // Join room when connected
  useEffect(() => {
    if (!connected || !roomId) return

    emit('room:join', { roomId })

    // Listen for room history
    const unsubHistory = on('room:history', (data: { messages: ChatMessage[] }) => {
      setMessages(data.messages)
      setLoading(false)
    })

    return () => {
      emit('room:leave', roomId)
      unsubHistory()
    }
  }, [connected, roomId, emit, on])

  // Listen for new messages
  useEffect(() => {
    const unsubNew = on('message:new', (message: ChatMessage) => {
      setMessages(prev => [...prev, message])
    })

    const unsubEdited = on('message:edited', (data: { messageId: string; text: string; editedAt: number }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.messageId
            ? { ...msg, text: data.text, edited: true, editedAt: data.editedAt }
            : msg
        )
      )
    })

    const unsubDeleted = on('message:deleted', (data: { messageId: string }) => {
      setMessages(prev => prev.filter(msg => msg.id !== data.messageId))
    })

    return () => {
      unsubNew()
      unsubEdited()
      unsubDeleted()
    }
  }, [on])

  // Listen for typing indicators
  useEffect(() => {
    const unsubTyping = on('user:typing', (data: TypingIndicator) => {
      setTypingUsers(prev => new Set(prev).add(data.username))
    })

    const unsubStoppedTyping = on('user:stopped-typing', (data: { userId: string }) => {
      setTypingUsers(prev => {
        const next = new Set(prev)
        next.delete(data.userId)
        return next
      })
    })

    return () => {
      unsubTyping()
      unsubStoppedTyping()
    }
  }, [on])

  const sendMessage = useCallback((text: string) => {
    if (!connected || !text.trim()) return

    emit('message:send', {
      roomId,
      text: text.trim()
    })
  }, [connected, roomId, emit])

  const editMessage = useCallback((messageId: string, text: string) => {
    if (!connected || !text.trim()) return

    emit('message:edit', {
      messageId,
      text: text.trim()
    })
  }, [connected, emit])

  const deleteMessage = useCallback((messageId: string) => {
    if (!connected) return

    emit('message:delete', messageId)
  }, [connected, emit])

  const startTyping = useCallback(() => {
    if (!connected) return
    emit('typing:start', roomId)
  }, [connected, roomId, emit])

  const stopTyping = useCallback(() => {
    if (!connected) return
    emit('typing:stop', roomId)
  }, [connected, roomId, emit])

  const markAsRead = useCallback((messageId: string) => {
    if (!connected) return

    emit('message:read', {
      roomId,
      messageId
    })
  }, [connected, roomId, emit])

  const reactToMessage = useCallback((messageId: string, reaction: string) => {
    if (!connected) return

    emit('message:react', {
      messageId,
      roomId,
      reaction
    })
  }, [connected, roomId, emit])

  return {
    messages,
    typingUsers: Array.from(typingUsers),
    loading,
    connected,
    sendMessage,
    editMessage,
    deleteMessage,
    startTyping,
    stopTyping,
    markAsRead,
    reactToMessage
  }
}
