import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import redisClient from './config/redis.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import socialrouter from './routes/social.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? process.env.CLIENT_URL
        : 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());


// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('⚠️ Server error:', err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : null
    });
});


// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/social', socialrouter);


// Routes
app.get('/', (req, res) => {
    res.send('Welcome to DevConnect API');
});

// Health Check
app.get('/api/health', async (req, res) => {
    try {
        await redisClient.set('healthcheck', 'ok', { EX: 10 });
        const value = await redisClient.get('healthcheck');

        res.json({
            status: 'OK',
            mongo: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
            redis: value === 'ok' ? 'Connected' : 'Disconnected',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(503).json({
            status: 'Service Unavailable',
            error: err.message
        });
    }
});


// Database and Server Initialization
const startServer = async () => {
    try {
        // 1. Connect to MongoDB
        await connectDB();
        console.log('✅ MongoDB connected successfully');

        // 2. Connect to Redis
        await redisClient.connect();
        console.log('✅ Redis connected successfully');

        // 3. Start Express Server
        const server = app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log('Health check at /api/health');
        });

        // 4. Socket.IO Setup
        const io = new Server(server, {
            cors: {
                origin: process.env.CLIENT_URL || 'http://localhost:3000',
                methods: ['GET', 'POST']
            }
        });

        io.on('connection', (socket) => {
            console.log(`New client connected: ${socket.id}`);

            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
            });
        });

    } catch (error) {
        console.error('Server startup failed:', error.message);
        process.exit(1);
    }
};

// console.log('JWT Secret:', process.env.JWT_SECRET);
// console.log('Redis URL:', process.env.REDIS_URL);
// console.log('MongoDB URI:', process.env.MONGO_URI);

startServer();

