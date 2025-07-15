import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisOptions = {
  url: process.env.REDIS_URL,
  socket: {
    tls: {
      servername: process.env.REDIS_HOST,
      rejectUnauthorized: false,
    },
    connectTimeout: 10000,
  },
};

// Regular client for normal commands (SET, GET, PUBLISH, etc.)
export const redisClient = createClient(redisOptions);

// Subscriber client (only for SUBSCRIBE)
export const redisSubscriber = createClient(redisOptions);

// Error handling for both
redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisSubscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));

redisClient.on('ready', () => console.log('✅ Redis client ready'));
redisSubscriber.on('ready', () => console.log('✅ Redis subscriber ready'));

export default redisClient;



// import { createClient } from 'redis';
// import dotenv from 'dotenv';

// dotenv.config();
// // Ensure environment variables are loaded
// if (!process.env.REDIS_URL || !process.env.REDIS_HOST || !process.env.REDIS_PASSWORD) {
//     throw new Error('Missing required environment variables for Redis connection');
// }

// const redisClient = createClient({
//   url: process.env.REDIS_URL,
//   socket: {
//     tls: {
//       servername: process.env.REDIS_HOST,
//       rejectUnauthorized: false
//     },
//     connectTimeout: 10000
//   }
// });

// redisClient.on('error', (err) => {
//   console.error('Redis Connection Error:', {
//     code: err.code,
//     message: err.message,
//     stack: err.stack
//   });
// });

// redisClient.on('connect', () => console.log('🔄 Connecting to Redis...'));
// redisClient.on('ready', () => console.log('✅ Redis authenticated'));
// redisClient.on('reconnecting', () => console.log('♻️ Redis reconnecting'));
// redisClient.on('end', () => console.log('❌ Redis connection closed'));

// export default redisClient;