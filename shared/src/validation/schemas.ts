import { z } from 'zod'

// User validation
export const userSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).max(30),
  email: z.string().email(),
  avatar: z.string().url().optional(),
  status: z.enum(['active', 'idle', 'away', 'offline']),
  lastSeen: z.number()
})

// Chat message validation
export const chatMessageSchema = z.object({
  roomId: z.string().uuid(),
  text: z.string().min(1).max(5000),
  replyTo: z.string().uuid().optional(),
  attachments: z.array(z.object({
    type: z.enum(['image', 'file', 'video']),
    url: z.string().url(),
    filename: z.string(),
    size: z.number().max(10 * 1024 * 1024), // 10MB max
    mimeType: z.string()
  })).optional()
})

// Room creation validation
export const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['direct', 'group', 'channel']),
  participants: z.array(z.string().uuid()).min(1).max(100)
})

// Typing indicator validation
export const typingIndicatorSchema = z.object({
  roomId: z.string().uuid(),
  isTyping: z.boolean()
})

// Cursor position validation
export const cursorPositionSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  page: z.string().optional()
})

// WebRTC signaling validation
export const rtcSignalSchema = z.object({
  type: z.enum(['offer', 'answer', 'ice-candidate']),
  toUserId: z.string().uuid(),
  sessionId: z.string().uuid(),
  data: z.any()
})

// Authentication validation
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100)
})

export const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(8).max(100)
})

// Join room validation
export const joinRoomSchema = z.object({
  roomId: z.string().uuid()
})

// Message reaction validation
export const messageReactionSchema = z.object({
  messageId: z.string().uuid(),
  roomId: z.string().uuid(),
  reaction: z.string().emoji()
})

// Presence update validation
export const presenceUpdateSchema = z.object({
  status: z.enum(['active', 'idle', 'away']),
  currentPage: z.string().optional()
})

// Collaborative edit validation
export const collaborativeEditSchema = z.object({
  documentId: z.string().uuid(),
  operation: z.enum(['insert', 'delete', 'update']),
  position: z.number().min(0),
  content: z.string().optional(),
  length: z.number().min(0).optional()
})

// Export type inference
export type ChatMessageInput = z.infer<typeof chatMessageSchema>
export type CreateRoomInput = z.infer<typeof createRoomSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type RTCSignalInput = z.infer<typeof rtcSignalSchema>
export type CursorPositionInput = z.infer<typeof cursorPositionSchema>
export type PresenceUpdateInput = z.infer<typeof presenceUpdateSchema>
export type CollaborativeEditInput = z.infer<typeof collaborativeEditSchema>
