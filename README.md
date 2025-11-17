# ⚡ Real-Time Applications Complete

**Build real-time features that actually scale**

Master WebSocket, Server-Sent Events, and WebRTC with production-ready examples. Chat, collaboration, and live updates with offline-first support.

[![GitHub stars](https://img.shields.io/github/stars/HermeticOrmus/claude-code-realtime-apps?style=social)](https://github.com/HermeticOrmus/claude-code-realtime-apps)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7-010101)](https://socket.io/)
[![WebRTC](https://img.shields.io/badge/WebRTC-ready-333333)](https://webrtc.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## ✨ What's Included

✅ **Multiple Protocols**: WebSocket, SSE, WebRTC - choose the right tool for the job
✅ **Chat Application**: Complete implementation with 3 different protocols
✅ **Collaboration Tools**: Live cursors, presence awareness, collaborative document editing
✅ **Scaling Patterns**: Redis pub/sub, sticky sessions, horizontal scaling strategies
✅ **Offline-First**: Sync strategies, conflict resolution, local-first architecture
✅ **Security**: Authentication, rate limiting, DDoS protection patterns
✅ **Production Ready**: Load balancing, connection recovery, monitoring

---

## 🎯 Why This Guide?

| Feature | Our Guide | Socket.IO Docs | WebRTC Tutorials | Others |
|---------|-----------|----------------|------------------|--------|
| Protocols | WebSocket+SSE+WebRTC | WebSocket only | WebRTC only | Single |
| Scaling | Redis pub/sub | Basic | None | Minimal |
| Offline-First | Complete | None | None | Rare |
| Security | Production patterns | Basic | Varies | Basic |
| Examples | Chat+Collab+Live+Video | Chat only | Video only | Limited |
| Documentation | 30k words | Good | Scattered | Limited |

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Architecture Overview](#-architecture-overview)
- [Protocol Comparison](#-protocol-comparison)
- [Chat Application](#-chat-application)
- [Collaboration Features](#-collaboration-features)
- [Scaling to Production](#-scaling-to-production)
- [Offline-First Architecture](#-offline-first-architecture)
- [Security Best Practices](#-security-best-practices)
- [Real-World Examples](#-real-world-examples)
- [Performance & Optimization](#-performance--optimization)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ LTS
- **Docker** and Docker Compose (for local development)
- **Redis** 7+ (included in Docker Compose)
- **MongoDB** 7+ or PostgreSQL 16+ (included in Docker Compose)

### Installation

```bash
# Clone the repository
git clone https://github.com/HermeticOrmus/claude-code-realtime-apps.git
cd claude-code-realtime-apps

# Install dependencies
npm install

# Start infrastructure (Redis, MongoDB, Nginx)
docker-compose up -d

# Start development servers
npm run dev
```

The server will start on `http://localhost:3000` and the client on `http://localhost:5173`.

### Your First WebSocket Connection

**Server** (`server/src/index.ts`):
```typescript
import { Server } from 'socket.io'

const io = new Server(server, {
  cors: { origin: 'http://localhost:5173' }
})

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  socket.on('message:send', (data) => {
    io.emit('message:new', {
      id: Date.now(),
      text: data.text,
      timestamp: Date.now()
    })
  })
})
```

**Client** (`client/src/App.tsx`):
```typescript
import { useChat } from './hooks/useChat'

function ChatApp() {
  const { messages, sendMessage, connected } = useChat({
    roomId: 'general',
    url: 'http://localhost:3000',
    getToken: () => localStorage.getItem('token')
  })

  return (
    <div>
      <h1>Chat {connected ? '🟢' : '🔴'}</h1>
      {messages.map(msg => (
        <div key={msg.id}>{msg.text}</div>
      ))}
      <button onClick={() => sendMessage('Hello!')}>
        Send Message
      </button>
    </div>
  )
}
```

That's it! You now have a working real-time chat with auto-reconnection, message queuing, and offline support.

---

## 🏗 Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Load Balancer                         │
│                     (Nginx with Sticky Sessions)             │
└────────────────┬────────────────┬───────────────────────────┘
                 │                 │
         ┌───────▼────────┐ ┌─────▼────────┐
         │   Server 1     │ │  Server 2    │
         │   (Node.js)    │ │  (Node.js)   │
         │   Socket.IO    │ │  Socket.IO   │
         └───────┬────────┘ └─────┬────────┘
                 │                 │
                 └────────┬────────┘
                          │
                    ┌─────▼──────┐
                    │   Redis    │
                    │  (Pub/Sub) │
                    └─────┬──────┘
                          │
            ┌─────────────┴──────────────┐
            │                             │
      ┌─────▼──────┐              ┌──────▼──────┐
      │  MongoDB   │              │  PostgreSQL │
      │ (Messages) │              │   (Users)   │
      └────────────┘              └─────────────┘
```

### Key Components

1. **WebSocket Server** (`server/src/index.ts`)
   - Socket.IO with WebSocket transport
   - Authentication middleware
   - Rate limiting
   - Heartbeat monitoring

2. **Redis Adapter** (`server/src/redis/adapter.ts`)
   - Multi-server message synchronization
   - Pub/sub for broadcast messages
   - Session and presence caching

3. **Resilient Client** (`client/src/websocket/resilient-client.ts`)
   - Auto-reconnection with exponential backoff
   - Message queuing during offline
   - Heartbeat monitoring

4. **Offline Sync** (`client/src/offline/sync-manager.ts`)
   - IndexedDB for local storage
   - Automatic sync on reconnection
   - Conflict resolution

---

## 🔄 Protocol Comparison

### When to Use What

| Use Case | WebSocket | SSE | WebRTC | Long Polling |
|----------|-----------|-----|--------|--------------|
| **Chat** | ✅ Best | ⚠️ Read-only | ❌ No | ❌ No |
| **Live Dashboard** | ✅ Yes | ✅ Best | ❌ No | ⚠️ Fallback |
| **Notifications** | ✅ Yes | ✅ Best | ❌ No | ⚠️ Fallback |
| **Collaboration** | ✅ Best | ❌ No | ⚠️ For video | ❌ No |
| **Video Chat** | ❌ No | ❌ No | ✅ Best | ❌ No |
| **File Transfer** | ⚠️ Small files | ❌ No | ✅ P2P | ❌ No |

### WebSocket

**Pros:**
- ✅ Full-duplex (bidirectional) communication
- ✅ Low latency (~50ms roundtrip)
- ✅ Efficient for high-frequency updates
- ✅ Widely supported

**Cons:**
- ❌ Requires special server setup
- ❌ Doesn't work through some corporate proxies
- ❌ Connection overhead for simple use cases

**Example Use Cases:**
- Real-time chat applications
- Live collaborative editing
- Multiplayer games
- Trading platforms

**Implementation:**
```typescript
// Server
io.on('connection', (socket) => {
  socket.on('message:send', (data) => {
    io.to(data.roomId).emit('message:new', data)
  })
})

// Client
socket.emit('message:send', { roomId: '123', text: 'Hello' })
socket.on('message:new', (message) => {
  console.log('New message:', message)
})
```

### Server-Sent Events (SSE)

**Pros:**
- ✅ Simple to implement (just HTTP)
- ✅ Auto-reconnection built-in
- ✅ Works through proxies
- ✅ Event IDs for resume support

**Cons:**
- ❌ Unidirectional (server→client only)
- ❌ Limited to 6 connections per browser/domain
- ❌ Text-only (no binary data)

**Example Use Cases:**
- Live news feeds
- Stock price updates
- Server monitoring dashboards
- Notification streams

**Implementation:**
```typescript
// Server
app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  setInterval(() => {
    res.write(`data: ${JSON.stringify({ time: Date.now() })}\n\n`)
  }, 1000)
})

// Client
const eventSource = new EventSource('/events')
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log('Update:', data)
}
```

### WebRTC

**Pros:**
- ✅ Peer-to-peer (no server for data transfer)
- ✅ Very low latency
- ✅ Built-in encryption
- ✅ Audio/video streaming

**Cons:**
- ❌ Complex setup (signaling required)
- ❌ NAT traversal issues
- ❌ Not all browsers support all features

**Example Use Cases:**
- Video conferencing
- Screen sharing
- P2P file transfer
- Real-time gaming

**Implementation:**
```typescript
// Signaling server
io.on('connection', (socket) => {
  socket.on('webrtc:offer', (data) => {
    socket.to(data.targetUserId).emit('webrtc:offer', data)
  })
})

// Client
const pc = new RTCPeerConnection()
const offer = await pc.createOffer()
await pc.setLocalDescription(offer)

socket.emit('webrtc:offer', {
  targetUserId: 'user-456',
  offer: offer
})
```

---

## 💬 Chat Application

### Features

- ✅ **1-on-1 and group chat**
- ✅ **Message persistence** (MongoDB)
- ✅ **Typing indicators**
- ✅ **Read receipts**
- ✅ **Message reactions** (emoji)
- ✅ **Message editing and deletion**
- ✅ **Offline message queue**
- ✅ **Auto-reconnection**

### Architecture

The chat system consists of three main components:

1. **Chat Handler** (Server)
   - Manages rooms and participants
   - Persists messages to database
   - Broadcasts messages to room members
   - Handles typing indicators

2. **useChat Hook** (Client)
   - Manages connection state
   - Provides message CRUD operations
   - Handles typing indicators
   - Optimistic UI updates

3. **Sync Manager** (Offline)
   - Queues messages when offline
   - Auto-syncs on reconnection
   - Handles retry logic

### Basic Usage

```typescript
import { useChat } from './hooks/useChat'

function ChatRoom({ roomId }: { roomId: string }) {
  const {
    messages,
    typingUsers,
    connected,
    sendMessage,
    startTyping,
    stopTyping
  } = useChat({
    roomId,
    url: 'http://localhost:3000',
    getToken: () => localStorage.getItem('token')
  })

  return (
    <div>
      <ConnectionStatus connected={connected} />

      <MessageList messages={messages} />

      {typingUsers.length > 0 && (
        <TypingIndicator users={typingUsers} />
      )}

      <MessageInput
        onSend={sendMessage}
        onStartTyping={startTyping}
        onStopTyping={stopTyping}
      />
    </div>
  )
}
```

### Message Persistence

Messages are stored in MongoDB with the following schema:

```typescript
interface ChatMessage {
  id: string                    // Unique message ID
  roomId: string                // Room/channel ID
  userId: string                // Sender user ID
  username: string              // Sender username
  text: string                  // Message content (max 5000 chars)
  timestamp: number             // Unix timestamp
  edited: boolean               // Whether message was edited
  editedAt?: number             // Edit timestamp
  reactions: Map<string, string[]>  // Emoji reactions
  replyTo?: string              // Parent message ID
  attachments?: MessageAttachment[] // File attachments
}
```

### Typing Indicators

Typing indicators are implemented using throttled events:

```typescript
// Client sends typing start
socket.emit('typing:start', roomId)

// Server broadcasts to room (except sender)
socket.to(roomId).emit('user:typing', {
  userId,
  username,
  roomId
})

// Auto-stop after 3 seconds
setTimeout(() => {
  socket.to(roomId).emit('user:stopped-typing', { userId })
}, 3000)
```

### Read Receipts

Track when users read messages:

```typescript
// Mark message as read
socket.emit('message:read', {
  roomId: 'room-123',
  messageId: 'msg-456'
})

// Broadcast read receipt
io.to(roomId).emit('message:read-receipt', {
  userId,
  messageId,
  timestamp: Date.now()
})
```

### Message Reactions

Add emoji reactions to messages:

```typescript
const { reactToMessage } = useChat({ ... })

// Add/remove reaction
reactToMessage('msg-123', '👍')

// Server updates message reactions
message.reactions.set('👍', [...existingUsers, userId])

// Broadcast update
io.to(roomId).emit('message:reaction-updated', {
  messageId,
  reactions: Object.fromEntries(message.reactions)
})
```

---

## 🤝 Collaboration Features

### Live Cursors

Track and display cursor positions of all users in real-time.

**Server** (`server/src/websocket/handlers/cursor-handler.ts`):
```typescript
socket.on('cursor:move', (data) => {
  const { x, y, page } = data

  // Broadcast to others on same page (throttled to 50ms)
  socket.to(`cursors:${page}`).emit('cursor:moved', {
    userId,
    username,
    x,
    y,
    color: generateColorFromUserId(userId)
  })
})
```

**Client**:
```typescript
import { useEffect } from 'react'

function useLiveCursors(pageId: string) {
  const [cursors, setCursors] = useState<Map<string, CursorData>>(new Map())

  useEffect(() => {
    socket.emit('cursor:subscribe', pageId)

    const handleMouseMove = throttle((e: MouseEvent) => {
      socket.emit('cursor:move', {
        x: e.clientX,
        y: e.clientY,
        page: pageId
      })
    }, 50)

    socket.on('cursor:moved', (data) => {
      setCursors(prev => new Map(prev).set(data.userId, data))
    })

    document.addEventListener('mousemove', handleMouseMove)

    return () => {
      socket.emit('cursor:unsubscribe', pageId)
      document.removeEventListener('mousemove', handleMouseMove)
    }
  }, [pageId])

  return Array.from(cursors.values())
}
```

**Rendering Cursors**:
```tsx
function CursorOverlay() {
  const cursors = useLiveCursors('page-123')

  return (
    <div className="cursor-overlay">
      {cursors.map(cursor => (
        <div
          key={cursor.userId}
          className="remote-cursor"
          style={{
            left: cursor.x,
            top: cursor.y,
            borderColor: cursor.color
          }}
        >
          <span>{cursor.username}</span>
        </div>
      ))}
    </div>
  )
}
```

### Presence Awareness

Know who's online and what they're doing.

**Features**:
- Active/idle/away status
- Current page tracking
- Last seen timestamp
- Auto-detection of activity

**Usage**:
```typescript
import { usePresence } from './hooks/usePresence'

function PresenceIndicator() {
  const { users, updateStatus } = usePresence({
    url: 'http://localhost:3000',
    getToken: () => localStorage.getItem('token')
  })

  const activeUsers = users.filter(u => u.status === 'active')

  return (
    <div>
      <h3>Online ({activeUsers.length})</h3>
      {activeUsers.map(user => (
        <div key={user.userId}>
          <Avatar user={user} />
          <span>{user.username}</span>
          <StatusDot status={user.status} />
        </div>
      ))}
    </div>
  )
}
```

### Collaborative Editing

Real-time collaborative document editing using Yjs (CRDT).

**Why CRDTs?**

Conflict-Free Replicated Data Types (CRDTs) allow multiple users to edit the same document simultaneously without conflicts. Unlike Operational Transformation (OT), CRDTs:

- ✅ Work offline
- ✅ Don't require a central server
- ✅ Automatically resolve conflicts
- ✅ Are mathematically proven to converge

**Implementation with Yjs**:

```typescript
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

function CollaborativeEditor() {
  const ydoc = new Y.Doc()
  const provider = new WebsocketProvider(
    'ws://localhost:1234',
    'my-document',
    ydoc
  )

  const ytext = ydoc.getText('content')

  // Bind to editor
  ytext.observe(() => {
    editor.setValue(ytext.toString())
  })

  editor.on('change', () => {
    const delta = computeDelta(editor.getValue(), ytext.toString())
    ytext.delete(delta.start, delta.deleteLength)
    ytext.insert(delta.start, delta.insertText)
  })

  return <CodeEditor ref={editorRef} />
}
```

---

## 📈 Scaling to Production

### The Problem

A single WebSocket server works great for development, but in production you need:

- **High availability** - No single point of failure
- **Horizontal scaling** - Handle 10k+ concurrent connections
- **Session persistence** - Maintain connections during deployments
- **Geographic distribution** - Low latency worldwide

### Solution: Redis Pub/Sub

Redis acts as a message broker, allowing multiple WebSocket servers to communicate.

**Architecture**:

```
Client A → Server 1 ──┐
                       ├──→ Redis Pub/Sub ──┐
Client B → Server 2 ──┘                     ├──→ Server 1 → Client A
                                             └──→ Server 2 → Client B
```

**Implementation**:

```typescript
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'

const pubClient = new Redis(process.env.REDIS_URL)
const subClient = pubClient.duplicate()

io.adapter(createAdapter(pubClient, subClient))

// Now messages broadcast across all servers!
io.to('room-123').emit('message', data)
```

### Sticky Sessions

Clients must reconnect to the same server to maintain state.

**Nginx Configuration**:

```nginx
upstream websocket_backend {
    ip_hash;  # Sticky sessions by IP
    server server-1:3001;
    server server-2:3002;
}

server {
    location /socket.io/ {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Connection Recovery

Handle server restarts gracefully:

```typescript
// Client auto-reconnects with exponential backoff
class ResilientWebSocketClient {
  private scheduleReconnect() {
    const delay = Math.min(
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, this.reconnectAttempts),
      this.config.maxDelay
    )

    setTimeout(() => {
      this.reconnectAttempts++
      this.connect()
    }, delay)
  }
}
```

### Load Testing

Test your WebSocket server with k6:

```bash
k6 run tests/load/websocket-load-test.js
```

**Results you should see**:
- ✅ 1000 concurrent connections
- ✅ < 200ms message latency (p95)
- ✅ < 1s connection time (p95)
- ✅ < 10 connection errors

---

## 📴 Offline-First Architecture

### The Problem

Traditional real-time apps break when offline. Users expect:

- ✅ Send messages while offline
- ✅ Auto-sync when reconnected
- ✅ View cached messages
- ✅ Seamless experience

### Solution: IndexedDB + Sync Manager

**Architecture**:

```
User Action → Offline DB (IndexedDB) → Sync Queue
                                             ↓
                                   (when online)
                                             ↓
                                      WebSocket Server
```

**Implementation**:

```typescript
import { SyncManager } from './offline/sync-manager'

const syncManager = new SyncManager(websocketClient)

// Send message (works offline!)
await syncManager.sendMessage('room-123', 'Hello from offline!')

// Automatically syncs when reconnected
client.on('connect', () => {
  syncManager.syncPendingMessages()
})
```

### Message Queue

```typescript
interface PendingMessage {
  id: number
  messageId: string
  roomId: string
  text: string
  timestamp: number
  status: 'pending' | 'sent' | 'failed'
  retryCount: number
}

// Add to queue
await db.pendingMessages.add({
  messageId: 'msg-123',
  roomId: 'room-456',
  text: 'Hello',
  timestamp: Date.now(),
  status: 'pending',
  retryCount: 0
})

// Sync when online
const pending = await db.pendingMessages
  .where('status')
  .equals('pending')
  .toArray()

for (const msg of pending) {
  socket.emit('message:send', msg)
}
```

### Conflict Resolution

**Strategies**:

1. **Last-Write-Wins (Simple)**
   ```typescript
   if (serverTimestamp > localTimestamp) {
     applyServerVersion()
   }
   ```

2. **CRDTs (Conflict-Free)**
   ```typescript
   // Yjs automatically merges changes
   ydoc.merge(remoteUpdates)
   ```

3. **Manual Resolution**
   ```typescript
   if (conflict) {
     showConflictUI({
       local: localMessage,
       remote: serverMessage,
       resolve: (chosen) => applyResolution(chosen)
     })
   }
   ```

---

## 🔒 Security Best Practices

### Authentication

Use JWT tokens for WebSocket authentication:

```typescript
// Server
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token

  try {
    const user = jwt.verify(token, JWT_SECRET)
    socket.data.user = user
    next()
  } catch (error) {
    next(new Error('Authentication failed'))
  }
})

// Client
const socket = io('http://localhost:3000', {
  auth: {
    token: localStorage.getItem('token')
  }
})
```

### Rate Limiting

Prevent spam and abuse:

```typescript
const userMessageCounts = new Map()

socket.on('message:send', (data) => {
  const count = userMessageCounts.get(userId) || 0

  if (count >= 60) { // 60 messages per minute
    socket.emit('error', { message: 'Rate limit exceeded' })
    return
  }

  userMessageCounts.set(userId, count + 1)

  // Process message...
})
```

### Input Validation

Always validate and sanitize user input:

```typescript
import { z } from 'zod'
import sanitizeHtml from 'sanitize-html'

const messageSchema = z.object({
  roomId: z.string().uuid(),
  text: z.string().min(1).max(5000)
})

socket.on('message:send', (data) => {
  // Validate structure
  const result = messageSchema.safeParse(data)
  if (!result.success) {
    socket.emit('error', { message: 'Invalid message' })
    return
  }

  // Sanitize content
  const sanitized = sanitizeHtml(data.text, {
    allowedTags: [],
    allowedAttributes: {}
  })

  // Process sanitized message...
})
```

### DDoS Protection

1. **Connection Limits**
   ```typescript
   const connectionsPerIP = new Map()

   io.use((socket, next) => {
     const ip = socket.handshake.address
     const count = connectionsPerIP.get(ip) || 0

     if (count >= 10) {
       next(new Error('Too many connections'))
       return
     }

     connectionsPerIP.set(ip, count + 1)
     next()
   })
   ```

2. **Message Size Limits**
   ```typescript
   const io = new Server(server, {
     maxHttpBufferSize: 1e6 // 1MB max
   })
   ```

3. **Heartbeat Monitoring**
   ```typescript
   let isAlive = true

   const heartbeatInterval = setInterval(() => {
     if (!isAlive) {
       socket.disconnect(true)
       return
     }

     isAlive = false
     socket.emit('heartbeat')
   }, 30000)

   socket.on('heartbeat:ack', () => {
     isAlive = true
   })
   ```

---

## 🎬 Real-World Examples

### Example 1: Live Chat Application

**Location**: `examples/chat/`

A complete chat application with:
- Multiple rooms
- User presence
- Typing indicators
- Message history
- Offline support

**Run it**:
```bash
cd examples/chat
npm install
npm run dev
```

### Example 2: Collaborative Whiteboard

**Location**: `examples/collaboration/`

Real-time drawing with:
- Live cursors
- Shared canvas
- Undo/redo
- Presence awareness

### Example 3: Live Dashboard

**Location**: `examples/live-dashboard/`

Real-time metrics dashboard using SSE:
- Server stats
- Active users
- Messages per second
- Auto-refreshing charts

### Example 4: Video Chat

**Location**: `examples/video-chat/`

WebRTC-based video conferencing:
- 1-on-1 and group calls
- Screen sharing
- Audio/video toggle
- WebSocket signaling

---

## ⚡ Performance & Optimization

### Measuring Performance

**Key Metrics**:
- Connection time (p95 < 1s)
- Message latency (p95 < 200ms)
- Messages per second
- Memory usage per connection
- CPU usage

**Monitoring**:
```typescript
app.get('/stats', (req, res) => {
  res.json({
    activeConnections: io.sockets.sockets.size,
    messagesPerSecond: connectionStats.messagesPerSecond,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  })
})
```

### Optimization Techniques

1. **Throttle High-Frequency Events**
   ```typescript
   const throttle = (func, delay) => {
     let lastCall = 0
     return (...args) => {
       const now = Date.now()
       if (now - lastCall >= delay) {
         lastCall = now
         func(...args)
       }
     }
   }

   // Throttle cursor updates to 20/sec
   const sendCursor = throttle((x, y) => {
     socket.emit('cursor:move', { x, y })
   }, 50)
   ```

2. **Binary Data for Large Payloads**
   ```typescript
   // Use Buffer instead of JSON for large data
   socket.emit('data', buffer)
   ```

3. **Compression**
   ```typescript
   const io = new Server(server, {
     perMessageDeflate: {
       threshold: 1024 // Compress messages > 1KB
     }
   })
   ```

4. **Connection Pooling**
   ```typescript
   // Reuse database connections
   const pool = new Pool({
     max: 20,
     idleTimeoutMillis: 30000
   })
   ```

---

## 🚢 Deployment

### Docker Deployment

**Build images**:
```bash
docker-compose build
```

**Run in production**:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment

**deployment.yaml**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: websocket-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: websocket-server
  template:
    metadata:
      labels:
        app: websocket-server
    spec:
      containers:
      - name: server
        image: realtime-apps/server:latest
        ports:
        - containerPort: 3000
        env:
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        - name: MONGODB_URL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: mongodb-url
```

### Environment Variables

```bash
# Production settings
NODE_ENV=production
PORT=3000
REDIS_URL=redis://redis:6379
MONGODB_URL=mongodb://mongo:27017/realtime
JWT_SECRET=your-production-secret-change-this
ALLOWED_ORIGINS=https://yourdomain.com
```

### SSL/TLS

Use HTTPS and WSS in production:

```typescript
import https from 'https'
import fs from 'fs'

const server = https.createServer({
  cert: fs.readFileSync('/etc/ssl/cert.pem'),
  key: fs.readFileSync('/etc/ssl/key.pem')
}, app)

const io = new Server(server, {
  cors: {
    origin: 'https://yourdomain.com',
    credentials: true
  }
})
```

---

## 🔍 Troubleshooting

### Connection Issues

**Problem**: WebSocket connection fails

**Solution**:
1. Check CORS settings
2. Verify firewall allows WebSocket traffic (port 3000)
3. Check for proxy/load balancer WebSocket support
4. Test with polling transport first

```typescript
// Fallback to polling
const socket = io('http://localhost:3000', {
  transports: ['polling', 'websocket']
})
```

### Message Loss

**Problem**: Messages not received by all clients

**Solution**:
1. Verify Redis pub/sub is working
2. Check room membership
3. Enable message acknowledgments

```typescript
socket.emit('message:send', data, (ack) => {
  console.log('Message received:', ack)
})
```

### High Memory Usage

**Problem**: Server memory grows over time

**Solution**:
1. Limit message history in memory
2. Use database for persistence
3. Implement TTL for cached data
4. Monitor for memory leaks

```typescript
// Limit in-memory message cache
const MAX_CACHED_MESSAGES = 100

if (messageCache.length > MAX_CACHED_MESSAGES) {
  messageCache.shift()
}
```

### Reconnection Loops

**Problem**: Client keeps reconnecting

**Solution**:
1. Implement exponential backoff
2. Check authentication token validity
3. Verify rate limiting isn't blocking

```typescript
// Already implemented in ResilientWebSocketClient
const delay = Math.min(
  initialDelay * Math.pow(backoffMultiplier, attempts),
  maxDelay
)
```

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Fork and clone
git clone https://github.com/yourusername/claude-code-realtime-apps.git

# Install dependencies
npm install

# Start development
npm run dev

# Run tests
npm test

# Run linter
npm run lint
```

### Code Standards

- TypeScript strict mode
- ESLint for code quality
- Prettier for formatting
- Conventional commits

---

## 📚 Additional Resources

### Documentation

- [Protocol Comparison Guide](docs/guides/protocols.md) - Deep dive into WebSocket vs SSE vs WebRTC
- [Scaling Guide](docs/guides/scaling.md) - Horizontal scaling with Redis
- [Offline-First Guide](docs/guides/offline-first.md) - Building offline-capable apps
- [Security Guide](docs/guides/security.md) - Authentication, rate limiting, validation
- [API Reference](docs/api/README.md) - Complete API documentation

### External Links

- [Socket.IO Documentation](https://socket.io/docs/)
- [WebRTC Specification](https://www.w3.org/TR/webrtc/)
- [Server-Sent Events Spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [Yjs CRDT Documentation](https://docs.yjs.dev/)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with ❤️ by **Hermetic Ormus** and the open-source community.

Special thanks to:
- Socket.IO team for the excellent WebSocket library
- Yjs team for the CRDT implementation
- All contributors who helped make this project better

---

## ⭐ Star History

If this project helped you, please give it a star! It helps others discover it.

**[Star this repository →](https://github.com/HermeticOrmus/claude-code-realtime-apps)**

---

*"Real-time is about perception, not milliseconds. Build for humans, not benchmarks."* — Hermetic Ormus
