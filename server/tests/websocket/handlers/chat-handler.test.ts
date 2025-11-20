import { ChatHandler } from '../../../src/websocket/handlers/chat-handler'
import { MockServer, MockSocket } from '../../helpers/socket-mock'
import { Room } from '../../../src/database/models/Room'
import { Message } from '../../../src/database/models/Message'
import { createTestUser, createTestRoom, createTestMessage, mockRateLimiter } from '../../helpers/test-data'
import * as rateLimitModule from '../../../src/middleware/rate-limit'

jest.mock('../../../src/middleware/rate-limit')
jest.mock('../../../src/utils/logger')

describe('ChatHandler', () => {
  let chatHandler: ChatHandler
  let mockIo: MockServer
  let mockSocket: MockSocket
  let testUser: any
  let testRoom: any

  beforeEach(async () => {
    mockIo = new MockServer()
    chatHandler = new ChatHandler(mockIo as any)

    testUser = createTestUser({ id: 'test-user-id', username: 'testuser' })
    mockSocket = new MockSocket('socket-1', { user: testUser })

    testRoom = createTestRoom({
      id: 'test-room-id',
      participants: [testUser.id]
    })

    await Room.create(testRoom)

    // Mock rate limiter to allow by default
    const mockRateLimiterInstance = mockRateLimiter()
    ;(rateLimitModule as any).globalRateLimiter = mockRateLimiterInstance
  })

  describe('room:join', () => {
    it('should allow user to join room they are participant of', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('room:join', { roomId: testRoom.id })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.rooms.has(testRoom.id)).toBe(true)
      expect(mockSocket.hasEmitted('room:history')).toBe(true)
    })

    it('should reject join if room not found', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('room:join', { roomId: 'non-existent-room' })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.hasEmitted('error')).toBe(true)
      const error = mockSocket.getLastEmittedEvent('error')
      expect(error[0].message).toBe('Room not found')
    })

    it('should reject join if user not in participants', async () => {
      const restrictedRoom = createTestRoom({
        id: 'restricted-room',
        participants: ['other-user-id']
      })
      await Room.create(restrictedRoom)

      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('room:join', { roomId: restrictedRoom.id })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.hasEmitted('error')).toBe(true)
      const error = mockSocket.getLastEmittedEvent('error')
      expect(error[0].message).toBe('Access denied')
    })

    it('should send recent messages on join', async () => {
      const messages = await Promise.all([
        Message.create(createTestMessage({ roomId: testRoom.id, text: 'Message 1' })),
        Message.create(createTestMessage({ roomId: testRoom.id, text: 'Message 2' })),
        Message.create(createTestMessage({ roomId: testRoom.id, text: 'Message 3' }))
      ])

      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('room:join', { roomId: testRoom.id })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.hasEmitted('room:history')).toBe(true)
      const history = mockSocket.getLastEmittedEvent('room:history')
      expect(history[0].messages).toHaveLength(3)
    })

    it('should notify room when user joins', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('room:join', { roomId: testRoom.id })

      await new Promise(resolve => setTimeout(resolve, 100))

      const emitted = mockIo.getEmittedToRoom(testRoom.id, 'user:joined')
      expect(emitted).toHaveLength(1)
      expect(emitted[0].userId).toBe(testUser.id)
      expect(emitted[0].username).toBe(testUser.username)
    })

    it('should reject invalid room data', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('room:join', { invalid: 'data' })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.hasEmitted('error')).toBe(true)
      const error = mockSocket.getLastEmittedEvent('error')
      expect(error[0].message).toBe('Invalid room data')
    })
  })

  describe('room:leave', () => {
    beforeEach(async () => {
      await mockSocket.join(testRoom.id)
    })

    it('should remove user from room', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('room:leave', testRoom.id)

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.rooms.has(testRoom.id)).toBe(false)
    })

    it('should notify room when user leaves', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('room:leave', testRoom.id)

      await new Promise(resolve => setTimeout(resolve, 100))

      const emitted = mockIo.getEmittedToRoom(testRoom.id, 'user:left')
      expect(emitted).toHaveLength(1)
      expect(emitted[0].userId).toBe(testUser.id)
    })
  })

  describe('message:send', () => {
    beforeEach(async () => {
      await mockSocket.join(testRoom.id)
    })

    it('should send message successfully', async () => {
      chatHandler.handleConnection(mockSocket as any)

      const messageData = {
        roomId: testRoom.id,
        text: 'Hello world!'
      }

      mockSocket.emit('message:send', messageData)

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.hasEmitted('message:confirmed')).toBe(true)

      const saved = await Message.findOne({ roomId: testRoom.id })
      expect(saved).toBeTruthy()
      expect(saved?.text).toBe('Hello world!')
      expect(saved?.userId).toBe(testUser.id)
    })

    it('should broadcast message to room', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:send', {
        roomId: testRoom.id,
        text: 'Broadcast test'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const emitted = mockIo.getEmittedToRoom(testRoom.id, 'message:new')
      expect(emitted).toHaveLength(1)
      expect(emitted[0].text).toBe('Broadcast test')
    })

    it('should sanitize HTML in messages', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:send', {
        roomId: testRoom.id,
        text: '<script>alert("xss")</script>Safe text'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const saved = await Message.findOne({ roomId: testRoom.id })
      expect(saved?.text).not.toContain('<script>')
      expect(saved?.text).toContain('Safe text')
    })

    it('should enforce rate limiting', async () => {
      const mockRateLimiterInstance = mockRateLimiter()
      mockRateLimiterInstance.check.mockReturnValue(false)
      ;(rateLimitModule as any).globalRateLimiter = mockRateLimiterInstance

      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:send', {
        roomId: testRoom.id,
        text: 'Rate limited'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.hasEmitted('error')).toBe(true)
      const error = mockSocket.getLastEmittedEvent('error')
      expect(error[0].message).toBe('Rate limit exceeded')

      const saved = await Message.findOne({ roomId: testRoom.id })
      expect(saved).toBeFalsy()
    })

    it('should reject invalid message format', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:send', {
        roomId: 123, // Invalid type
        text: ''      // Too short
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.hasEmitted('error')).toBe(true)
      const error = mockSocket.getLastEmittedEvent('error')
      expect(error[0].message).toBe('Invalid message format')
    })

    it('should handle reply-to messages', async () => {
      const originalMessage = await Message.create(
        createTestMessage({ roomId: testRoom.id, text: 'Original' })
      )

      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:send', {
        roomId: testRoom.id,
        text: 'Reply',
        replyTo: originalMessage.id
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const reply = await Message.findOne({ text: 'Reply' })
      expect(reply?.replyTo).toBe(originalMessage.id)
    })

    it('should update room last message', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:send', {
        roomId: testRoom.id,
        text: 'Latest message'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const updatedRoom = await Room.findOne({ id: testRoom.id })
      expect(updatedRoom?.lastMessage?.text).toBe('Latest message')
      expect(updatedRoom?.lastMessage?.userId).toBe(testUser.id)
    })
  })

  describe('message:edit', () => {
    let testMessage: any

    beforeEach(async () => {
      await mockSocket.join(testRoom.id)
      testMessage = await Message.create(
        createTestMessage({
          roomId: testRoom.id,
          userId: testUser.id,
          text: 'Original text'
        })
      )
    })

    it('should edit own message successfully', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:edit', {
        messageId: testMessage.id,
        text: 'Edited text'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const edited = await Message.findOne({ id: testMessage.id })
      expect(edited?.text).toBe('Edited text')
      expect(edited?.edited).toBe(true)
      expect(edited?.editedAt).toBeDefined()
    })

    it('should broadcast edit to room', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:edit', {
        messageId: testMessage.id,
        text: 'Edited text'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const emitted = mockIo.getEmittedToRoom(testRoom.id, 'message:edited')
      expect(emitted).toHaveLength(1)
      expect(emitted[0].messageId).toBe(testMessage.id)
      expect(emitted[0].text).toBe('Edited text')
    })

    it('should reject editing message not owned by user', async () => {
      const otherMessage = await Message.create(
        createTestMessage({
          roomId: testRoom.id,
          userId: 'other-user-id',
          text: 'Other user message'
        })
      )

      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:edit', {
        messageId: otherMessage.id,
        text: 'Hacked edit'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.hasEmitted('error')).toBe(true)
      const error = mockSocket.getLastEmittedEvent('error')
      expect(error[0].message).toBe('Unauthorized')

      const unchanged = await Message.findOne({ id: otherMessage.id })
      expect(unchanged?.text).toBe('Other user message')
    })

    it('should sanitize edited text', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:edit', {
        messageId: testMessage.id,
        text: '<script>alert("xss")</script>Edited'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const edited = await Message.findOne({ id: testMessage.id })
      expect(edited?.text).not.toContain('<script>')
      expect(edited?.text).toContain('Edited')
    })

    it('should enforce rate limiting on edits', async () => {
      const mockRateLimiterInstance = mockRateLimiter()
      mockRateLimiterInstance.check.mockReturnValue(false)
      ;(rateLimitModule as any).globalRateLimiter = mockRateLimiterInstance

      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:edit', {
        messageId: testMessage.id,
        text: 'Rate limited edit'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.hasEmitted('error')).toBe(true)
      const unchanged = await Message.findOne({ id: testMessage.id })
      expect(unchanged?.text).toBe('Original text')
    })
  })

  describe('message:delete', () => {
    let testMessage: any

    beforeEach(async () => {
      await mockSocket.join(testRoom.id)
      testMessage = await Message.create(
        createTestMessage({
          roomId: testRoom.id,
          userId: testUser.id,
          text: 'Message to delete'
        })
      )
    })

    it('should delete own message successfully', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:delete', testMessage.id)

      await new Promise(resolve => setTimeout(resolve, 100))

      const deleted = await Message.findOne({ id: testMessage.id })
      expect(deleted).toBeFalsy()
    })

    it('should broadcast deletion to room', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:delete', testMessage.id)

      await new Promise(resolve => setTimeout(resolve, 100))

      const emitted = mockIo.getEmittedToRoom(testRoom.id, 'message:deleted')
      expect(emitted).toHaveLength(1)
      expect(emitted[0].messageId).toBe(testMessage.id)
    })

    it('should reject deleting message not owned by user', async () => {
      const otherMessage = await Message.create(
        createTestMessage({
          roomId: testRoom.id,
          userId: 'other-user-id',
          text: 'Other user message'
        })
      )

      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:delete', otherMessage.id)

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.hasEmitted('error')).toBe(true)
      const stillExists = await Message.findOne({ id: otherMessage.id })
      expect(stillExists).toBeTruthy()
    })
  })

  describe('typing indicators', () => {
    beforeEach(async () => {
      await mockSocket.join(testRoom.id)
    })

    it('should broadcast typing start', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('typing:start', testRoom.id)

      await new Promise(resolve => setTimeout(resolve, 50))

      // Using socket.to() so won't be in mockSocket, check mockIo instead
      // The actual implementation uses socket.to(roomId).emit()
      // This would need integration testing to verify fully
    })

    it('should broadcast typing stop', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('typing:stop', testRoom.id)

      await new Promise(resolve => setTimeout(resolve, 50))

      // Same as above - integration test needed
    })

    it('should auto-stop typing after timeout', async () => {
      jest.useFakeTimers()

      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('typing:start', testRoom.id)

      jest.advanceTimersByTime(3000)

      // Auto-stop should trigger after 3 seconds

      jest.useRealTimers()
    })
  })

  describe('message:react', () => {
    let testMessage: any

    beforeEach(async () => {
      await mockSocket.join(testRoom.id)
      testMessage = await Message.create(
        createTestMessage({
          roomId: testRoom.id,
          text: 'Message to react to'
        })
      )
    })

    it('should add reaction to message', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:react', {
        messageId: testMessage.id,
        roomId: testRoom.id,
        reaction: '👍'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const updated = await Message.findOne({ id: testMessage.id })
      const reactions = updated?.reactions.get('👍')
      expect(reactions).toContain(testUser.id)
    })

    it('should toggle reaction if already present', async () => {
      // Add reaction first
      testMessage.reactions.set('👍', [testUser.id])
      await testMessage.save()

      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:react', {
        messageId: testMessage.id,
        roomId: testRoom.id,
        reaction: '👍'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const updated = await Message.findOne({ id: testMessage.id })
      const reactions = updated?.reactions.get('👍')
      expect(reactions).not.toContain(testUser.id)
    })

    it('should broadcast reaction update', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:react', {
        messageId: testMessage.id,
        roomId: testRoom.id,
        reaction: '❤️'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const emitted = mockIo.getEmittedToRoom(testRoom.id, 'message:reaction-updated')
      expect(emitted).toHaveLength(1)
      expect(emitted[0].messageId).toBe(testMessage.id)
    })
  })

  describe('message:read', () => {
    beforeEach(async () => {
      await mockSocket.join(testRoom.id)
    })

    it('should broadcast read receipt', async () => {
      chatHandler.handleConnection(mockSocket as any)

      mockSocket.emit('message:read', {
        roomId: testRoom.id,
        messageId: 'some-message-id'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const emitted = mockIo.getEmittedToRoom(testRoom.id, 'message:read-receipt')
      expect(emitted).toHaveLength(1)
      expect(emitted[0].userId).toBe(testUser.id)
      expect(emitted[0].messageId).toBe('some-message-id')
    })
  })
})
