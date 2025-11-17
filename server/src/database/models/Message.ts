import mongoose, { Schema, Document } from 'mongoose'

export interface IMessage extends Document {
  id: string
  roomId: string
  userId: string
  username: string
  text: string
  timestamp: number
  edited: boolean
  editedAt?: number
  reactions: Map<string, string[]>
  replyTo?: string
  attachments: Array<{
    id: string
    type: 'image' | 'file' | 'video'
    url: string
    filename: string
    size: number
    mimeType: string
  }>
}

const MessageSchema = new Schema<IMessage>({
  id: { type: String, required: true, unique: true, index: true },
  roomId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  text: { type: String, required: true, maxlength: 5000 },
  timestamp: { type: Number, required: true, index: true },
  edited: { type: Boolean, default: false },
  editedAt: { type: Number },
  reactions: {
    type: Map,
    of: [String],
    default: new Map()
  },
  replyTo: { type: String },
  attachments: [{
    id: String,
    type: { type: String, enum: ['image', 'file', 'video'] },
    url: String,
    filename: String,
    size: Number,
    mimeType: String
  }]
}, {
  timestamps: true
})

// Indexes for efficient queries
MessageSchema.index({ roomId: 1, timestamp: -1 })
MessageSchema.index({ userId: 1, timestamp: -1 })

export const Message = mongoose.model<IMessage>('Message', MessageSchema)
