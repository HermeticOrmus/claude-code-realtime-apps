import mongoose from 'mongoose'
import { logger } from '../utils/logger'

export async function connectDatabase(): Promise<void> {
  try {
    const mongoUrl = process.env.MONGODB_URL || 'mongodb://admin:password123@localhost:27017/realtime?authSource=admin'

    await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    })

    logger.info('MongoDB connected successfully')

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error)
    })

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected')
    })

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected')
    })
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error)
    throw error
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect()
  logger.info('MongoDB disconnected')
}
