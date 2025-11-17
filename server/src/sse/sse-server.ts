import { Request, Response } from 'express'
import { logger } from '../utils/logger'

export interface SSEClient {
  id: string
  userId: string
  response: Response
  lastActivity: number
}

export class SSEManager {
  private clients = new Map<string, SSEClient>()
  private pingInterval: NodeJS.Timeout

  constructor(private pingIntervalMs: number = 30000) {
    // Send ping to all clients periodically
    this.pingInterval = setInterval(() => {
      this.pingAllClients()
    }, this.pingIntervalMs)
  }

  // Connect a new SSE client
  connect(req: Request, res: Response, userId: string): string {
    const clientId = `sse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable buffering in Nginx
    })

    // Send initial connection event
    this.sendEvent(res, 'connected', {
      clientId,
      timestamp: Date.now()
    })

    // Store client
    const client: SSEClient = {
      id: clientId,
      userId,
      response: res,
      lastActivity: Date.now()
    }
    this.clients.set(clientId, client)

    logger.info(`SSE client connected: ${clientId} (user: ${userId})`)

    // Handle client disconnect
    req.on('close', () => {
      this.disconnect(clientId)
    })

    return clientId
  }

  // Disconnect a client
  disconnect(clientId: string): void {
    const client = this.clients.get(clientId)
    if (client) {
      try {
        client.response.end()
      } catch (error) {
        // Client already disconnected
      }
      this.clients.delete(clientId)
      logger.info(`SSE client disconnected: ${clientId}`)
    }
  }

  // Send event to specific client
  sendToClient(clientId: string, event: string, data: any): boolean {
    const client = this.clients.get(clientId)
    if (!client) {
      return false
    }

    try {
      this.sendEvent(client.response, event, data)
      client.lastActivity = Date.now()
      return true
    } catch (error) {
      logger.error(`Failed to send to client ${clientId}:`, error)
      this.disconnect(clientId)
      return false
    }
  }

  // Send event to all clients of a specific user
  sendToUser(userId: string, event: string, data: any): number {
    let count = 0
    for (const [clientId, client] of this.clients.entries()) {
      if (client.userId === userId) {
        if (this.sendToClient(clientId, event, data)) {
          count++
        }
      }
    }
    return count
  }

  // Broadcast event to all connected clients
  broadcast(event: string, data: any): number {
    let count = 0
    for (const clientId of this.clients.keys()) {
      if (this.sendToClient(clientId, event, data)) {
        count++
      }
    }
    return count
  }

  // Send event to clients in a specific room/group
  sendToRoom(roomId: string, event: string, data: any, userIds: string[]): number {
    let count = 0
    for (const [clientId, client] of this.clients.entries()) {
      if (userIds.includes(client.userId)) {
        if (this.sendToClient(clientId, event, data)) {
          count++
        }
      }
    }
    return count
  }

  // Send event via SSE protocol
  private sendEvent(res: Response, event: string, data: any): void {
    const eventId = Date.now().toString()

    res.write(`id: ${eventId}\n`)
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  // Send ping to all clients to keep connection alive
  private pingAllClients(): void {
    const now = Date.now()
    const staleThreshold = 60000 // 60 seconds

    for (const [clientId, client] of this.clients.entries()) {
      // Check if client is stale
      if (now - client.lastActivity > staleThreshold) {
        logger.warn(`Client ${clientId} appears stale, disconnecting`)
        this.disconnect(clientId)
        continue
      }

      // Send ping
      try {
        this.sendEvent(client.response, 'ping', { timestamp: now })
        client.lastActivity = now
      } catch (error) {
        logger.error(`Failed to ping client ${clientId}:`, error)
        this.disconnect(clientId)
      }
    }
  }

  // Get connected client count
  getClientCount(): number {
    return this.clients.size
  }

  // Get user count
  getUserCount(): number {
    const uniqueUsers = new Set<string>()
    for (const client of this.clients.values()) {
      uniqueUsers.add(client.userId)
    }
    return uniqueUsers.size
  }

  // Cleanup
  destroy(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
    }

    // Disconnect all clients
    for (const clientId of this.clients.keys()) {
      this.disconnect(clientId)
    }
  }
}

// Example usage in Express:
// const sseManager = new SSEManager()
//
// app.get('/events', authMiddleware, (req, res) => {
//   const userId = req.user.id
//   sseManager.connect(req, res, userId)
// })
//
// // Send event to user
// sseManager.sendToUser(userId, 'notification', {
//   title: 'New Message',
//   body: 'You have a new message'
// })
