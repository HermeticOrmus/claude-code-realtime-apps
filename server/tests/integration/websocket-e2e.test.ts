import { createServer } from 'http'
import { Server as IOServer } from 'socket.io'
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client'
import { ChatHandler } from '../../src/websocket/handlers/chat-handler'
import { PresenceHandler } from '../../src/websocket/handlers/presence-handler'
import { Room } from '../../src/database/models/Room'
import { Message } from '../../src/database/models/Message'
import { createTestUser, createTestRoom } from '../helpers/test-data'

describe('WebSocket End-to-End Integration Tests', () => {
  let httpServer: any
  let io: IOServer
  let chatHandler: ChatHandler
  let presenceHandler: PresenceHandler
  let client1: ClientSocket
  let client2: ClientSocket
  let testRoom: any
  let testUser1: any
  let testUser2: any
  let port: number

  beforeAll((done) => {
    port = 3001
    httpServer = createServer()
    io = new IOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    })

    chatHandler = new ChatHandler(io)
    presenceHandler = new PresenceHandler(io)

    // Setup connection handler
    io.on('connection', (socket) => {
      chatHandler.handleConnection(socket)
      presenceHandler.handleConnection(socket)

      socket.on('disconnect', () => {
        chatHandler.handleDisconnect(socket)
        presenceHandler.handleDisconnect(socket)
      })
    })

    httpServer.listen(port, done)
  })

  afterAll((done) => {
    io.close()
    httpServer.close(done)
  })

  beforeEach(async () => {
    testUser1 = createTestUser({ id: 'user-1', username: 'alice' })
    testUser2 = createTestUser({ id: 'user-2', username: 'bob' })

    testRoom = createTestRoom({
      id: 'test-room',
      participants: [testUser1.id, testUser2.id]
    })

    await Room.create(testRoom)

    // Connect clients
    client1 = ioClient(`http://localhost:${port}`, {
      auth: { token: 'test-token-1' },
      transports: ['websocket']
    })

    client2 = ioClient(`http://localhost:${port}`, {
      auth: { token: 'test-token-2' },
      transports: ['websocket']
    })

    // Wait for connections
    await Promise.all([
      new Promise<void>(resolve => client1.on('connect', () => {
        client1.io.engine.transport.on('upgrade', () => resolve())
        resolve()
      })),
      new Promise<void>(resolve => client2.on('connect', () => {
        client2.io.engine.transport.on('upgrade', () => resolve())
        resolve()
      }))
    ])

    // Set user data (simulating auth middleware)
    ;(client1 as any).data = { user: testUser1 }
    ;(client2 as any).data = { user: testUser2 }
  })

  afterEach(() => {
    client1.disconnect()
    client2.disconnect()
  })

  describe('Chat Flow', () => {
    it('should allow users to join room and receive history', (done) => {
      let historyReceived = false

      client1.on('room:history', (data: any) => {
        expect(data.roomId).toBe(testRoom.id)
        expect(Array.isArray(data.messages)).toBe(true)
        historyReceived = true
        done()
      })

      client1.emit('room:join', { roomId: testRoom.id })
    })

    it('should broadcast messages to all room participants', (done) => {
      let messagesReceived = 0

      const messageHandler = (message: any) => {
        expect(message.roomId).toBe(testRoom.id)
        expect(message.text).toBe('Hello from Alice')
        messagesReceived++

        if (messagesReceived === 2) {
          done()
        }
      }

      client1.on('message:new', messageHandler)
      client2.on('message:new', messageHandler)

      Promise.all([
        new Promise<void>(resolve => client1.emit('room:join', { roomId: testRoom.id }, resolve)),
        new Promise<void>(resolve => client2.emit('room:join', { roomId: testRoom.id }, resolve))
      ]).then(() => {
        client1.emit('message:send', {
          roomId: testRoom.id,
          text: 'Hello from Alice'
        })
      })
    })

    it('should confirm message delivery to sender', (done) => {
      client1.on('message:confirmed', (data: any) => {
        expect(data.messageId).toBeDefined()
        done()
      })

      client1.emit('room:join', { roomId: testRoom.id })

      setTimeout(() => {
        client1.emit('message:send', {
          roomId: testRoom.id,
          text: 'Test message'
        })
      }, 100)
    })

    it('should allow users to edit their own messages', (done) => {
      let messageId: string

      client2.on('message:edited', (data: any) => {
        expect(data.messageId).toBe(messageId)
        expect(data.text).toBe('Updated message')
        done()
      })

      client1.on('message:confirmed', (data: any) => {
        messageId = data.messageId

        client1.emit('message:edit', {
          messageId,
          text: 'Updated message'
        })
      })

      Promise.all([
        new Promise<void>(resolve => client1.emit('room:join', { roomId: testRoom.id }, resolve)),
        new Promise<void>(resolve => client2.emit('room:join', { roomId: testRoom.id }, resolve))
      ]).then(() => {
        client1.emit('message:send', {
          roomId: testRoom.id,
          text: 'Original message'
        })
      })
    })

    it('should broadcast typing indicators', (done) => {
      client2.on('user:typing', (data: any) => {
        expect(data.userId).toBe(testUser1.id)
        expect(data.roomId).toBe(testRoom.id)
        done()
      })

      Promise.all([
        new Promise<void>(resolve => client1.emit('room:join', { roomId: testRoom.id }, resolve)),
        new Promise<void>(resolve => client2.emit('room:join', { roomId: testRoom.id }, resolve))
      ]).then(() => {
        client1.emit('typing:start', testRoom.id)
      })
    })

    it('should handle message reactions', (done) => {
      let messageId: string

      client2.on('message:reaction-updated', (data: any) => {
        expect(data.messageId).toBe(messageId)
        expect(data.reactions['👍']).toContain(testUser2.id)
        done()
      })

      client1.on('message:confirmed', async (data: any) => {
        messageId = data.messageId

        // Give time for message to be saved
        setTimeout(() => {
          client2.emit('message:react', {
            messageId,
            roomId: testRoom.id,
            reaction: '👍'
          })
        }, 100)
      })

      Promise.all([
        new Promise<void>(resolve => client1.emit('room:join', { roomId: testRoom.id }, resolve)),
        new Promise<void>(resolve => client2.emit('room:join', { roomId: testRoom.id }, resolve))
      ]).then(() => {
        client1.emit('message:send', {
          roomId: testRoom.id,
          text: 'React to this'
        })
      })
    }, 10000)
  })

  describe('Presence Flow', () => {
    it('should broadcast user online status on connect', (done) => {
      const newClient = ioClient(`http://localhost:${port}`, {
        auth: { token: 'test-token-3' },
        transports: ['websocket']
      })

      client1.on('presence:user-online', (data: any) => {
        expect(data.userId).toBeDefined()
        expect(data.status).toBe('online')
        newClient.disconnect()
        done()
      })

      newClient.on('connect', () => {
        ;(newClient as any).data = { user: createTestUser({ id: 'user-3' }) }
      })
    })

    it('should broadcast user offline status on disconnect', (done) => {
      const tempClient = ioClient(`http://localhost:${port}`, {
        auth: { token: 'test-token-temp' },
        transports: ['websocket']
      })

      ;(tempClient as any).data = { user: createTestUser({ id: 'temp-user' }) }

      client1.on('presence:user-offline', (data: any) => {
        expect(data.userId).toBe('temp-user')
        expect(data.lastSeen).toBeDefined()
        done()
      })

      tempClient.on('connect', () => {
        setTimeout(() => {
          tempClient.disconnect()
        }, 100)
      })
    })

    it('should allow users to update their status', (done) => {
      client2.on('presence:status-changed', (data: any) => {
        if (data.userId === testUser1.id) {
          expect(data.status).toBe('away')
          done()
        }
      })

      client1.emit('presence:update', { status: 'away' })
    })
  })

  describe('Room Management Flow', () => {
    it('should notify room when user joins', (done) => {
      client2.on('user:joined', (data: any) => {
        expect(data.userId).toBe(testUser1.id)
        expect(data.username).toBe('alice')
        expect(data.roomId).toBe(testRoom.id)
        done()
      })

      client2.emit('room:join', { roomId: testRoom.id })

      setTimeout(() => {
        client1.emit('room:join', { roomId: testRoom.id })
      }, 100)
    })

    it('should notify room when user leaves', (done) => {
      client2.on('user:left', (data: any) => {
        expect(data.userId).toBe(testUser1.id)
        expect(data.roomId).toBe(testRoom.id)
        done()
      })

      Promise.all([
        new Promise<void>(resolve => client1.emit('room:join', { roomId: testRoom.id }, resolve)),
        new Promise<void>(resolve => client2.emit('room:join', { roomId: testRoom.id }, resolve))
      ]).then(() => {
        setTimeout(() => {
          client1.emit('room:leave', testRoom.id)
        }, 100)
      })
    })
  })

  describe('Error Handling', () => {
    it('should reject join if room does not exist', (done) => {
      client1.on('error', (data: any) => {
        expect(data.message).toContain('Room not found')
        done()
      })

      client1.emit('room:join', { roomId: 'non-existent-room' })
    })

    it('should reject join if user not in participants', (done) => {
      const restrictedRoom = createTestRoom({
        id: 'restricted',
        participants: ['other-user']
      })

      Room.create(restrictedRoom).then(() => {
        client1.on('error', (data: any) => {
          expect(data.message).toContain('Access denied')
          done()
        })

        client1.emit('room:join', { roomId: restrictedRoom.id })
      })
    })
  })

  describe('Message Persistence', () => {
    it('should persist messages to database', (done) => {
      client1.on('message:confirmed', async (data: any) => {
        const savedMessage = await Message.findOne({ id: data.messageId })
        expect(savedMessage).toBeTruthy()
        expect(savedMessage?.text).toBe('Persistent message')
        expect(savedMessage?.userId).toBe(testUser1.id)
        done()
      })

      client1.emit('room:join', { roomId: testRoom.id })

      setTimeout(() => {
        client1.emit('message:send', {
          roomId: testRoom.id,
          text: 'Persistent message'
        })
      }, 100)
    })

    it('should retrieve message history from database', async () => {
      // Create messages
      await Message.create(createTestUser({ roomId: testRoom.id, text: 'Message 1' }))
      await Message.create(createTestUser({ roomId: testRoom.id, text: 'Message 2' }))
      await Message.create(createTestUser({ roomId: testRoom.id, text: 'Message 3' }))

      return new Promise<void>((resolve) => {
        client1.on('room:history', (data: any) => {
          expect(data.messages.length).toBeGreaterThanOrEqual(3)
          resolve()
        })

        client1.emit('room:join', { roomId: testRoom.id })
      })
    })
  })
})
