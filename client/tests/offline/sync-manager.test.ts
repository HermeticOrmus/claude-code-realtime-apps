import { SyncManager } from '../../src/offline/sync-manager'
import { ResilientWebSocketClient } from '../../src/websocket/resilient-client'
import { db } from '../../src/offline/database'

jest.mock('../../src/websocket/resilient-client')
jest.mock('../../src/offline/database')

describe('SyncManager', () => {
  let syncManager: SyncManager
  let mockClient: jest.Mocked<ResilientWebSocketClient>
  let mockDb: any

  beforeEach(() => {
    mockClient = {
      on: jest.fn(),
      emit: jest.fn(),
      connected: true,
      off: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      connected: true,
      queuedMessageCount: 0,
      clearQueue: jest.fn()
    } as any

    mockDb = {
      addPendingMessage: jest.fn().mockResolvedValue(undefined),
      getPendingMessages: jest.fn().mockResolvedValue([]),
      updateMessageStatus: jest.fn().mockResolvedValue(undefined),
      incrementRetryCount: jest.fn().mockResolvedValue(undefined),
      getFailedMessages: jest.fn().mockResolvedValue([]),
      cacheMessage: jest.fn().mockResolvedValue(undefined),
      getCachedMessages: jest.fn().mockResolvedValue([]),
      cleanup: jest.fn().mockResolvedValue(undefined),
      pendingMessages: {
        where: jest.fn().mockReturnValue({
          equals: jest.fn().mockReturnValue({
            modify: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined)
          })
        })
      }
    }

    ;(db as any) = mockDb

    syncManager = new SyncManager(mockClient, {
      maxRetries: 3,
      retryDelay: 100,
      syncInterval: 1000
    })
  })

  afterEach(() => {
    syncManager.destroy()
    jest.clearAllMocks()
  })

  describe('initialization', () => {
    it('should setup event handlers on client', () => {
      expect(mockClient.on).toHaveBeenCalledWith('connect', expect.any(Function))
      expect(mockClient.on).toHaveBeenCalledWith('reconnected', expect.any(Function))
      expect(mockClient.on).toHaveBeenCalledWith('message:confirmed', expect.any(Function))
      expect(mockClient.on).toHaveBeenCalledWith('message:failed', expect.any(Function))
      expect(mockClient.on).toHaveBeenCalledWith('message:new', expect.any(Function))
    })

    it('should start periodic sync', () => {
      jest.useFakeTimers()

      const newSyncManager = new SyncManager(mockClient, {
        maxRetries: 3,
        retryDelay: 100,
        syncInterval: 5000
      })

      jest.advanceTimersByTime(5000)

      // Should trigger sync after interval
      expect(mockDb.getPendingMessages).toHaveBeenCalled()

      newSyncManager.destroy()
      jest.useRealTimers()
    })
  })

  describe('sendMessage', () => {
    it('should store message locally first', async () => {
      const messageId = await syncManager.sendMessage('room-1', 'Test message')

      expect(messageId).toMatch(/^msg-/)
      expect(mockDb.addPendingMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId,
          roomId: 'room-1',
          text: 'Test message',
          status: 'pending',
          retryCount: 0
        })
      )
    })

    it('should emit message if client is connected', async () => {
      mockClient.connected = true

      const messageId = await syncManager.sendMessage('room-1', 'Test message')

      expect(mockClient.emit).toHaveBeenCalledWith('message:send', {
        messageId,
        roomId: 'room-1',
        text: 'Test message'
      })
    })

    it('should only store locally if client is disconnected', async () => {
      mockClient.connected = false

      await syncManager.sendMessage('room-1', 'Test message')

      expect(mockDb.addPendingMessage).toHaveBeenCalled()
      expect(mockClient.emit).not.toHaveBeenCalled()
    })

    it('should return unique message IDs', async () => {
      const id1 = await syncManager.sendMessage('room-1', 'Message 1')
      const id2 = await syncManager.sendMessage('room-1', 'Message 2')
      const id3 = await syncManager.sendMessage('room-1', 'Message 3')

      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(id1).not.toBe(id3)
    })
  })

  describe('syncPendingMessages', () => {
    it('should sync all pending messages', async () => {
      const pendingMessages = [
        {
          messageId: 'msg-1',
          roomId: 'room-1',
          text: 'Message 1',
          timestamp: Date.now(),
          status: 'pending',
          retryCount: 0
        },
        {
          messageId: 'msg-2',
          roomId: 'room-1',
          text: 'Message 2',
          timestamp: Date.now(),
          status: 'pending',
          retryCount: 0
        }
      ]

      mockDb.getPendingMessages.mockResolvedValue(pendingMessages)

      await syncManager.syncPendingMessages()

      expect(mockClient.emit).toHaveBeenCalledTimes(2)
      expect(mockClient.emit).toHaveBeenCalledWith('message:send', {
        messageId: 'msg-1',
        roomId: 'room-1',
        text: 'Message 1'
      })
      expect(mockClient.emit).toHaveBeenCalledWith('message:send', {
        messageId: 'msg-2',
        roomId: 'room-1',
        text: 'Message 2'
      })
    })

    it('should not sync if client is disconnected', async () => {
      mockClient.connected = false

      await syncManager.syncPendingMessages()

      expect(mockDb.getPendingMessages).not.toHaveBeenCalled()
    })

    it('should increment retry count for each attempt', async () => {
      const pendingMessages = [
        {
          messageId: 'msg-1',
          roomId: 'room-1',
          text: 'Message 1',
          timestamp: Date.now(),
          status: 'pending',
          retryCount: 0
        }
      ]

      mockDb.getPendingMessages.mockResolvedValue(pendingMessages)

      await syncManager.syncPendingMessages()

      expect(mockDb.incrementRetryCount).toHaveBeenCalledWith('msg-1')
    })

    it('should mark message as failed after max retries', async () => {
      const pendingMessages = [
        {
          messageId: 'msg-1',
          roomId: 'room-1',
          text: 'Message 1',
          timestamp: Date.now(),
          status: 'pending',
          retryCount: 3 // At max retries
        }
      ]

      mockDb.getPendingMessages.mockResolvedValue(pendingMessages)

      await syncManager.syncPendingMessages()

      expect(mockDb.updateMessageStatus).toHaveBeenCalledWith(
        'msg-1',
        'failed',
        'Max retries exceeded'
      )
      expect(mockClient.emit).not.toHaveBeenCalled()
    })

    it('should not start concurrent syncs', async () => {
      mockDb.getPendingMessages.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve([]), 100)
      }))

      const sync1 = syncManager.syncPendingMessages()
      const sync2 = syncManager.syncPendingMessages()

      await Promise.all([sync1, sync2])

      // Should only call once (second call skipped because first was in progress)
      expect(mockDb.getPendingMessages).toHaveBeenCalledTimes(1)
    })

    it('should handle sync errors gracefully', async () => {
      const pendingMessages = [
        {
          messageId: 'msg-1',
          roomId: 'room-1',
          text: 'Message 1',
          timestamp: Date.now(),
          status: 'pending',
          retryCount: 0
        }
      ]

      mockDb.getPendingMessages.mockResolvedValue(pendingMessages)
      mockClient.emit.mockImplementation(() => {
        throw new Error('Network error')
      })

      // Should not throw
      await expect(syncManager.syncPendingMessages()).resolves.not.toThrow()
    })
  })

  describe('message confirmations', () => {
    it('should update message status on confirmation', async () => {
      const connectHandler = mockClient.on.mock.calls.find(
        call => call[0] === 'message:confirmed'
      )?.[1]

      if (connectHandler) {
        await connectHandler({ messageId: 'msg-1' })
      }

      expect(mockDb.updateMessageStatus).toHaveBeenCalledWith('msg-1', 'sent')
    })

    it('should update message status on failure', async () => {
      const failedHandler = mockClient.on.mock.calls.find(
        call => call[0] === 'message:failed'
      )?.[1]

      if (failedHandler) {
        await failedHandler({ messageId: 'msg-1', error: 'Server error' })
      }

      expect(mockDb.updateMessageStatus).toHaveBeenCalledWith(
        'msg-1',
        'failed',
        'Server error'
      )
    })
  })

  describe('message caching', () => {
    it('should cache incoming messages', async () => {
      const messageHandler = mockClient.on.mock.calls.find(
        call => call[0] === 'message:new'
      )?.[1]

      const message = {
        id: 'msg-1',
        roomId: 'room-1',
        userId: 'user-1',
        username: 'testuser',
        text: 'Test message',
        timestamp: Date.now(),
        edited: false,
        reactions: {}
      }

      if (messageHandler) {
        await messageHandler(message)
      }

      expect(mockDb.cacheMessage).toHaveBeenCalledWith(message)
    })
  })

  describe('getPendingCount', () => {
    it('should return pending message count', async () => {
      mockDb.getPendingMessages.mockResolvedValue([{}, {}, {}])

      const count = await syncManager.getPendingCount()

      expect(count).toBe(3)
    })

    it('should return pending count for specific room', async () => {
      mockDb.getPendingMessages.mockResolvedValue([{}, {}])

      const count = await syncManager.getPendingCount('room-1')

      expect(mockDb.getPendingMessages).toHaveBeenCalledWith('room-1')
      expect(count).toBe(2)
    })
  })

  describe('getFailedMessages', () => {
    it('should return failed messages', async () => {
      const failed = [
        { messageId: 'msg-1', status: 'failed', error: 'Network error' },
        { messageId: 'msg-2', status: 'failed', error: 'Timeout' }
      ]

      mockDb.getFailedMessages.mockResolvedValue(failed)

      const result = await syncManager.getFailedMessages()

      expect(result).toEqual(failed)
    })
  })

  describe('retryFailedMessage', () => {
    it('should reset failed message to pending', async () => {
      await syncManager.retryFailedMessage('msg-1')

      expect(mockDb.pendingMessages.where).toHaveBeenCalledWith('messageId')
    })

    it('should trigger sync after retry', async () => {
      mockDb.getPendingMessages.mockResolvedValue([])

      await syncManager.retryFailedMessage('msg-1')

      expect(mockDb.getPendingMessages).toHaveBeenCalled()
    })
  })

  describe('retryAllFailed', () => {
    it('should retry all failed messages', async () => {
      const failed = [
        { messageId: 'msg-1', status: 'failed' },
        { messageId: 'msg-2', status: 'failed' },
        { messageId: 'msg-3', status: 'failed' }
      ]

      mockDb.getFailedMessages.mockResolvedValue(failed)

      await syncManager.retryAllFailed()

      expect(mockDb.pendingMessages.where).toHaveBeenCalledTimes(3)
    })
  })

  describe('clearSentMessages', () => {
    it('should delete sent messages', async () => {
      await syncManager.clearSentMessages()

      expect(mockDb.pendingMessages.where).toHaveBeenCalledWith('status')
    })
  })

  describe('getCachedMessages', () => {
    it('should retrieve cached messages for room', async () => {
      const cached = [
        { id: 'msg-1', text: 'Message 1' },
        { id: 'msg-2', text: 'Message 2' }
      ]

      mockDb.getCachedMessages.mockResolvedValue(cached)

      const result = await syncManager.getCachedMessages('room-1', 50)

      expect(mockDb.getCachedMessages).toHaveBeenCalledWith('room-1', 50)
      expect(result).toEqual(cached)
    })

    it('should use default limit if not specified', async () => {
      mockDb.getCachedMessages.mockResolvedValue([])

      await syncManager.getCachedMessages('room-1')

      expect(mockDb.getCachedMessages).toHaveBeenCalledWith('room-1', 50)
    })
  })

  describe('cleanup', () => {
    it('should call database cleanup', async () => {
      await syncManager.cleanup()

      expect(mockDb.cleanup).toHaveBeenCalled()
    })
  })

  describe('destroy', () => {
    it('should clear sync interval', () => {
      jest.useFakeTimers()

      const newSyncManager = new SyncManager(mockClient, {
        maxRetries: 3,
        retryDelay: 100,
        syncInterval: 5000
      })

      newSyncManager.destroy()

      // Advance time - sync should not be called
      mockDb.getPendingMessages.mockClear()
      jest.advanceTimersByTime(10000)

      expect(mockDb.getPendingMessages).not.toHaveBeenCalled()

      jest.useRealTimers()
    })
  })

  describe('auto-sync on reconnect', () => {
    it('should sync on connect event', async () => {
      const connectHandler = mockClient.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1]

      mockDb.getPendingMessages.mockResolvedValue([])

      if (connectHandler) {
        await connectHandler()
      }

      expect(mockDb.getPendingMessages).toHaveBeenCalled()
    })

    it('should sync on reconnected event', async () => {
      const reconnectedHandler = mockClient.on.mock.calls.find(
        call => call[0] === 'reconnected'
      )?.[1]

      mockDb.getPendingMessages.mockResolvedValue([])

      if (reconnectedHandler) {
        await reconnectedHandler()
      }

      expect(mockDb.getPendingMessages).toHaveBeenCalled()
    })
  })

  describe('periodic sync', () => {
    it('should only sync when online and connected', async () => {
      jest.useFakeTimers()

      // Connected and online
      mockClient.connected = true
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })

      const newSyncManager = new SyncManager(mockClient, {
        maxRetries: 3,
        retryDelay: 100,
        syncInterval: 1000
      })

      mockDb.getPendingMessages.mockResolvedValue([])

      jest.advanceTimersByTime(1000)

      expect(mockDb.getPendingMessages).toHaveBeenCalled()

      // Disconnect
      mockClient.connected = false
      mockDb.getPendingMessages.mockClear()

      jest.advanceTimersByTime(1000)

      expect(mockDb.getPendingMessages).not.toHaveBeenCalled()

      newSyncManager.destroy()
      jest.useRealTimers()
    })
  })
})
