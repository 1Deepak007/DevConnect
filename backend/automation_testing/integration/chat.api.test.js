// automation_testing/integration/chat.api.test.js

import request from 'supertest';
import express from 'express';
import chatRoutes from '../../routes/chat.js';
import Chat from '../../models/Chat.js';
import Message from '../../models/Message.js';
import jwt from 'jsonwebtoken';
import { redisClient } from '../../config/redis.js';

// Mock the same models as in your unit tests
jest.mock('../../models/Chat.js', () => {
    const mockChatConstructor = jest.fn().mockImplementation((data) => ({
        ...data,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue(data),
    }));

    mockChatConstructor.find = jest.fn(() => ({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn(),
    }));

    mockChatConstructor.findByIdAndUpdate = jest.fn(() => ({
        exec: jest.fn(),
    }));

    return mockChat; 
});

jest.mock('../../models/Message.js', () => {
    const mockMessageConstructor = jest.fn().mockImplementation((data) => ({
        ...data,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue(data),
    }));

    mockMessageConstructor.find = jest.fn(() => ({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn(),
    }));

    mockMessageConstructor.updateOne = jest.fn(() => ({
        exec: jest.fn(),
    }));

    return {
        __esModule: true,
        default: mockMessageConstructor,
    };
});

// Mock Redis client
jest.mock('../../config/redis.js', () => ({
    redisClient: {
        publish: jest.fn(),
        get: jest.fn(),
        setEx: jest.fn(),
        del: jest.fn(),
    },
}));

// Mock JWT
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn(),
}));

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
    req.user = { _id: 'user123', username: 'testuser' };
    next();
});

app.use('/api/chat', chatRoutes);

describe('Chat API Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default mock implementations
        Chat.default.mockImplementation((data) => ({
            ...data,
            save: jest.fn().mockResolvedValue(true),
            toObject: jest.fn().mockReturnValue(data),
        }));

        Message.default.mockImplementation((data) => ({
            ...data,
            save: jest.fn().mockResolvedValue(true),
            toObject: jest.fn().mockReturnValue(data),
        }));

        // Setup default query results
        Chat.find().exec.mockResolvedValue([]);
        Message.find().exec.mockResolvedValue([]);
        Chat.findByIdAndUpdate().exec.mockResolvedValue({});
        Message.updateOne().exec.mockResolvedValue({ acknowledged: true });
    });

    // --- POST /api/chat ---
    describe('POST /api/chat', () => {
        test('should create a new chat and return 201 status', async () => {
            const chatData = {
                participants: ['user123', 'user456'],
                isGroup: false,
                groupName: null,
            };

            const mockChat = {
                _id: 'chat123',
                ...chatData,
            };

            Chat.default.mockImplementationOnce(() => ({
                ...mockChat,
                save: jest.fn().mockResolvedValue(true),
                toObject: jest.fn().mockReturnValue(mockChat),
            }));

            const res = await request(app)
                .post('/api/chat')
                .send(chatData);

            expect(res.statusCode).toBe(201);
            expect(res.body).toMatchObject(chatData);
            expect(Chat.default).toHaveBeenCalledWith(chatData);
        });

        test('should return 500 if chat creation fails', async () => {
            Chat.default.mockImplementationOnce(() => ({
                save: jest.fn().mockRejectedValue(new Error('DB error')),
            }));

            const res = await request(app)
                .post('/api/chat')
                .send({ participants: ['user123'] });

            expect(res.statusCode).toBe(500);
            expect(res.body).toHaveProperty('error');
        });

        test('should return empty array if user has no chats', async () => {
            Chat.find().exec.mockResolvedValue([]);

            const res = await request(app)
                .get('/api/chat')
                .expect(200);

            expect(res.body).toEqual([]);
        });
    });


    // --- POST /api/chat/:chatId/messages ---
    describe('POST /api/chat/:chatId/messages', () => {
        test('should send a message and return 201 status', async () => {
            const messageData = {
                text: 'Hello world',
            };

            const mockMessage = {
                _id: 'msg123',
                chat: 'chat123',
                sender: 'user123',
                text: messageData.text,
                readBy: ['user123'],
            };

            Message.default.mockImplementationOnce(() => ({
                ...mockMessage,
                save: jest.fn().mockResolvedValue(true),
                toObject: jest.fn().mockReturnValue(mockMessage),
            }));

            const res = await request(app)
                .post('/api/chat/chat123/messages')
                .send(messageData);

            expect(res.statusCode).toBe(201);
            expect(res.body).toMatchObject({
                chat: 'chat123',
                sender: 'user123',
                text: messageData.text,
            });
            expect(redisClient.publish).toHaveBeenCalled();
        });

        test('should return 500 if message sending fails', async () => {
            Message.default.mockImplementationOnce(() => ({
                save: jest.fn().mockRejectedValue(new Error('DB error')),
            }));

            const res = await request(app)
                .post('/api/chat/chat123/messages')
                .send({ text: 'Hello' });

            expect(res.statusCode).toBe(500);
            expect(res.body).toHaveProperty('error');
        });
    });

    // --- GET /api/chat/:chatId/messages ---
    describe('GET /api/chat/:chatId/messages', () => {
        test('should fetch messages for a chat and return 200 status', async () => {
            const mockMessages = [
                { _id: 'msg1', text: 'Hi', createdAt: new Date() },
                { _id: 'msg2', text: 'Hello', createdAt: new Date() },
            ];

            Message.find().exec.mockResolvedValue(mockMessages);

            const res = await request(app)
                .get('/api/chat/chat123/messages');

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(Message.find).toHaveBeenCalledWith({ chat: 'chat123' });
        });

        test('should handle pagination parameters', async () => {
            Message.find().exec.mockResolvedValue([]);

            const res = await request(app)
                .get('/api/chat/chat123/messages?page=2&limit=5');

            expect(Message.find().skip).toHaveBeenCalledWith(5);
            expect(Message.find().limit).toHaveBeenCalledWith(5);
        });
    });

    // --- GET /api/chat ---
    describe('GET /api/chat', () => {
        test('should fetch user chats and return 200 status', async () => {
            const mockChats = [
                { _id: 'chat1', participants: ['user123', 'user456'] },
            ];

            Chat.find().exec.mockResolvedValue(mockChats);

            const res = await request(app)
                .get('/api/chat');

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(Chat.find).toHaveBeenCalledWith({ participants: 'user123' });
        });
    });

    // --- PATCH /api/chat/:chatId/messages/:messageId/read ---
    describe('PATCH /api/chat/:chatId/messages/:messageId/read', () => {
        test('should mark message as read and return 200 status', async () => {
            Message.updateOne().exec.mockResolvedValue({ acknowledged: true });

            const res = await request(app)
                .patch('/api/chat/chat123/messages/msg123/read');

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('status', 'read');
            expect(redisClient.publish).toHaveBeenCalled();
        });
    });
});