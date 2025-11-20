import { v4 as uuidv4 } from 'uuid'

export const createTestUser = (overrides?: Partial<any>) => ({
  id: uuidv4(),
  username: 'testuser',
  email: 'test@example.com',
  createdAt: Date.now(),
  ...overrides
})

export const createTestRoom = (overrides?: Partial<any>) => ({
  id: uuidv4(),
  name: 'Test Room',
  type: 'group' as const,
  participants: [],
  createdBy: 'test-user-id',
  createdAt: Date.now(),
  ...overrides
})

export const createTestMessage = (overrides?: Partial<any>) => ({
  id: `msg-${uuidv4()}`,
  roomId: 'test-room-id',
  userId: 'test-user-id',
  username: 'testuser',
  text: 'Test message',
  timestamp: Date.now(),
  edited: false,
  reactions: new Map(),
  ...overrides
})

export const createTestChatMessage = (overrides?: Partial<any>) => ({
  roomId: 'test-room-id',
  text: 'Test message',
  ...overrides
})

export const createTestJoinRoom = (overrides?: Partial<any>) => ({
  roomId: 'test-room-id',
  ...overrides
})

export const mockRateLimiter = () => ({
  check: jest.fn().mockReturnValue(true),
  reset: jest.fn()
})

export const mockLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
})
