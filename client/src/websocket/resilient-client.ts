import { io, Socket } from 'socket.io-client'

export interface ReconnectionConfig {
  maxAttempts: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
}

export interface ClientEvents {
  connect: () => void
  disconnect: (reason: string) => void
  error: (error: Error) => void
  reconnecting: (attempt: number) => void
  reconnected: () => void
  maxReconnectAttempts: () => void
}

export class ResilientWebSocketClient {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private messageQueue: Array<{ event: string; data: unknown }> = []
  private eventHandlers = new Map<string, Set<(...args: any[]) => void>>()
  private isManuallyDisconnected = false

  constructor(
    private url: string,
    private getToken: () => string | null,
    private config: ReconnectionConfig = {
      maxAttempts: 10,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 1.5
    }
  ) {}

  connect(): void {
    if (this.socket?.connected) {
      console.warn('Already connected')
      return
    }

    this.isManuallyDisconnected = false

    const token = this.getToken()
    if (!token) {
      console.error('No authentication token available')
      this.emitEvent('error', new Error('No authentication token'))
      return
    }

    this.socket = io(this.url, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: false // We handle reconnection manually
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server')
      this.reconnectAttempts = 0
      this.emitEvent('connect')

      // Flush message queue
      while (this.messageQueue.length > 0) {
        const { event, data } = this.messageQueue.shift()!
        this.socket!.emit(event, data)
      }

      if (this.reconnectAttempts > 0) {
        this.emitEvent('reconnected')
      }
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from WebSocket server:', reason)
      this.emitEvent('disconnect', reason)

      if (reason === 'io server disconnect' || this.isManuallyDisconnected) {
        // Server forced disconnect or manual disconnect, don't reconnect
        return
      }

      this.scheduleReconnect()
    })

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      this.emitEvent('error', error)
      this.scheduleReconnect()
    })

    // Heartbeat monitoring
    let lastHeartbeat = Date.now()

    this.socket.on('heartbeat', () => {
      lastHeartbeat = Date.now()
      this.socket!.emit('heartbeat:ack')
    })

    // Monitor heartbeat
    const heartbeatMonitor = setInterval(() => {
      if (!this.socket?.connected) {
        clearInterval(heartbeatMonitor)
        return
      }

      const timeSinceHeartbeat = Date.now() - lastHeartbeat

      if (timeSinceHeartbeat > 60000) {
        console.warn('No heartbeat for 60s, reconnecting...')
        this.socket.disconnect()
        this.scheduleReconnect()
        clearInterval(heartbeatMonitor)
      }
    }, 10000)

    this.socket.on('disconnect', () => {
      clearInterval(heartbeatMonitor)
    })

    // Re-attach all event handlers
    for (const [event, handlers] of this.eventHandlers.entries()) {
      for (const handler of handlers) {
        this.socket.on(event, handler)
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isManuallyDisconnected) return

    if (this.reconnectAttempts >= this.config.maxAttempts) {
      console.error('Max reconnection attempts reached')
      this.emitEvent('maxReconnectAttempts')
      return
    }

    const delay = Math.min(
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, this.reconnectAttempts),
      this.config.maxDelay
    )

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`)
    this.emitEvent('reconnecting', this.reconnectAttempts + 1)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectAttempts++
      this.connect()
    }, delay)
  }

  emit(event: string, data: unknown): void {
    if (!this.socket?.connected) {
      // Queue message if disconnected
      console.warn(`Not connected, queuing message: ${event}`)
      this.messageQueue.push({ event, data })
      return
    }

    this.socket.emit(event, data)
  }

  on(event: string, callback: (...args: any[]) => void): void {
    // Store handler for re-attachment on reconnect
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(callback)

    this.socket?.on(event, callback)
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (callback) {
      this.eventHandlers.get(event)?.delete(callback)
      this.socket?.off(event, callback)
    } else {
      this.eventHandlers.delete(event)
      this.socket?.off(event)
    }
  }

  disconnect(): void {
    this.isManuallyDisconnected = true

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.socket?.disconnect()
    this.socket = null
    this.messageQueue = []
  }

  get connected(): boolean {
    return this.socket?.connected ?? false
  }

  get queuedMessageCount(): number {
    return this.messageQueue.length
  }

  clearQueue(): void {
    this.messageQueue = []
  }

  private emitEvent(event: keyof ClientEvents, ...args: any[]): void {
    // Emit to internal event handlers
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => handler(...args))
    }
  }
}
