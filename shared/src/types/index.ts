// Core message types
export interface WebSocketMessage<T = unknown> {
  type: string
  payload: T
  id?: string
  timestamp: number
  userId?: string
}

// User types
export interface User {
  id: string
  username: string
  email: string
  avatar?: string
  status: 'active' | 'idle' | 'away' | 'offline'
  lastSeen: number
}

// Chat types
export interface ChatRoom {
  id: string
  name: string
  type: 'direct' | 'group' | 'channel'
  participants: string[]
  createdAt: number
  updatedAt: number
}

export interface ChatMessage {
  id: string
  roomId: string
  userId: string
  username: string
  text: string
  timestamp: number
  edited?: boolean
  editedAt?: number
  reactions?: Record<string, string[]>
  replyTo?: string
  attachments?: MessageAttachment[]
}

export interface MessageAttachment {
  id: string
  type: 'image' | 'file' | 'video'
  url: string
  filename: string
  size: number
  mimeType: string
}

// Typing indicator
export interface TypingIndicator {
  userId: string
  username: string
  roomId: string
  timestamp: number
}

// Read receipts
export interface ReadReceipt {
  userId: string
  messageId: string
  roomId: string
  timestamp: number
}

// Presence types
export interface Presence {
  userId: string
  username: string
  status: 'active' | 'idle' | 'away'
  lastSeen: number
  currentPage?: string
}

// Cursor position
export interface CursorPosition {
  userId: string
  username: string
  x: number
  y: number
  timestamp: number
}

// Collaborative editing
export interface CollaborativeEdit {
  userId: string
  documentId: string
  operation: 'insert' | 'delete' | 'update'
  position: number
  content?: string
  length?: number
  timestamp: number
}

// WebRTC signaling
export interface RTCSignal {
  type: 'offer' | 'answer' | 'ice-candidate'
  fromUserId: string
  toUserId: string
  sessionId: string
  data: any
}

// Server-Sent Events
export interface SSEEvent {
  event: string
  data: any
  id?: string
  retry?: number
}

// Error response
export interface ErrorResponse {
  error: string
  message: string
  code?: string
  timestamp: number
}

// Connection stats
export interface ConnectionStats {
  activeConnections: number
  activeUsers: number
  messagesPerSecond: number
  uptime: number
}
