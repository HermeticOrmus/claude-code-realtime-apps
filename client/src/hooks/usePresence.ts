import { useState, useEffect, useCallback } from 'react'
import { useWebSocket } from './useWebSocket'
import type { Presence } from '@realtime-apps/shared'

export interface UsePresenceOptions {
  url: string
  getToken: () => string | null
}

export function usePresence({ url, getToken }: UsePresenceOptions) {
  const [users, setUsers] = useState<Presence[]>([])

  const { connected, emit, on } = useWebSocket({
    url,
    getToken,
    autoConnect: true
  })

  useEffect(() => {
    if (!connected) return

    // Subscribe to presence updates
    emit('presence:subscribe', null)

    // Listen for presence list
    const unsubList = on('presence:list', (presenceList: Presence[]) => {
      setUsers(presenceList)
    })

    // Listen for presence updates
    const unsubUpdated = on('presence:updated', (presence: Presence) => {
      setUsers(prev => {
        const existing = prev.find(u => u.userId === presence.userId)
        if (existing) {
          return prev.map(u => (u.userId === presence.userId ? presence : u))
        } else {
          return [...prev, presence]
        }
      })
    })

    return () => {
      emit('presence:unsubscribe', null)
      unsubList()
      unsubUpdated()
    }
  }, [connected, emit, on])

  const updateStatus = useCallback(
    (status: 'active' | 'idle' | 'away', currentPage?: string) => {
      if (!connected) return

      emit('presence:update', {
        status,
        currentPage
      })
    },
    [connected, emit]
  )

  const sendActivity = useCallback(() => {
    if (!connected) return
    emit('presence:activity', null)
  }, [connected, emit])

  const updateVisibility = useCallback(
    (isVisible: boolean) => {
      if (!connected) return
      emit('presence:visibility', isVisible)
    },
    [connected, emit]
  )

  // Auto-detect page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      updateVisibility(!document.hidden)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [updateVisibility])

  // Auto-detect user activity
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']

    const handleActivity = () => {
      sendActivity()
    }

    // Throttle activity updates to max once per 30 seconds
    let lastActivity = 0
    const throttledHandleActivity = () => {
      const now = Date.now()
      if (now - lastActivity > 30000) {
        lastActivity = now
        handleActivity()
      }
    }

    events.forEach(event => {
      window.addEventListener(event, throttledHandleActivity)
    })

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, throttledHandleActivity)
      })
    }
  }, [sendActivity])

  return {
    users,
    connected,
    updateStatus,
    sendActivity
  }
}
