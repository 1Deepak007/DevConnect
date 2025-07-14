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
import postRoutes from './routes/post.js';
import chatRoutes from './routes/chat.js';
import jwt from 'jsonwebtoken';

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
app.use('/api/posts', postRoutes);
app.use('/api/chat', chatRoutes);


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

        io.use((socket, next) => {
            const token = socket.handshake.auth.token;
            jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
                if (err) return next(new Error('Unauthorized'));
                socket.userId = user.id;  // Attach user ID to socket
                next();
            });
        });

        io.on('connection', (socket) => {
            console.log(`New client connected: ${socket.id}`);
            // Join user-specific room
            socket.on('join-user-room', (userId) => {
                socket.join(`user-${userId}`);
                console.log(`UserId: ${userId} joined room`);
            })

            // Join chat room
            socket.on('join-chat', (chatId) => {
                socket.join(`chat:${chatId}`);
                console.log(`ChatId: ${chatId} joined room`);
            })

            // Send message
            socket.on('send-message', async (data) => {
                try {
                    redisClient.publish(`chat:${data.chatId}`, JSON.stringify(data));
                    // Track activity (optional)
                    redisClient.set(`user:${data.sender}:last-active`, Date.now(), { EX: 300 });
                } catch (err) {
                    console.error('Redis publish error:', err);
                }
            });

            // Typing indicator
            socket.on('typing-start', (chatId) => {
                socket.to(`chat:${chatId}`).emit('user-typing', { userId: socket.userId, chatId });
            });

            // Handle disconnections
            socket.on('disconnect', () => {
                redisClient.del(`socket:${socket.id}`); // Cleanup
            });
        });

        // Subscribe to Redis channel : means that the server will listen for messages on the Redis channel.
        redisClient.subscribe('chat:*'
            // , (err) => { if (err) console.log('Error subscribing to Redis channel:', err);}
        )

        redisClient.on('error', (err) => {
            console.error('Redis client error:', err);
        });

        redisClient.on('message', (channel, messageStr) => {
            const chatId = channel.split(':')[1];
            const { eventType, ...data } = JSON.parse(messageStr);
            // Emit the message to the chat room
            switch (eventType) {
                case 'new-message':
                    io.to(`chat:${chatId}`).emit('new-message', JSON.parse(messageStr));
                    break;
                case 'message-read':
                    io.to(`chat:${chatId}`).emit('message-read', JSON.parse(messageStr));
                    break;
                default:
                    console.log(`Unknown event type: ${eventType}`);
            }
        })

    } catch (error) {
        console.error('Server startup failed:', error.message);
        process.exit(1);
    }
};

// Set Redis client in app for use in routes/controllers
app.set('redis', redisClient);

// console.log('JWT Secret:', process.env.JWT_SECRET);
// console.log('Redis URL:', process.env.REDIS_URL);
// console.log('MongoDB URI:', process.env.MONGO_URI);

startServer();

