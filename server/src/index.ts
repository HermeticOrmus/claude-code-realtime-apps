import express from 'express'
import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import dotenv from 'dotenv'
import { createRedisAdapter } from './redis/adapter'
import { authMiddleware } from './middleware/auth'
import { rateLimitMiddleware } from './middleware/rate-limit'
import { ChatHandler } from './websocket/handlers/chat-handler'
import { PresenceHandler } from './websocket/handlers/presence-handler'
import { CursorHandler } from './websocket/handlers/cursor-handler'
import { WebRTCHandler } from './websocket/handlers/webrtc-handler'
import { logger } from './utils/logger'
import { connectDatabase } from './database/connection'

dotenv.config()

const app = express()
const server = createServer(app)

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true
}))
app.use(compression())
app.use(express.json({ limit: '10kb' }))

// Socket.io server setup
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1MB max message size
  connectTimeout: 45000
})

// Connection tracking
const activeConnections = new Map<string, Set<string>>()
const connectionStats = {
  totalConnections: 0,
  activeUsers: 0,
  messagesPerSecond: 0,
  lastMessageCount: 0,
  startTime: Date.now()
}

// Initialize Redis adapter for horizontal scaling
async function initializeServer() {
  try {
    // Connect to database
    await connectDatabase()
    logger.info('Database connected')

    // Setup Redis adapter
    if (process.env.REDIS_URL) {
      const adapter = await createRedisAdapter(process.env.REDIS_URL)
      io.adapter(adapter)
      logger.info('Redis adapter initialized for multi-server scaling')
    }

    // Initialize handlers
    const chatHandler = new ChatHandler(io)
    const presenceHandler = new PresenceHandler(io)
    const cursorHandler = new CursorHandler(io)
    const webrtcHandler = new WebRTCHandler(io)

    // Authentication middleware
    io.use(authMiddleware)

    // Rate limiting middleware
    io.use(rateLimitMiddleware)

    // Main connection handler
    io.on('connection', (socket: Socket) => {
      const userId = socket.data.user.id
      const username = socket.data.user.username

      logger.info(`User connected: ${username} (${socket.id})`)

      // Track connection
      if (!activeConnections.has(userId)) {
        activeConnections.set(userId, new Set())
        connectionStats.activeUsers++
      }
      activeConnections.get(userId)!.add(socket.id)
      connectionStats.totalConnections++

      // Heartbeat monitoring
      let isAlive = true
      const heartbeatInterval = setInterval(() => {
        if (!isAlive) {
          clearInterval(heartbeatInterval)
          socket.disconnect(true)
          return
        }

        isAlive = false
        socket.emit('heartbeat')
      }, 30000)

      socket.on('heartbeat:ack', () => {
        isAlive = true
      })

      // Register all handlers
      chatHandler.handleConnection(socket)
      presenceHandler.handleConnection(socket)
      cursorHandler.handleConnection(socket)
      webrtcHandler.handleConnection(socket)

      // Disconnect handling
      socket.on('disconnect', (reason) => {
        logger.info(`User disconnected: ${username} (${reason})`)

        // Clean up
        clearInterval(heartbeatInterval)

        // Remove from active connections
        const userSockets = activeConnections.get(userId)
        if (userSockets) {
          userSockets.delete(socket.id)
          if (userSockets.size === 0) {
            activeConnections.delete(userId)
            connectionStats.activeUsers--
          }
        }

        // Notify handlers
        chatHandler.handleDisconnect(socket)
        presenceHandler.handleDisconnect(socket)
        cursorHandler.handleDisconnect(socket)
      })

      // Error handling
      socket.on('error', (error) => {
        logger.error(`Socket error for user ${userId}:`, error)
      })
    })

    // Stats tracking
    setInterval(() => {
      const messagesThisSecond = connectionStats.lastMessageCount
      connectionStats.messagesPerSecond = messagesThisSecond
      connectionStats.lastMessageCount = 0
    }, 1000)

  } catch (error) {
    logger.error('Failed to initialize server:', error)
    process.exit(1)
  }
}

// REST API endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeUsers: connectionStats.activeUsers,
    totalConnections: connectionStats.totalConnections,
    messagesPerSecond: connectionStats.messagesPerSecond,
    uptime: process.uptime(),
    serverId: process.env.SERVER_ID || 'default'
  })
})

app.get('/stats', (req, res) => {
  res.json({
    ...connectionStats,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    serverId: process.env.SERVER_ID || 'default'
  })
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing server gracefully...')

  io.close(() => {
    logger.info('All connections closed')
    server.close(() => {
      logger.info('Server shutdown complete')
      process.exit(0)
    })
  })

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout')
    process.exit(1)
  }, 30000)
})

// Start server
const PORT = process.env.PORT || 3000

initializeServer().then(() => {
  server.listen(PORT, () => {
    logger.info(`WebSocket server running on port ${PORT}`)
    logger.info(`Server ID: ${process.env.SERVER_ID || 'default'}`)
  })
})

export { io, app, server }
