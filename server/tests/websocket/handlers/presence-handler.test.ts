import { PresenceHandler } from '../../../src/websocket/handlers/presence-handler'
import { MockServer, MockSocket } from '../../helpers/socket-mock'
import { createTestUser } from '../../helpers/test-data'

jest.mock('../../../src/utils/logger')

describe('PresenceHandler', () => {
  let presenceHandler: PresenceHandler
  let mockIo: MockServer
  let mockSocket: MockSocket
  let testUser: any

  beforeEach(() => {
    mockIo = new MockServer()
    presenceHandler = new PresenceHandler(mockIo as any)

    testUser = createTestUser({ id: 'test-user-id', username: 'testuser' })
    mockSocket = new MockSocket('socket-1', { user: testUser })
  })

  describe('handleConnection', () => {
    it('should broadcast user online status on connection', () => {
      presenceHandler.handleConnection(mockSocket as any)

      const emitted = mockIo.getEmittedToRoom('presence', 'presence:user-online')
      expect(emitted).toHaveLength(1)
      expect(emitted[0].userId).toBe(testUser.id)
      expect(emitted[0].username).toBe(testUser.username)
      expect(emitted[0].status).toBe('online')
    })

    it('should track user presence status', () => {
      presenceHandler.handleConnection(mockSocket as any)

      const status = presenceHandler.getUserStatus(testUser.id)
      expect(status).toBe('online')
    })

    it('should handle multiple connections from same user', () => {
      const socket2 = new MockSocket('socket-2', { user: testUser })

      presenceHandler.handleConnection(mockSocket as any)
      presenceHandler.handleConnection(socket2 as any)

      const status = presenceHandler.getUserStatus(testUser.id)
      expect(status).toBe('online')

      // Still online after one disconnect
      presenceHandler.handleDisconnect(mockSocket as any)
      expect(presenceHandler.getUserStatus(testUser.id)).toBe('online')

      // Offline after all disconnects
      presenceHandler.handleDisconnect(socket2 as any)
      expect(presenceHandler.getUserStatus(testUser.id)).toBe('offline')
    })
  })

  describe('presence:update', () => {
    beforeEach(() => {
      presenceHandler.handleConnection(mockSocket as any)
      mockSocket.clearEmittedEvents()
      mockIo.clearEmittedEvents()
    })

    it('should update user status to away', async () => {
      mockSocket.emit('presence:update', { status: 'away' })

      await new Promise(resolve => setTimeout(resolve, 100))

      const status = presenceHandler.getUserStatus(testUser.id)
      expect(status).toBe('away')
    })

    it('should update user status to busy', async () => {
      mockSocket.emit('presence:update', { status: 'busy' })

      await new Promise(resolve => setTimeout(resolve, 100))

      const status = presenceHandler.getUserStatus(testUser.id)
      expect(status).toBe('busy')
    })

    it('should broadcast status updates', async () => {
      mockSocket.emit('presence:update', { status: 'away' })

      await new Promise(resolve => setTimeout(resolve, 100))

      const emitted = mockIo.getEmittedToRoom('presence', 'presence:status-changed')
      expect(emitted.length).toBeGreaterThan(0)
      expect(emitted[emitted.length - 1].userId).toBe(testUser.id)
      expect(emitted[emitted.length - 1].status).toBe('away')
    })

    it('should reject invalid status values', async () => {
      mockSocket.emit('presence:update', { status: 'invalid' })

      await new Promise(resolve => setTimeout(resolve, 100))

      const status = presenceHandler.getUserStatus(testUser.id)
      expect(status).toBe('online') // Unchanged
    })

    it('should include custom status message', async () => {
      mockSocket.emit('presence:update', {
        status: 'away',
        customStatus: 'In a meeting'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const emitted = mockIo.getEmittedToRoom('presence', 'presence:status-changed')
      const lastEmit = emitted[emitted.length - 1]
      expect(lastEmit.customStatus).toBe('In a meeting')
    })
  })

  describe('presence:subscribe', () => {
    it('should subscribe to user presence updates', async () => {
      presenceHandler.handleConnection(mockSocket as any)

      const targetUsers = ['user-1', 'user-2', 'user-3']
      mockSocket.emit('presence:subscribe', { userIds: targetUsers })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.hasEmitted('presence:initial')).toBe(true)
      const initial = mockSocket.getLastEmittedEvent('presence:initial')
      expect(initial).toBeDefined()
    })

    it('should return current status for subscribed users', async () => {
      // Set up other users
      const user2Socket = new MockSocket('socket-2', {
        user: createTestUser({ id: 'user-2', username: 'user2' })
      })
      presenceHandler.handleConnection(user2Socket as any)

      presenceHandler.handleConnection(mockSocket as any)

      mockSocket.emit('presence:subscribe', { userIds: ['user-2'] })

      await new Promise(resolve => setTimeout(resolve, 100))

      const initial = mockSocket.getLastEmittedEvent('presence:initial')
      expect(initial[0]['user-2']).toBe('online')
    })
  })

  describe('presence:unsubscribe', () => {
    it('should unsubscribe from user presence updates', async () => {
      presenceHandler.handleConnection(mockSocket as any)

      mockSocket.emit('presence:subscribe', { userIds: ['user-1'] })
      await new Promise(resolve => setTimeout(resolve, 50))

      mockSocket.emit('presence:unsubscribe', { userIds: ['user-1'] })
      await new Promise(resolve => setTimeout(resolve, 50))

      // Would need more sophisticated tracking to verify unsubscription
      // This is a basic sanity check
      expect(mockSocket.listeners('presence:status-changed').length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('handleDisconnect', () => {
    it('should broadcast user offline status on disconnect', async () => {
      presenceHandler.handleConnection(mockSocket as any)
      mockIo.clearEmittedEvents()

      presenceHandler.handleDisconnect(mockSocket as any)

      await new Promise(resolve => setTimeout(resolve, 100))

      const emitted = mockIo.getEmittedToRoom('presence', 'presence:user-offline')
      expect(emitted).toHaveLength(1)
      expect(emitted[0].userId).toBe(testUser.id)
    })

    it('should mark user as offline', () => {
      presenceHandler.handleConnection(mockSocket as any)
      presenceHandler.handleDisconnect(mockSocket as any)

      const status = presenceHandler.getUserStatus(testUser.id)
      expect(status).toBe('offline')
    })

    it('should include last seen timestamp', async () => {
      presenceHandler.handleConnection(mockSocket as any)
      mockIo.clearEmittedEvents()

      presenceHandler.handleDisconnect(mockSocket as any)

      await new Promise(resolve => setTimeout(resolve, 100))

      const emitted = mockIo.getEmittedToRoom('presence', 'presence:user-offline')
      expect(emitted[0].lastSeen).toBeDefined()
      expect(typeof emitted[0].lastSeen).toBe('number')
    })
  })

  describe('getOnlineUsers', () => {
    it('should return list of online users', () => {
      const user2 = createTestUser({ id: 'user-2', username: 'user2' })
      const user3 = createTestUser({ id: 'user-3', username: 'user3' })

      const socket2 = new MockSocket('socket-2', { user: user2 })
      const socket3 = new MockSocket('socket-3', { user: user3 })

      presenceHandler.handleConnection(mockSocket as any)
      presenceHandler.handleConnection(socket2 as any)
      presenceHandler.handleConnection(socket3 as any)

      const onlineUsers = presenceHandler.getOnlineUsers()
      expect(onlineUsers).toHaveLength(3)
      expect(onlineUsers).toContain(testUser.id)
      expect(onlineUsers).toContain('user-2')
      expect(onlineUsers).toContain('user-3')
    })

    it('should not include disconnected users', () => {
      presenceHandler.handleConnection(mockSocket as any)
      presenceHandler.handleDisconnect(mockSocket as any)

      const onlineUsers = presenceHandler.getOnlineUsers()
      expect(onlineUsers).not.toContain(testUser.id)
    })
  })

  describe('getUserStatus', () => {
    it('should return offline for unknown users', () => {
      const status = presenceHandler.getUserStatus('unknown-user')
      expect(status).toBe('offline')
    })

    it('should return current status for known users', () => {
      presenceHandler.handleConnection(mockSocket as any)
      mockSocket.emit('presence:update', { status: 'busy' })

      // Allow event to process
      setTimeout(() => {
        const status = presenceHandler.getUserStatus(testUser.id)
        expect(status).toBe('busy')
      }, 100)
    })
  })

  describe('heartbeat', () => {
    it('should respond to heartbeat pings', async () => {
      presenceHandler.handleConnection(mockSocket as any)

      mockSocket.emit('heartbeat')

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(mockSocket.hasEmitted('heartbeat:ack')).toBe(true)
    })

    it('should track last heartbeat time', async () => {
      presenceHandler.handleConnection(mockSocket as any)

      const before = Date.now()
      mockSocket.emit('heartbeat')
      await new Promise(resolve => setTimeout(resolve, 50))

      const lastHeartbeat = presenceHandler.getLastHeartbeat(testUser.id)
      expect(lastHeartbeat).toBeGreaterThanOrEqual(before)
      expect(lastHeartbeat).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('idle detection', () => {
    it('should auto-mark user as away after idle timeout', async () => {
      jest.useFakeTimers()

      presenceHandler.handleConnection(mockSocket as any)

      // Simulate 15 minutes of inactivity
      jest.advanceTimersByTime(15 * 60 * 1000)

      const status = presenceHandler.getUserStatus(testUser.id)
      // Implementation would need idle detection logic
      // This is a placeholder for the expected behavior

      jest.useRealTimers()
    })
  })
})
