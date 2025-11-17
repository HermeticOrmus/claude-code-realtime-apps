import { Server, Socket } from 'socket.io'
import { presenceUpdateSchema } from '@realtime-apps/shared'
import { logger } from '../../utils/logger'
import { globalRateLimiter } from '../../middleware/rate-limit'

interface PresenceData {
  userId: string
  username: string
  status: 'active' | 'idle' | 'away'
  lastSeen: number
  currentPage?: string
}

export class PresenceHandler {
  private userPresence = new Map<string, PresenceData>()

  constructor(private io: Server) {
    // Cleanup stale presence every 30 seconds
    setInterval(() => this.cleanupStalePresence(), 30000)
  }

  handleConnection(socket: Socket): void {
    const userId = socket.data.user.id
    const username = socket.data.user.username

    // Set user as active
    this.updateUserPresence(userId, username, 'active')
    this.broadcastPresenceUpdate(userId)

    // Update presence
    socket.on('presence:update', (data: unknown) => {
      try {
        if (!globalRateLimiter.check(userId, 'presence:update')) return

        const result = presenceUpdateSchema.safeParse(data)
        if (!result.success) {
          socket.emit('error', { message: 'Invalid presence data' })
          return
        }

        const { status, currentPage } = result.data

        this.updateUserPresence(userId, username, status, currentPage)
        this.broadcastPresenceUpdate(userId)

        logger.debug(`Presence updated for ${username}: ${status}`)
      } catch (error) {
        logger.error('Error updating presence:', error)
      }
    })

    // Subscribe to presence updates
    socket.on('presence:subscribe', () => {
      // Send all current presence data
      const presenceList = Array.from(this.userPresence.values())
      socket.emit('presence:list', presenceList)
    })

    // Unsubscribe from presence updates
    socket.on('presence:unsubscribe', () => {
      // Client no longer wants presence updates
    })

    // Activity detection
    socket.on('presence:activity', () => {
      if (!globalRateLimiter.check(userId, 'presence:activity')) return

      const presence = this.userPresence.get(userId)
      if (presence && presence.status === 'idle') {
        this.updateUserPresence(userId, username, 'active')
        this.broadcastPresenceUpdate(userId)
      } else if (presence) {
        // Just update last seen
        presence.lastSeen = Date.now()
      }
    })

    // Page visibility change
    socket.on('presence:visibility', (isVisible: boolean) => {
      const presence = this.userPresence.get(userId)
      if (!presence) return

      if (isVisible && presence.status !== 'active') {
        this.updateUserPresence(userId, username, 'active')
        this.broadcastPresenceUpdate(userId)
      } else if (!isVisible && presence.status === 'active') {
        this.updateUserPresence(userId, username, 'idle')
        this.broadcastPresenceUpdate(userId)
      }
    })
  }

  handleDisconnect(socket: Socket): void {
    const userId = socket.data.user.id
    const username = socket.data.user.username

    // Check if user has other connections
    const remainingConnections = this.io.sockets.adapter.rooms.get(userId)

    if (!remainingConnections || remainingConnections.size === 0) {
      // No more connections, set as offline
      const presence = this.userPresence.get(userId)
      if (presence) {
        presence.status = 'away'
        presence.lastSeen = Date.now()
        this.broadcastPresenceUpdate(userId)

        // Remove from presence map after 5 minutes
        setTimeout(() => {
          this.userPresence.delete(userId)
          this.broadcastPresenceUpdate(userId)
        }, 5 * 60 * 1000)
      }
    }
  }

  private updateUserPresence(
    userId: string,
    username: string,
    status: 'active' | 'idle' | 'away',
    currentPage?: string
  ): void {
    const presence: PresenceData = {
      userId,
      username,
      status,
      lastSeen: Date.now(),
      currentPage
    }

    this.userPresence.set(userId, presence)
  }

  private broadcastPresenceUpdate(userId: string): void {
    const presence = this.userPresence.get(userId)

    if (presence) {
      this.io.emit('presence:updated', presence)
    } else {
      // User went offline
      this.io.emit('presence:updated', {
        userId,
        status: 'away'
      })
    }
  }

  private cleanupStalePresence(): void {
    const now = Date.now()
    const staleThreshold = 5 * 60 * 1000 // 5 minutes

    for (const [userId, presence] of this.userPresence.entries()) {
      if (now - presence.lastSeen > staleThreshold) {
        this.userPresence.delete(userId)
        this.broadcastPresenceUpdate(userId)
        logger.debug(`Cleaned up stale presence for user ${userId}`)
      }
    }
  }

  public getUserPresence(userId: string): PresenceData | undefined {
    return this.userPresence.get(userId)
  }

  public getAllPresence(): PresenceData[] {
    return Array.from(this.userPresence.values())
  }
}
