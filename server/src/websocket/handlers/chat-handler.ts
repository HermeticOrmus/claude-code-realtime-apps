import { Server, Socket } from 'socket.io'
import { Message } from '../../database/models/Message'
import { Room } from '../../database/models/Room'
import { chatMessageSchema, joinRoomSchema } from '@realtime-apps/shared'
import { logger } from '../../utils/logger'
import { globalRateLimiter } from '../../middleware/rate-limit'
import { isValidEmoji } from '../../security/emoji-validator'
import { InputValidator } from '../../security/input-validator'
import sanitizeHtml from 'sanitize-html'
import { v4 as uuidv4 } from 'uuid'

export class ChatHandler {
  constructor(private io: Server) {}

  handleConnection(socket: Socket): void {
    const userId = socket.data.user.id
    const username = socket.data.user.username

    // Join room
    socket.on('room:join', async (data: unknown) => {
      try {
        // Rate limit check
        if (!globalRateLimiter.check(userId, 'room:join')) {
          socket.emit('error', { message: 'Rate limit exceeded. Too many room join attempts.' })
          logger.warn(`Rate limit exceeded for room:join by user ${userId}`)
          return
        }

        const result = joinRoomSchema.safeParse(data)
        if (!result.success) {
          socket.emit('error', { message: 'Invalid room data' })
          return
        }

        const { roomId } = result.data

        // Validate room ID format
        const roomIdValidation = InputValidator.validateRoomId(roomId)
        if (!roomIdValidation.isValid) {
          socket.emit('error', { message: roomIdValidation.error })
          return
        }

        // Check if room exists and user has access
        const room = await Room.findOne({ id: roomId })
        if (!room) {
          socket.emit('error', { message: 'Room not found' })
          return
        }

        if (!room.participants.includes(userId)) {
          socket.emit('error', { message: 'Access denied' })
          return
        }

        // Join Socket.io room
        await socket.join(roomId)

        // Notify room
        this.io.to(roomId).emit('user:joined', {
          userId,
          username,
          roomId,
          timestamp: Date.now()
        })

        // Send recent messages
        const recentMessages = await Message.find({ roomId })
          .sort({ timestamp: -1 })
          .limit(50)
          .lean()

        socket.emit('room:history', {
          roomId,
          messages: recentMessages.reverse()
        })

        logger.info(`User ${username} joined room ${roomId}`)
      } catch (error) {
        logger.error('Error joining room:', error)
        socket.emit('error', { message: 'Failed to join room' })
      }
    })

    // Leave room
    socket.on('room:leave', async (roomId: string) => {
      try {
        await socket.leave(roomId)

        this.io.to(roomId).emit('user:left', {
          userId,
          username,
          roomId,
          timestamp: Date.now()
        })

        logger.info(`User ${username} left room ${roomId}`)
      } catch (error) {
        logger.error('Error leaving room:', error)
      }
    })

    // Send message
    socket.on('message:send', async (data: unknown) => {
      try {
        // Rate limit check
        if (!globalRateLimiter.check(userId, 'message:send')) {
          socket.emit('error', { message: 'Rate limit exceeded' })
          return
        }

        // Validate message
        const result = chatMessageSchema.safeParse(data)
        if (!result.success) {
          socket.emit('error', { message: 'Invalid message format' })
          return
        }

        const { roomId, text, replyTo, attachments } = result.data

        // Sanitize content
        const sanitizedText = sanitizeHtml(text, {
          allowedTags: [],
          allowedAttributes: {}
        })

        // Create message
        const messageId = `msg-${uuidv4()}`
        const message = {
          id: messageId,
          roomId,
          userId,
          username,
          text: sanitizedText,
          timestamp: Date.now(),
          edited: false,
          reactions: new Map(),
          replyTo,
          attachments: attachments || []
        }

        // Save to database
        const savedMessage = await Message.create(message)

        // Update room's last message
        await Room.findOneAndUpdate(
          { id: roomId },
          {
            lastMessage: {
              text: sanitizedText,
              userId,
              timestamp: message.timestamp
            },
            updatedAt: message.timestamp
          }
        )

        // Broadcast to room
        this.io.to(roomId).emit('message:new', {
          ...message,
          reactions: Object.fromEntries(message.reactions)
        })

        // Send confirmation to sender
        socket.emit('message:confirmed', { messageId })

        logger.debug(`Message sent by ${username} to room ${roomId}`)
      } catch (error) {
        logger.error('Error sending message:', error)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    // Edit message
    socket.on('message:edit', async (data: { messageId: string; text: string }) => {
      try {
        if (!globalRateLimiter.check(userId, 'message:edit')) {
          socket.emit('error', { message: 'Rate limit exceeded' })
          return
        }

        const { messageId, text } = data

        // Find message
        const message = await Message.findOne({ id: messageId })
        if (!message) {
          socket.emit('error', { message: 'Message not found' })
          return
        }

        // Check ownership
        if (message.userId !== userId) {
          socket.emit('error', { message: 'Unauthorized' })
          return
        }

        // Sanitize new text
        const sanitizedText = sanitizeHtml(text, {
          allowedTags: [],
          allowedAttributes: {}
        })

        // Update message
        message.text = sanitizedText
        message.edited = true
        message.editedAt = Date.now()
        await message.save()

        // Broadcast update
        this.io.to(message.roomId).emit('message:edited', {
          messageId,
          text: sanitizedText,
          editedAt: message.editedAt
        })

        logger.debug(`Message ${messageId} edited by ${username}`)
      } catch (error) {
        logger.error('Error editing message:', error)
        socket.emit('error', { message: 'Failed to edit message' })
      }
    })

    // Delete message
    socket.on('message:delete', async (messageId: string) => {
      try {
        const message = await Message.findOne({ id: messageId })
        if (!message) {
          socket.emit('error', { message: 'Message not found' })
          return
        }

        // Check ownership
        if (message.userId !== userId) {
          socket.emit('error', { message: 'Unauthorized' })
          return
        }

        // Delete message
        await Message.deleteOne({ id: messageId })

        // Broadcast deletion
        this.io.to(message.roomId).emit('message:deleted', {
          messageId,
          roomId: message.roomId
        })

        logger.debug(`Message ${messageId} deleted by ${username}`)
      } catch (error) {
        logger.error('Error deleting message:', error)
        socket.emit('error', { message: 'Failed to delete message' })
      }
    })

    // Typing indicators
    const typingTimeouts = new Map<string, NodeJS.Timeout>()

    socket.on('typing:start', (roomId: string) => {
      if (!globalRateLimiter.check(userId, 'typing:start')) return

      socket.to(roomId).emit('user:typing', {
        userId,
        username,
        roomId
      })

      // Auto-stop typing after 3 seconds
      const existingTimeout = typingTimeouts.get(roomId)
      if (existingTimeout) clearTimeout(existingTimeout)

      typingTimeouts.set(roomId, setTimeout(() => {
        socket.to(roomId).emit('user:stopped-typing', {
          userId,
          roomId
        })
        typingTimeouts.delete(roomId)
      }, 3000))
    })

    socket.on('typing:stop', (roomId: string) => {
      const timeout = typingTimeouts.get(roomId)
      if (timeout) {
        clearTimeout(timeout)
        typingTimeouts.delete(roomId)
      }

      socket.to(roomId).emit('user:stopped-typing', {
        userId,
        roomId
      })
    })

    // Read receipts
    socket.on('message:read', async (data: { roomId: string; messageId: string }) => {
      try {
        const { roomId, messageId } = data

        this.io.to(roomId).emit('message:read-receipt', {
          userId,
          messageId,
          roomId,
          timestamp: Date.now()
        })
      } catch (error) {
        logger.error('Error sending read receipt:', error)
      }
    })

    // Message reactions
    socket.on('message:react', async (data: { messageId: string; roomId: string; reaction: string }) => {
      try {
        // Rate limit check
        if (!globalRateLimiter.check(userId, 'message:react')) {
          socket.emit('error', { message: 'Rate limit exceeded' })
          return
        }

        const { messageId, roomId, reaction } = data

        // Validate emoji
        if (!isValidEmoji(reaction)) {
          socket.emit('error', { message: 'Invalid reaction. Only valid emojis are allowed.' })
          logger.warn(`Invalid emoji reaction attempted by user ${userId}: ${reaction}`)
          return
        }

        const message = await Message.findOne({ id: messageId })
        if (!message) {
          socket.emit('error', { message: 'Message not found' })
          return
        }

        // Verify user has access to room
        const room = await Room.findOne({ id: roomId })
        if (!room || !room.participants.includes(userId)) {
          socket.emit('error', { message: 'Access denied' })
          return
        }

        // Toggle reaction
        const currentReactions = message.reactions.get(reaction) || []
        if (currentReactions.includes(userId)) {
          // Remove reaction
          message.reactions.set(
            reaction,
            currentReactions.filter(id => id !== userId)
          )
        } else {
          // Add reaction
          message.reactions.set(reaction, [...currentReactions, userId])
        }

        await message.save()

        // Broadcast reaction update
        this.io.to(roomId).emit('message:reaction-updated', {
          messageId,
          reactions: Object.fromEntries(message.reactions)
        })
      } catch (error) {
        logger.error('Error updating reaction:', error)
      }
    })
  }

  handleDisconnect(socket: Socket): void {
    // Cleanup is handled by the main server
  }
}
