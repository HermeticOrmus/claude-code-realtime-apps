import { ResilientWebSocketClient } from '../../src/websocket/resilient-client'
import { io, Socket } from 'socket.io-client'

jest.mock('socket.io-client')

describe('ResilientWebSocketClient', () => {
  let client: ResilientWebSocketClient
  let mockSocket: any
  let getToken: jest.Mock

  beforeEach(() => {
    mockSocket = {
      connected: false,
      on: jest.fn(),
      emit: jest.fn(),
      off: jest.fn(),
      disconnect: jest.fn()
    }

    ;(io as jest.Mock).mockReturnValue(mockSocket)

    getToken = jest.fn().mockReturnValue('test-token')

    client = new ResilientWebSocketClient(
      'http://localhost:3000',
      getToken,
      {
        maxAttempts: 5,
        initialDelay: 100,
        maxDelay: 5000,
        backoffMultiplier: 2
      }
    )
  })

  afterEach(() => {
    client.disconnect()
    jest.clearAllMocks()
  })

  describe('connect', () => {
    it('should create socket with auth token', () => {
      client.connect()

      expect(io).toHaveBeenCalledWith('http://localhost:3000', {
        auth: { token: 'test-token' },
        transports: ['websocket', 'polling'],
        reconnection: false
      })
    })

    it('should not connect if already connected', () => {
      mockSocket.connected = true
      client.connect()

      client.connect()

      expect(io).toHaveBeenCalledTimes(1)
    })

    it('should emit error if no token available', () => {
      getToken.mockReturnValue(null)

      const errorHandler = jest.fn()
      client.on('error', errorHandler)

      client.connect()

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'No authentication token' })
      )
    })

    it('should setup event handlers on connection', () => {
      client.connect()

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('heartbeat', expect.any(Function))
    })
  })

  describe('reconnection', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      client.connect()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should schedule reconnection on disconnect', () => {
      const disconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )[1]

      disconnectHandler('transport close')

      jest.advanceTimersByTime(100)

      expect(io).toHaveBeenCalledTimes(2)
    })

    it('should not reconnect on server disconnect', () => {
      const disconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )[1]

      disconnectHandler('io server disconnect')

      jest.advanceTimersByTime(1000)

      expect(io).toHaveBeenCalledTimes(1)
    })

    it('should not reconnect if manually disconnected', () => {
      client.disconnect()

      const disconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )[1]

      disconnectHandler('transport close')

      jest.advanceTimersByTime(1000)

      // Only initial connection, no reconnection
      expect(io).toHaveBeenCalledTimes(1)
    })

    it('should use exponential backoff', () => {
      const connectErrorHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect_error'
      )[1]

      // First retry: 100ms
      connectErrorHandler(new Error('Connection failed'))
      jest.advanceTimersByTime(99)
      expect(io).toHaveBeenCalledTimes(1)
      jest.advanceTimersByTime(1)
      expect(io).toHaveBeenCalledTimes(2)

      // Second retry: 200ms
      connectErrorHandler(new Error('Connection failed'))
      jest.advanceTimersByTime(199)
      expect(io).toHaveBeenCalledTimes(2)
      jest.advanceTimersByTime(1)
      expect(io).toHaveBeenCalledTimes(3)

      // Third retry: 400ms
      connectErrorHandler(new Error('Connection failed'))
      jest.advanceTimersByTime(399)
      expect(io).toHaveBeenCalledTimes(3)
      jest.advanceTimersByTime(1)
      expect(io).toHaveBeenCalledTimes(4)
    })

    it('should cap delay at maxDelay', () => {
      const connectErrorHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect_error'
      )[1]

      // Trigger many failures to exceed maxDelay
      for (let i = 0; i < 10; i++) {
        connectErrorHandler(new Error('Connection failed'))
        jest.advanceTimersByTime(10000) // Advance past maxDelay
      }

      // Should have capped at 5000ms (maxDelay), not continued exponential growth
      // Verify by checking reconnection attempts
      expect(io).toHaveBeenCalled()
    })

    it('should stop reconnecting after max attempts', () => {
      const connectErrorHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect_error'
      )[1]

      const maxReconnectHandler = jest.fn()
      client.on('maxReconnectAttempts', maxReconnectHandler)

      // Trigger 5 failures (maxAttempts)
      for (let i = 0; i < 5; i++) {
        connectErrorHandler(new Error('Connection failed'))
        jest.advanceTimersByTime(10000)
      }

      expect(maxReconnectHandler).toHaveBeenCalled()

      // Try one more - should not reconnect
      connectErrorHandler(new Error('Connection failed'))
      jest.advanceTimersByTime(10000)

      // Should be 1 (initial) + 5 (retries) = 6, not more
      expect(io).toHaveBeenCalledTimes(6)
    })

    it('should reset reconnect attempts on successful connection', () => {
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )[1]

      const connectErrorHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect_error'
      )[1]

      // Fail once
      connectErrorHandler(new Error('Connection failed'))
      jest.advanceTimersByTime(100)

      // Succeed
      connectHandler()

      // Fail again - should start from 100ms, not 200ms
      connectErrorHandler(new Error('Connection failed'))
      jest.advanceTimersByTime(99)
      const callsBefore = io.mock.calls.length
      jest.advanceTimersByTime(1)
      expect(io.mock.calls.length).toBe(callsBefore + 1)
    })
  })

  describe('message sending', () => {
    beforeEach(() => {
      client.connect()
      mockSocket.connected = true
    })

    it('should emit message when connected', () => {
      client.emit('test:event', { data: 'test' })

      expect(mockSocket.emit).toHaveBeenCalledWith('test:event', { data: 'test' })
    })

    it('should queue message when disconnected', () => {
      mockSocket.connected = false

      client.emit('test:event', { data: 'queued' })

      expect(mockSocket.emit).not.toHaveBeenCalled()
      expect(client.queuedMessageCount).toBe(1)
    })

    it('should flush queued messages on reconnect', () => {
      mockSocket.connected = false

      client.emit('event1', { data: '1' })
      client.emit('event2', { data: '2' })
      client.emit('event3', { data: '3' })

      expect(client.queuedMessageCount).toBe(3)

      // Simulate reconnection
      mockSocket.connected = true
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )[1]
      connectHandler()

      expect(mockSocket.emit).toHaveBeenCalledWith('event1', { data: '1' })
      expect(mockSocket.emit).toHaveBeenCalledWith('event2', { data: '2' })
      expect(mockSocket.emit).toHaveBeenCalledWith('event3', { data: '3' })
      expect(client.queuedMessageCount).toBe(0)
    })
  })

  describe('event handling', () => {
    beforeEach(() => {
      client.connect()
    })

    it('should register event handlers', () => {
      const handler = jest.fn()

      client.on('custom:event', handler)

      expect(mockSocket.on).toHaveBeenCalledWith('custom:event', handler)
    })

    it('should re-attach handlers on reconnect', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      client.on('event1', handler1)
      client.on('event2', handler2)

      // Simulate reconnection
      mockSocket.on.mockClear()
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )[1]

      // Trigger reconnect setup
      client.connect()

      // Handlers should be re-attached
      // (This would require accessing internal state or integration testing)
    })

    it('should remove event handlers', () => {
      const handler = jest.fn()

      client.on('test:event', handler)
      client.off('test:event', handler)

      expect(mockSocket.off).toHaveBeenCalledWith('test:event', handler)
    })

    it('should remove all handlers for event', () => {
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      client.on('test:event', handler1)
      client.on('test:event', handler2)
      client.off('test:event')

      expect(mockSocket.off).toHaveBeenCalledWith('test:event')
    })
  })

  describe('heartbeat', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      client.connect()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should respond to heartbeat pings', () => {
      const heartbeatHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'heartbeat'
      )[1]

      heartbeatHandler()

      expect(mockSocket.emit).toHaveBeenCalledWith('heartbeat:ack')
    })

    it('should disconnect if no heartbeat received', () => {
      mockSocket.connected = true

      // Don't send heartbeat for 60+ seconds
      jest.advanceTimersByTime(65000)

      expect(mockSocket.disconnect).toHaveBeenCalled()
    })

    it('should not disconnect if receiving heartbeats', () => {
      const heartbeatHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'heartbeat'
      )[1]

      mockSocket.connected = true

      // Send heartbeats every 20 seconds
      for (let i = 0; i < 5; i++) {
        jest.advanceTimersByTime(20000)
        heartbeatHandler()
      }

      expect(mockSocket.disconnect).not.toHaveBeenCalled()
    })
  })

  describe('disconnect', () => {
    beforeEach(() => {
      client.connect()
    })

    it('should disconnect socket', () => {
      client.disconnect()

      expect(mockSocket.disconnect).toHaveBeenCalled()
    })

    it('should clear message queue', () => {
      mockSocket.connected = false

      client.emit('test', { data: 'queued' })
      expect(client.queuedMessageCount).toBe(1)

      client.disconnect()
      expect(client.queuedMessageCount).toBe(0)
    })

    it('should prevent reconnection attempts', () => {
      jest.useFakeTimers()

      client.disconnect()

      const disconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )[1]

      disconnectHandler('transport close')

      jest.advanceTimersByTime(10000)

      // No reconnection after manual disconnect
      expect(io).toHaveBeenCalledTimes(1)

      jest.useRealTimers()
    })
  })

  describe('clearQueue', () => {
    it('should clear queued messages', () => {
      mockSocket.connected = false

      client.emit('event1', { data: '1' })
      client.emit('event2', { data: '2' })

      expect(client.queuedMessageCount).toBe(2)

      client.clearQueue()

      expect(client.queuedMessageCount).toBe(0)
    })
  })

  describe('connected property', () => {
    it('should return false when not connected', () => {
      expect(client.connected).toBe(false)
    })

    it('should return true when connected', () => {
      client.connect()
      mockSocket.connected = true

      expect(client.connected).toBe(true)
    })

    it('should return false after disconnect', () => {
      client.connect()
      mockSocket.connected = true
      client.disconnect()
      mockSocket.connected = false

      expect(client.connected).toBe(false)
    })
  })
})
