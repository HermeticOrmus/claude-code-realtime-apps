import { createServer } from 'http'
import { Server as IOServer } from 'socket.io'
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'

jest.setTimeout(15000)

describe('Redis Adapter Multi-Server Tests', () => {
  let httpServer1: any
  let httpServer2: any
  let io1: IOServer
  let io2: IOServer
  let client1: ClientSocket
  let client2: ClientSocket
  let pubClient1: Redis
  let subClient1: Redis
  let pubClient2: Redis
  let subClient2: Redis
  let port1: number
  let port2: number

  beforeAll(async () => {
    port1 = 3002
    port2 = 3003

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

    // Create Redis clients for server 1
    pubClient1 = new Redis(redisUrl)
    subClient1 = pubClient1.duplicate()

    // Create Redis clients for server 2
    pubClient2 = new Redis(redisUrl)
    subClient2 = pubClient2.duplicate()

    // Create HTTP servers
    httpServer1 = createServer()
    httpServer2 = createServer()

    // Create Socket.IO servers
    io1 = new IOServer(httpServer1, {
      cors: { origin: '*', methods: ['GET', 'POST'] }
    })

    io2 = new IOServer(httpServer2, {
      cors: { origin: '*', methods: ['GET', 'POST'] }
    })

    // Attach Redis adapters
    io1.adapter(createAdapter(pubClient1, subClient1))
    io2.adapter(createAdapter(pubClient2, subClient2))

    // Start servers
    await new Promise<void>(resolve => httpServer1.listen(port1, resolve))
    await new Promise<void>(resolve => httpServer2.listen(port2, resolve))

    // Wait for Redis connections
    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  afterAll(async () => {
    await pubClient1.quit()
    await subClient1.quit()
    await pubClient2.quit()
    await subClient2.quit()

    io1.close()
    io2.close()

    await new Promise<void>(resolve => httpServer1.close(resolve))
    await new Promise<void>(resolve => httpServer2.close(resolve))
  })

  beforeEach((done) => {
    let connected = 0

    const checkDone = () => {
      connected++
      if (connected === 2) done()
    }

    client1 = ioClient(`http://localhost:${port1}`, {
      transports: ['websocket']
    })

    client2 = ioClient(`http://localhost:${port2}`, {
      transports: ['websocket']
    })

    client1.on('connect', checkDone)
    client2.on('connect', checkDone)
  })

  afterEach(() => {
    client1.disconnect()
    client2.disconnect()
  })

  describe('Cross-Server Message Broadcasting', () => {
    it('should broadcast messages from server 1 to clients on server 2', (done) => {
      const roomName = 'test-room-1'
      const testMessage = { text: 'Hello from server 1', timestamp: Date.now() }

      // Client 1 on server 1
      // Client 2 on server 2
      client2.on('test:message', (data: any) => {
        expect(data.text).toBe(testMessage.text)
        expect(data.timestamp).toBe(testMessage.timestamp)
        done()
      })

      // Both clients join the same room
      client1.emit('join-room', roomName)
      client2.emit('join-room', roomName)

      // Setup join handlers
      io1.on('connection', (socket) => {
        socket.on('join-room', (room: string) => {
          socket.join(room)
        })

        socket.on('send-message', (room: string, message: any) => {
          io1.to(room).emit('test:message', message)
        })
      })

      io2.on('connection', (socket) => {
        socket.on('join-room', (room: string) => {
          socket.join(room)
        })
      })

      // Wait for joins to complete
      setTimeout(() => {
        client1.emit('send-message', roomName, testMessage)
      }, 500)
    })

    it('should broadcast to all clients across both servers', (done) => {
      const roomName = 'broadcast-room'
      const message = { text: 'Broadcast to all' }
      let receivedCount = 0

      const messageHandler = (data: any) => {
        expect(data.text).toBe(message.text)
        receivedCount++

        // Both clients should receive the message
        if (receivedCount === 2) {
          done()
        }
      }

      client1.on('broadcast:message', messageHandler)
      client2.on('broadcast:message', messageHandler)

      io1.on('connection', (socket) => {
        socket.on('join-room', (room: string) => {
          socket.join(room)
        })

        socket.on('broadcast', (room: string, msg: any) => {
          io1.to(room).emit('broadcast:message', msg)
        })
      })

      io2.on('connection', (socket) => {
        socket.on('join-room', (room: string) => {
          socket.join(room)
        })
      })

      client1.emit('join-room', roomName)
      client2.emit('join-room', roomName)

      setTimeout(() => {
        client1.emit('broadcast', roomName, message)
      }, 500)
    })

    it('should not send messages to clients not in the room', (done) => {
      const room1 = 'room-1'
      const room2 = 'room-2'
      const message = { text: 'Room 1 only' }

      let client2Received = false

      client2.on('room:message', () => {
        client2Received = true
      })

      client1.on('room:message', (data: any) => {
        expect(data.text).toBe(message.text)

        // Wait a bit to ensure client2 doesn't receive
        setTimeout(() => {
          expect(client2Received).toBe(false)
          done()
        }, 200)
      })

      io1.on('connection', (socket) => {
        socket.on('join-room', (room: string) => {
          socket.join(room)
        })

        socket.on('send-to-room', (room: string, msg: any) => {
          io1.to(room).emit('room:message', msg)
        })
      })

      io2.on('connection', (socket) => {
        socket.on('join-room', (room: string) => {
          socket.join(room)
        })
      })

      client1.emit('join-room', room1)
      client2.emit('join-room', room2)

      setTimeout(() => {
        client1.emit('send-to-room', room1, message)
      }, 500)
    })
  })

  describe('Adapter State Synchronization', () => {
    it('should synchronize room membership across servers', (done) => {
      const roomName = 'sync-test-room'

      io1.on('connection', (socket) => {
        socket.on('join-room', async (room: string) => {
          await socket.join(room)

          // Check room membership from server 1's perspective
          const sockets1 = await io1.in(room).fetchSockets()
          const localSockets1 = sockets1.filter(s => s.id === socket.id)

          expect(localSockets1.length).toBe(1)
        })
      })

      io2.on('connection', (socket) => {
        socket.on('join-room', async (room: string) => {
          await socket.join(room)

          // Give time for Redis sync
          setTimeout(async () => {
            // Check room membership from server 2's perspective
            const sockets2 = await io2.in(room).fetchSockets()
            const localSockets2 = sockets2.filter(s => s.id === socket.id)

            expect(localSockets2.length).toBe(1)
            done()
          }, 200)
        })
      })

      client1.emit('join-room', roomName)
      client2.emit('join-room', roomName)
    })

    it('should handle client disconnections across servers', (done) => {
      const roomName = 'disconnect-test'

      io1.on('connection', (socket) => {
        socket.on('join-room', (room: string) => {
          socket.join(room)
        })
      })

      io2.on('connection', (socket) => {
        socket.on('join-room', (room: string) => {
          socket.join(room)
        })

        socket.on('disconnect', async () => {
          // Give time for Redis sync
          setTimeout(async () => {
            const sockets = await io2.in(roomName).fetchSockets()
            // Client 2 should be gone
            const found = sockets.find(s => s.id === client2.id)
            expect(found).toBeUndefined()
            done()
          }, 200)
        })
      })

      client1.emit('join-room', roomName)
      client2.emit('join-room', roomName)

      setTimeout(() => {
        client2.disconnect()
      }, 500)
    })
  })

  describe('Performance and Reliability', () => {
    it('should handle rapid message bursts across servers', (done) => {
      const roomName = 'burst-test'
      const messageCount = 50
      let receivedMessages = 0

      client2.on('burst:message', (data: any) => {
        receivedMessages++

        if (receivedMessages === messageCount) {
          done()
        }
      })

      io1.on('connection', (socket) => {
        socket.on('join-room', (room: string) => {
          socket.join(room)
        })

        socket.on('send-burst', (room: string, count: number) => {
          for (let i = 0; i < count; i++) {
            io1.to(room).emit('burst:message', { index: i })
          }
        })
      })

      io2.on('connection', (socket) => {
        socket.on('join-room', (room: string) => {
          socket.join(room)
        })
      })

      client1.emit('join-room', roomName)
      client2.emit('join-room', roomName)

      setTimeout(() => {
        client1.emit('send-burst', roomName, messageCount)
      }, 500)
    }, 10000)

    it('should maintain message order across servers', (done) => {
      const roomName = 'order-test'
      const messages = ['first', 'second', 'third', 'fourth', 'fifth']
      const received: string[] = []

      client2.on('ordered:message', (data: any) => {
        received.push(data.text)

        if (received.length === messages.length) {
          expect(received).toEqual(messages)
          done()
        }
      })

      io1.on('connection', (socket) => {
        socket.on('join-room', (room: string) => {
          socket.join(room)
        })

        socket.on('send-ordered', (room: string, msgs: string[]) => {
          msgs.forEach((text, index) => {
            setTimeout(() => {
              io1.to(room).emit('ordered:message', { text, index })
            }, index * 10)
          })
        })
      })

      io2.on('connection', (socket) => {
        socket.on('join-room', (room: string) => {
          socket.join(room)
        })
      })

      client1.emit('join-room', roomName)
      client2.emit('join-room', roomName)

      setTimeout(() => {
        client1.emit('send-ordered', roomName, messages)
      }, 500)
    })
  })
})
