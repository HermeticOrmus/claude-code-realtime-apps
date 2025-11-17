import { Server, Socket } from 'socket.io'
import { rtcSignalSchema } from '@realtime-apps/shared'
import { logger } from '../../utils/logger'
import { globalRateLimiter } from '../../middleware/rate-limit'

interface RTCSession {
  sessionId: string
  participants: Set<string>
  createdAt: number
}

export class WebRTCHandler {
  private sessions = new Map<string, RTCSession>()

  constructor(private io: Server) {
    // Cleanup old sessions every 5 minutes
    setInterval(() => this.cleanupOldSessions(), 5 * 60 * 1000)
  }

  handleConnection(socket: Socket): void {
    const userId = socket.data.user.id
    const username = socket.data.user.username

    // Join a WebRTC session (room)
    socket.on('webrtc:join-session', (sessionId: string) => {
      try {
        socket.join(`webrtc:${sessionId}`)

        // Track session
        if (!this.sessions.has(sessionId)) {
          this.sessions.set(sessionId, {
            sessionId,
            participants: new Set(),
            createdAt: Date.now()
          })
        }

        const session = this.sessions.get(sessionId)!
        session.participants.add(userId)

        // Notify others in the session
        socket.to(`webrtc:${sessionId}`).emit('webrtc:user-joined', {
          userId,
          username,
          sessionId
        })

        // Send current participants to the new user
        const participants = Array.from(session.participants)
          .filter(id => id !== userId)

        socket.emit('webrtc:session-participants', {
          sessionId,
          participants
        })

        logger.info(`User ${username} joined WebRTC session ${sessionId}`)
      } catch (error) {
        logger.error('Error joining WebRTC session:', error)
        socket.emit('error', { message: 'Failed to join session' })
      }
    })

    // Leave a WebRTC session
    socket.on('webrtc:leave-session', (sessionId: string) => {
      this.leaveSession(socket, sessionId)
    })

    // Send offer
    socket.on('webrtc:offer', (data: unknown) => {
      try {
        if (!globalRateLimiter.check(userId, 'webrtc:signal')) return

        const result = rtcSignalSchema.safeParse(data)
        if (!result.success) {
          socket.emit('error', { message: 'Invalid WebRTC signal' })
          return
        }

        const { toUserId, sessionId, data: offerData } = result.data

        // Forward offer to target user
        this.io.to(`webrtc:${sessionId}`).emit('webrtc:offer', {
          fromUserId: userId,
          fromUsername: username,
          toUserId,
          sessionId,
          data: offerData
        })

        logger.debug(`WebRTC offer from ${userId} to ${toUserId}`)
      } catch (error) {
        logger.error('Error handling WebRTC offer:', error)
      }
    })

    // Send answer
    socket.on('webrtc:answer', (data: unknown) => {
      try {
        if (!globalRateLimiter.check(userId, 'webrtc:signal')) return

        const result = rtcSignalSchema.safeParse(data)
        if (!result.success) {
          socket.emit('error', { message: 'Invalid WebRTC signal' })
          return
        }

        const { toUserId, sessionId, data: answerData } = result.data

        // Forward answer to target user
        this.io.to(`webrtc:${sessionId}`).emit('webrtc:answer', {
          fromUserId: userId,
          fromUsername: username,
          toUserId,
          sessionId,
          data: answerData
        })

        logger.debug(`WebRTC answer from ${userId} to ${toUserId}`)
      } catch (error) {
        logger.error('Error handling WebRTC answer:', error)
      }
    })

    // Send ICE candidate
    socket.on('webrtc:ice-candidate', (data: unknown) => {
      try {
        if (!globalRateLimiter.check(userId, 'webrtc:signal')) return

        const result = rtcSignalSchema.safeParse(data)
        if (!result.success) {
          return
        }

        const { toUserId, sessionId, data: candidateData } = result.data

        // Forward ICE candidate to target user
        this.io.to(`webrtc:${sessionId}`).emit('webrtc:ice-candidate', {
          fromUserId: userId,
          toUserId,
          sessionId,
          data: candidateData
        })
      } catch (error) {
        logger.error('Error handling ICE candidate:', error)
      }
    })

    // Mute/unmute audio
    socket.on('webrtc:audio-toggle', (data: { sessionId: string; muted: boolean }) => {
      const { sessionId, muted } = data

      socket.to(`webrtc:${sessionId}`).emit('webrtc:user-audio-toggle', {
        userId,
        username,
        muted
      })
    })

    // Enable/disable video
    socket.on('webrtc:video-toggle', (data: { sessionId: string; enabled: boolean }) => {
      const { sessionId, enabled } = data

      socket.to(`webrtc:${sessionId}`).emit('webrtc:user-video-toggle', {
        userId,
        username,
        enabled
      })
    })

    // Screen sharing
    socket.on('webrtc:screen-share-start', (sessionId: string) => {
      socket.to(`webrtc:${sessionId}`).emit('webrtc:user-screen-share-start', {
        userId,
        username
      })
    })

    socket.on('webrtc:screen-share-stop', (sessionId: string) => {
      socket.to(`webrtc:${sessionId}`).emit('webrtc:user-screen-share-stop', {
        userId
      })
    })
  }

  handleDisconnect(socket: Socket): void {
    const userId = socket.data.user.id

    // Remove user from all sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.participants.has(userId)) {
        session.participants.delete(userId)

        // Notify others
        this.io.to(`webrtc:${sessionId}`).emit('webrtc:user-left', {
          userId,
          sessionId
        })

        // Remove session if empty
        if (session.participants.size === 0) {
          this.sessions.delete(sessionId)
        }
      }
    }
  }

  private leaveSession(socket: Socket, sessionId: string): void {
    const userId = socket.data.user.id

    socket.leave(`webrtc:${sessionId}`)

    const session = this.sessions.get(sessionId)
    if (session) {
      session.participants.delete(userId)

      // Notify others
      socket.to(`webrtc:${sessionId}`).emit('webrtc:user-left', {
        userId,
        sessionId
      })

      // Remove session if empty
      if (session.participants.size === 0) {
        this.sessions.delete(sessionId)
      }
    }

    logger.info(`User ${userId} left WebRTC session ${sessionId}`)
  }

  private cleanupOldSessions(): void {
    const now = Date.now()
    const maxAge = 2 * 60 * 60 * 1000 // 2 hours

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.createdAt > maxAge && session.participants.size === 0) {
        this.sessions.delete(sessionId)
        logger.debug(`Cleaned up old WebRTC session ${sessionId}`)
      }
    }
  }
}
