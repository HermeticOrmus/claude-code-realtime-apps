import { Server, Socket } from 'socket.io'
import { cursorPositionSchema } from '@realtime-apps/shared'
import { logger } from '../../utils/logger'
import { globalRateLimiter } from '../../middleware/rate-limit'

interface CursorData {
  userId: string
  username: string
  x: number
  y: number
  page?: string
  timestamp: number
  color: string
}

export class CursorHandler {
  private cursors = new Map<string, CursorData>()
  private throttleDelay = 50 // 20 updates per second max

  constructor(private io: Server) {
    // Cleanup stale cursors every 10 seconds
    setInterval(() => this.cleanupStaleCursors(), 10000)
  }

  handleConnection(socket: Socket): void {
    const userId = socket.data.user.id
    const username = socket.data.user.username

    // Generate a color for this user's cursor
    const color = this.generateColorFromUserId(userId)

    // Subscribe to cursor updates for a page/room
    socket.on('cursor:subscribe', (pageId: string) => {
      socket.join(`cursors:${pageId}`)

      // Send all current cursors for this page
      const pageCursors = Array.from(this.cursors.values())
        .filter(c => c.page === pageId && c.userId !== userId)

      socket.emit('cursor:list', pageCursors)

      logger.debug(`User ${username} subscribed to cursors for page ${pageId}`)
    })

    // Unsubscribe from cursor updates
    socket.on('cursor:unsubscribe', (pageId: string) => {
      socket.leave(`cursors:${pageId}`)

      // Remove cursor from tracking
      const cursorKey = `${userId}-${pageId}`
      this.cursors.delete(cursorKey)

      // Broadcast cursor removal
      socket.to(`cursors:${pageId}`).emit('cursor:removed', {
        userId,
        page: pageId
      })

      logger.debug(`User ${username} unsubscribed from cursors for page ${pageId}`)
    })

    // Update cursor position (throttled)
    let lastCursorUpdate = 0

    socket.on('cursor:move', (data: unknown) => {
      try {
        // Throttle updates
        const now = Date.now()
        if (now - lastCursorUpdate < this.throttleDelay) {
          return
        }
        lastCursorUpdate = now

        // Rate limit check
        if (!globalRateLimiter.check(userId, 'cursor:move')) return

        const result = cursorPositionSchema.safeParse(data)
        if (!result.success) {
          return
        }

        const { x, y, page } = result.data
        const pageId = page || 'default'

        const cursorData: CursorData = {
          userId,
          username,
          x,
          y,
          page: pageId,
          timestamp: now,
          color
        }

        // Update cursor in map
        const cursorKey = `${userId}-${pageId}`
        this.cursors.set(cursorKey, cursorData)

        // Broadcast to others on the same page
        socket.to(`cursors:${pageId}`).emit('cursor:moved', cursorData)
      } catch (error) {
        logger.error('Error updating cursor position:', error)
      }
    })

    // Hide cursor (mouse leave)
    socket.on('cursor:hide', (pageId?: string) => {
      const page = pageId || 'default'
      const cursorKey = `${userId}-${page}`
      this.cursors.delete(cursorKey)

      socket.to(`cursors:${page}`).emit('cursor:hidden', {
        userId,
        page
      })
    })

    // Show cursor (mouse enter)
    socket.on('cursor:show', (pageId?: string) => {
      const page = pageId || 'default'

      socket.to(`cursors:${page}`).emit('cursor:shown', {
        userId,
        username,
        color,
        page
      })
    })
  }

  handleDisconnect(socket: Socket): void {
    const userId = socket.data.user.id

    // Remove all cursors for this user
    const cursorsToRemove: string[] = []

    for (const [key, cursor] of this.cursors.entries()) {
      if (cursor.userId === userId) {
        cursorsToRemove.push(key)

        // Broadcast cursor removal
        if (cursor.page) {
          this.io.to(`cursors:${cursor.page}`).emit('cursor:removed', {
            userId,
            page: cursor.page
          })
        }
      }
    }

    cursorsToRemove.forEach(key => this.cursors.delete(key))
  }

  private cleanupStaleCursors(): void {
    const now = Date.now()
    const staleThreshold = 10000 // 10 seconds

    for (const [key, cursor] of this.cursors.entries()) {
      if (now - cursor.timestamp > staleThreshold) {
        this.cursors.delete(key)

        if (cursor.page) {
          this.io.to(`cursors:${cursor.page}`).emit('cursor:removed', {
            userId: cursor.userId,
            page: cursor.page
          })
        }

        logger.debug(`Cleaned up stale cursor for user ${cursor.userId}`)
      }
    }
  }

  private generateColorFromUserId(userId: string): string {
    // Simple hash function
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash)
    }

    // Convert to hue (0-360)
    const hue = Math.abs(hash) % 360

    return `hsl(${hue}, 70%, 60%)`
  }
}
