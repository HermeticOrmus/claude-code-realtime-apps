import { WebRTCHandler } from '../../../src/websocket/handlers/webrtc-handler'
import { MockServer, MockSocket } from '../../helpers/socket-mock'
import { createTestUser } from '../../helpers/test-data'

jest.mock('../../../src/utils/logger')

describe('WebRTCHandler', () => {
  let webrtcHandler: WebRTCHandler
  let mockIo: MockServer
  let mockSocket: MockSocket
  let peerSocket: MockSocket
  let testUser: any
  let peerUser: any

  beforeEach(() => {
    mockIo = new MockServer()
    webrtcHandler = new WebRTCHandler(mockIo as any)

    testUser = createTestUser({ id: 'test-user-id', username: 'testuser' })
    peerUser = createTestUser({ id: 'peer-user-id', username: 'peeruser' })

    mockSocket = new MockSocket('socket-1', { user: testUser })
    peerSocket = new MockSocket('socket-2', { user: peerUser })

    mockIo.addSocket(mockSocket)
    mockIo.addSocket(peerSocket)
  })

  describe('webrtc:call', () => {
    it('should initiate call to peer', async () => {
      webrtcHandler.handleConnection(mockSocket as any)
      webrtcHandler.handleConnection(peerSocket as any)

      mockSocket.emit('webrtc:call', {
        targetUserId: peerUser.id,
        offer: {
          type: 'offer',
          sdp: 'mock-sdp-offer'
        }
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(peerSocket.hasEmitted('webrtc:incoming-call')).toBe(true)
      const incomingCall = peerSocket.getLastEmittedEvent('webrtc:incoming-call')
      expect(incomingCall[0].fromUserId).toBe(testUser.id)
      expect(incomingCall[0].offer.sdp).toBe('mock-sdp-offer')
    })

    it('should reject call if peer is offline', async () => {
      webrtcHandler.handleConnection(mockSocket as any)

      mockSocket.emit('webrtc:call', {
        targetUserId: 'offline-user',
        offer: {
          type: 'offer',
          sdp: 'mock-sdp-offer'
        }
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.hasEmitted('error')).toBe(true)
      const error = mockSocket.getLastEmittedEvent('error')
      expect(error[0].message).toContain('not available')
    })

    it('should track active call', async () => {
      webrtcHandler.handleConnection(mockSocket as any)
      webrtcHandler.handleConnection(peerSocket as any)

      mockSocket.emit('webrtc:call', {
        targetUserId: peerUser.id,
        offer: { type: 'offer', sdp: 'mock-sdp' }
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const activeCall = webrtcHandler.getActiveCall(testUser.id)
      expect(activeCall).toBeDefined()
      expect(activeCall?.peer).toBe(peerUser.id)
    })
  })

  describe('webrtc:answer', () => {
    beforeEach(async () => {
      webrtcHandler.handleConnection(mockSocket as any)
      webrtcHandler.handleConnection(peerSocket as any)

      // Initiate call first
      mockSocket.emit('webrtc:call', {
        targetUserId: peerUser.id,
        offer: { type: 'offer', sdp: 'mock-offer' }
      })

      await new Promise(resolve => setTimeout(resolve, 100))
      peerSocket.clearEmittedEvents()
    })

    it('should send answer to caller', async () => {
      peerSocket.emit('webrtc:answer', {
        targetUserId: testUser.id,
        answer: {
          type: 'answer',
          sdp: 'mock-sdp-answer'
        }
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.hasEmitted('webrtc:answer')).toBe(true)
      const answer = mockSocket.getLastEmittedEvent('webrtc:answer')
      expect(answer[0].fromUserId).toBe(peerUser.id)
      expect(answer[0].answer.sdp).toBe('mock-sdp-answer')
    })

    it('should establish call as connected', async () => {
      peerSocket.emit('webrtc:answer', {
        targetUserId: testUser.id,
        answer: { type: 'answer', sdp: 'mock-answer' }
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const call = webrtcHandler.getActiveCall(testUser.id)
      expect(call?.status).toBe('connected')
    })
  })

  describe('webrtc:ice-candidate', () => {
    beforeEach(async () => {
      webrtcHandler.handleConnection(mockSocket as any)
      webrtcHandler.handleConnection(peerSocket as any)

      mockSocket.emit('webrtc:call', {
        targetUserId: peerUser.id,
        offer: { type: 'offer', sdp: 'mock-offer' }
      })

      await new Promise(resolve => setTimeout(resolve, 100))
      mockSocket.clearEmittedEvents()
      peerSocket.clearEmittedEvents()
    })

    it('should forward ICE candidate to peer', async () => {
      const iceCandidate = {
        candidate: 'candidate:1 1 udp 2130706431 192.168.1.1 54321 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0
      }

      mockSocket.emit('webrtc:ice-candidate', {
        targetUserId: peerUser.id,
        candidate: iceCandidate
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(peerSocket.hasEmitted('webrtc:ice-candidate')).toBe(true)
      const received = peerSocket.getLastEmittedEvent('webrtc:ice-candidate')
      expect(received[0].fromUserId).toBe(testUser.id)
      expect(received[0].candidate.candidate).toBe(iceCandidate.candidate)
    })

    it('should handle multiple ICE candidates', async () => {
      const candidates = [
        { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 },
        { candidate: 'candidate:2', sdpMid: '0', sdpMLineIndex: 0 },
        { candidate: 'candidate:3', sdpMid: '0', sdpMLineIndex: 0 }
      ]

      for (const candidate of candidates) {
        mockSocket.emit('webrtc:ice-candidate', {
          targetUserId: peerUser.id,
          candidate
        })
      }

      await new Promise(resolve => setTimeout(resolve, 100))

      // Should have forwarded all candidates
      const emittedEvents = peerSocket.getEmittedEvents()
      const iceCandidates = emittedEvents.filter(e => e.event === 'webrtc:ice-candidate')
      expect(iceCandidates.length).toBe(3)
    })
  })

  describe('webrtc:reject', () => {
    beforeEach(async () => {
      webrtcHandler.handleConnection(mockSocket as any)
      webrtcHandler.handleConnection(peerSocket as any)

      mockSocket.emit('webrtc:call', {
        targetUserId: peerUser.id,
        offer: { type: 'offer', sdp: 'mock-offer' }
      })

      await new Promise(resolve => setTimeout(resolve, 100))
      mockSocket.clearEmittedEvents()
    })

    it('should notify caller of rejection', async () => {
      peerSocket.emit('webrtc:reject', {
        targetUserId: testUser.id,
        reason: 'busy'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.hasEmitted('webrtc:call-rejected')).toBe(true)
      const rejection = mockSocket.getLastEmittedEvent('webrtc:call-rejected')
      expect(rejection[0].fromUserId).toBe(peerUser.id)
      expect(rejection[0].reason).toBe('busy')
    })

    it('should clear call state', async () => {
      peerSocket.emit('webrtc:reject', {
        targetUserId: testUser.id,
        reason: 'declined'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const call = webrtcHandler.getActiveCall(testUser.id)
      expect(call).toBeUndefined()
    })
  })

  describe('webrtc:hangup', () => {
    beforeEach(async () => {
      webrtcHandler.handleConnection(mockSocket as any)
      webrtcHandler.handleConnection(peerSocket as any)

      mockSocket.emit('webrtc:call', {
        targetUserId: peerUser.id,
        offer: { type: 'offer', sdp: 'mock-offer' }
      })

      peerSocket.emit('webrtc:answer', {
        targetUserId: testUser.id,
        answer: { type: 'answer', sdp: 'mock-answer' }
      })

      await new Promise(resolve => setTimeout(resolve, 100))
      mockSocket.clearEmittedEvents()
      peerSocket.clearEmittedEvents()
    })

    it('should notify peer of hangup', async () => {
      mockSocket.emit('webrtc:hangup', {
        targetUserId: peerUser.id
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(peerSocket.hasEmitted('webrtc:call-ended')).toBe(true)
      const ended = peerSocket.getLastEmittedEvent('webrtc:call-ended')
      expect(ended[0].fromUserId).toBe(testUser.id)
    })

    it('should clear call state for both parties', async () => {
      mockSocket.emit('webrtc:hangup', {
        targetUserId: peerUser.id
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(webrtcHandler.getActiveCall(testUser.id)).toBeUndefined()
      expect(webrtcHandler.getActiveCall(peerUser.id)).toBeUndefined()
    })

    it('should record call duration', async () => {
      const callStartTime = Date.now()

      await new Promise(resolve => setTimeout(resolve, 200))

      mockSocket.emit('webrtc:hangup', {
        targetUserId: peerUser.id
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const ended = peerSocket.getLastEmittedEvent('webrtc:call-ended')
      expect(ended[0].duration).toBeGreaterThan(0)
    })
  })

  describe('disconnect handling', () => {
    beforeEach(async () => {
      webrtcHandler.handleConnection(mockSocket as any)
      webrtcHandler.handleConnection(peerSocket as any)

      mockSocket.emit('webrtc:call', {
        targetUserId: peerUser.id,
        offer: { type: 'offer', sdp: 'mock-offer' }
      })

      peerSocket.emit('webrtc:answer', {
        targetUserId: testUser.id,
        answer: { type: 'answer', sdp: 'mock-answer' }
      })

      await new Promise(resolve => setTimeout(resolve, 100))
      peerSocket.clearEmittedEvents()
    })

    it('should end call when user disconnects', async () => {
      webrtcHandler.handleDisconnect(mockSocket as any)

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(peerSocket.hasEmitted('webrtc:call-ended')).toBe(true)
      const ended = peerSocket.getLastEmittedEvent('webrtc:call-ended')
      expect(ended[0].reason).toBe('disconnected')
    })

    it('should clean up call state on disconnect', () => {
      webrtcHandler.handleDisconnect(mockSocket as any)

      expect(webrtcHandler.getActiveCall(testUser.id)).toBeUndefined()
    })
  })

  describe('call state management', () => {
    it('should prevent multiple simultaneous calls', async () => {
      webrtcHandler.handleConnection(mockSocket as any)
      webrtcHandler.handleConnection(peerSocket as any)

      const anotherUser = createTestUser({ id: 'another-user', username: 'another' })
      const anotherSocket = new MockSocket('socket-3', { user: anotherUser })
      webrtcHandler.handleConnection(anotherSocket as any)

      // Start call with peer
      mockSocket.emit('webrtc:call', {
        targetUserId: peerUser.id,
        offer: { type: 'offer', sdp: 'offer-1' }
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      // Try to start another call
      mockSocket.emit('webrtc:call', {
        targetUserId: anotherUser.id,
        offer: { type: 'offer', sdp: 'offer-2' }
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(mockSocket.hasEmitted('error')).toBe(true)
      const error = mockSocket.getLastEmittedEvent('error')
      expect(error[0].message).toContain('already in a call')
    })

    it('should track call metadata', async () => {
      webrtcHandler.handleConnection(mockSocket as any)
      webrtcHandler.handleConnection(peerSocket as any)

      mockSocket.emit('webrtc:call', {
        targetUserId: peerUser.id,
        offer: { type: 'offer', sdp: 'mock-offer' },
        metadata: {
          video: true,
          audio: true
        }
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const call = webrtcHandler.getActiveCall(testUser.id)
      expect(call?.metadata).toEqual({ video: true, audio: true })
    })
  })

  describe('error handling', () => {
    it('should handle invalid offer format', async () => {
      webrtcHandler.handleConnection(mockSocket as any)

      mockSocket.emit('webrtc:call', {
        targetUserId: peerUser.id,
        offer: { invalid: 'format' }
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.hasEmitted('error')).toBe(true)
    })

    it('should handle missing target user', async () => {
      webrtcHandler.handleConnection(mockSocket as any)

      mockSocket.emit('webrtc:call', {
        offer: { type: 'offer', sdp: 'mock-sdp' }
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockSocket.hasEmitted('error')).toBe(true)
    })
  })
})
