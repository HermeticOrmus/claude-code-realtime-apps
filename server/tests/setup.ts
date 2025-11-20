import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Redis } from 'ioredis'

let mongoServer: MongoMemoryServer
let redisClient: Redis

// Setup before all tests
beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create()
  const mongoUri = mongoServer.getUri()

  await mongoose.connect(mongoUri)

  // Mock Redis for tests
  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    lazyConnect: true
  })

  // Don't actually connect Redis in tests, we'll mock it
  jest.mock('ioredis')
})

// Cleanup after each test
afterEach(async () => {
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }

  jest.clearAllMocks()
})

// Cleanup after all tests
afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()

  if (redisClient) {
    await redisClient.quit()
  }
})

// Increase timeout for setup
jest.setTimeout(30000)
