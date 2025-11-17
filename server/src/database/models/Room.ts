import mongoose, { Schema, Document } from 'mongoose'

export interface IRoom extends Document {
  id: string
  name: string
  type: 'direct' | 'group' | 'channel'
  participants: string[]
  createdBy: string
  createdAt: number
  updatedAt: number
  lastMessage?: {
    text: string
    userId: string
    timestamp: number
  }
}

const RoomSchema = new Schema<IRoom>({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['direct', 'group', 'channel'], required: true },
  participants: [{ type: String, required: true, index: true }],
  createdBy: { type: String, required: true },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
  lastMessage: {
    text: String,
    userId: String,
    timestamp: Number
  }
}, {
  timestamps: true
})

// Indexes for efficient queries
RoomSchema.index({ participants: 1 })
RoomSchema.index({ type: 1, updatedAt: -1 })

export const Room = mongoose.model<IRoom>('Room', RoomSchema)
