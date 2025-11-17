import { useEffect, useState, useCallback, useRef } from 'react'
import { ResilientWebSocketClient } from '../websocket/resilient-client'

export interface UseWebSocketOptions {
  url: string
  getToken: () => string | null
  autoConnect?: boolean
}

export interface WebSocketState {
  connected: boolean
  reconnecting: boolean
  error: Error | null
}

export function useWebSocket({ url, getToken, autoConnect = true }: UseWebSocketOptions) {
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    reconnecting: false,
    error: null
  })

  const clientRef = useRef<ResilientWebSocketClient | null>(null)

  useEffect(() => {
    const client = new ResilientWebSocketClient(url, getToken)
    clientRef.current = client

    // Setup event handlers
    client.on('connect', () => {
      setState({ connected: true, reconnecting: false, error: null })
    })

    client.on('disconnect', () => {
      setState(prev => ({ ...prev, connected: false }))
    })

    client.on('error', (error: Error) => {
      setState(prev => ({ ...prev, error }))
    })

    client.on('reconnecting', () => {
      setState(prev => ({ ...prev, reconnecting: true }))
    })

    client.on('reconnected', () => {
      setState({ connected: true, reconnecting: false, error: null })
    })

    client.on('maxReconnectAttempts', () => {
      setState(prev => ({
        ...prev,
        reconnecting: false,
        error: new Error('Max reconnection attempts reached')
      }))
    })

    if (autoConnect) {
      client.connect()
    }

    return () => {
      client.disconnect()
    }
  }, [url, getToken, autoConnect])

  const connect = useCallback(() => {
    clientRef.current?.connect()
  }, [])

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect()
  }, [])

  const emit = useCallback((event: string, data: unknown) => {
    clientRef.current?.emit(event, data)
  }, [])

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    clientRef.current?.on(event, callback)
    return () => {
      clientRef.current?.off(event, callback)
    }
  }, [])

  return {
    ...state,
    connect,
    disconnect,
    emit,
    on,
    client: clientRef.current
  }
}
