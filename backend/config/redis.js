import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();
// Ensure environment variables are loaded
if (!process.env.REDIS_URL || !process.env.REDIS_HOST || !process.env.REDIS_PASSWORD) {
    throw new Error('Missing required environment variables for Redis connection');
}

const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: {
      servername: process.env.REDIS_HOST,
      rejectUnauthorized: false
    },
    connectTimeout: 10000
  }
});

redisClient.on('error', (err) => {
  console.error('Redis Connection Error:', {
    code: err.code,
    message: err.message,
    stack: err.stack
  });
});

redisClient.on('connect', () => console.log('🔄 Connecting to Redis...'));
redisClient.on('ready', () => console.log('✅ Redis authenticated'));
redisClient.on('reconnecting', () => console.log('♻️ Redis reconnecting'));
redisClient.on('end', () => console.log('❌ Redis connection closed'));

export default redisClient;