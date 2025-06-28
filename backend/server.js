import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './config/db.js'; // MongoDB connection
import redisClient from './config/redis.js'; // Redis connection

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Test Routes
app.get('/', (req, res) => {
    res.send('Welcome to DevConnect API');
});

// Redis Debug Route
app.get('/api/redis-debug', (req, res) => {
  res.json({
    redisUrl: process.env.REDIS_URL ? 
      process.env.REDIS_URL.replace(/:([^/]+)@/, ':*****@') : null,
    isReady: redisClient.isReady,
    config: {
      host: redisClient.options?.socket?.host,
      port: redisClient.options?.socket?.port,
      tls: redisClient.options?.socket?.tls
    }
  });
});

// This route checks both MongoDB and Redis connections
app.get('/api/health', async (req, res) => {
    if (!redisClient.isReady) {
        return res.status(503).json({ error: 'Redis not connected' });
    }

    try {
        await redisClient.set('test', 'success', { EX: 10 });
        const value = await redisClient.get('test');
        res.json({
            status: 'OK',
            mongo: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
            redis: redisClient.isReady ? 'Connected' : 'Disconnected',
            testValue: value
        });
    } catch (err) {
        res.status(500).json({
            error: err.message,
            redisStatus: redisClient.isReady
        });
    }
});




// Database connections
const startServer = async () => {
    try {
        // 1. Connect to MongoDB
        await connectDB();
        console.log('✅ MongoDB connected successfully');

        // 2. Connect to Redis (with fallback)
        // In your Redis connection block:
        try {
            console.log('Attempting Redis connection...');
            await redisClient.connect();

            // Verify connection works
            // Test connection
  const pingResponse = await redisClient.ping();
  console.log('Redis ping response:', pingResponse);
            console.log('✅ Redis connected and responsive');
        } catch (redisError) {
            console.error('❌ Redis connection failed:', {
                message: redisError.message,
                code: redisError.code,
                stack: redisError.stack
            });
        }

        // 3. Start Express server
        app.listen(PORT, () => {
            console.log(`🚀 Server running on  http://localhost:${PORT}`);
            console.log('🔍 Check /api/health for connection status');
        });

    } catch (error) {
        console.error('❌ Server startup failed:', error.message);
        process.exit(1);
    }
};

// Start the server
startServer();