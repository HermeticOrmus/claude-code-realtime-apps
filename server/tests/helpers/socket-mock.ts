import { EventEmitter } from 'events'
import { Socket } from 'socket.io'

export class MockSocket extends EventEmitter {
  public id: string
  public data: any
  public rooms: Set<string>
  public handshake: any
  private emittedEvents: Array<{ event: string; data: any }> = []

  constructor(id: string = 'test-socket-id', userData?: any) {
    super()
    this.id = id
    this.data = userData || {
      user: {
        id: 'test-user-id',
        username: 'testuser'
      }
    }
    this.rooms = new Set([id]) // Socket always in its own room
    this.handshake = {
      auth: {},
      headers: {}
    }
  }

  emit(event: string, ...args: any[]): boolean {
    this.emittedEvents.push({ event, data: args })
    return super.emit(event, ...args)
  }

  async join(room: string): Promise<void> {
    this.rooms.add(room)
  }

  async leave(room: string): Promise<void> {
    this.rooms.delete(room)
  }

  disconnect(close?: boolean): this {
    this.emit('disconnect', close ? 'client namespace disconnect' : 'server namespace disconnect')
    return this
  }

  to(room: string): any {
    return {
      emit: (event: string, data: any) => {
        this.emittedEvents.push({ event, data })
      }
    }
  }

  getEmittedEvents(): Array<{ event: string; data: any }> {
    return this.emittedEvents
  }

  clearEmittedEvents(): void {
    this.emittedEvents = []
  }

  hasEmitted(event: string): boolean {
    return this.emittedEvents.some(e => e.event === event)
  }

  getLastEmittedEvent(event: string): any {
    const events = this.emittedEvents.filter(e => e.event === event)
    return events.length > 0 ? events[events.length - 1].data : null
  }
}

export class MockServer extends EventEmitter {
  public sockets: Map<string, MockSocket> = new Map()
  private emittedEvents: Array<{ room: string; event: string; data: any }> = []

  to(room: string): any {
    return {
      emit: (event: string, data: any) => {
        this.emittedEvents.push({ room, event, data })
      }
    }
  }

  in(room: string): any {
    return this.to(room)
  }

  addSocket(socket: MockSocket): void {
    this.sockets.set(socket.id, socket)
  }

  removeSocket(socketId: string): void {
    this.sockets.delete(socketId)
  }

  getEmittedToRoom(room: string, event: string): any[] {
    return this.emittedEvents
      .filter(e => e.room === room && e.event === event)
      .map(e => e.data)
  }

  clearEmittedEvents(): void {
    this.emittedEvents = []
  }
}
