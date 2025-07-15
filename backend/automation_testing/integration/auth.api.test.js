// automation_testing/integration/auth.api.test.js

import request from 'supertest';
import express from 'express';
import authRoutes from '../../routes/auth.js';
import User from '../../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import redisClient from '../../config/redis.js';

// Mock external dependencies for integration tests
jest.mock('../../models/User.js');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../../config/redis.js', () => ({
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
}));

// Create a mock Express app to test the routes
const app = express();
app.use(express.json());

// Mock the authenticate middleware's behavior for these integration tests
// This middleware is applied before the authRoutes, so it will run first.
app.use((req, res, next) => {
    // For tests where we want `req.user` to be populated, we'll set it here.
    // For tests where we want the middleware to fail (e.g., 401), we'll let it pass through
    // and the actual 'authenticate' middleware (if mounted) or a specific mock will handle it.
    // For simplicity in integration tests, we'll assume successful authentication unless explicitly overridden.
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        // Simulate successful JWT verification
        req.user = { id: 'authenticatedUserId123', _id: 'authenticatedUserId123', username: 'authuser' };
    } else {
        req.user = undefined; // No token, no user
    }
    next();
});

app.use('/api/auth', authRoutes);

// Mock process.env.JWT_SECRET for tests
process.env.JWT_SECRET = 'test_jwt_secret';

describe('Auth API Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        User.findOne.mockReset();
        User.prototype.save.mockReset();
        bcrypt.hash.mockReset();
        bcrypt.compare.mockReset();
        jwt.sign.mockReset();
        jwt.decode.mockReset();
        redisClient.get.mockReset();
        redisClient.setEx.mockReset();
        redisClient.del.mockReset();

        // Ensure jwt.verify is a mock function that can be controlled
        jwt.verify = jest.fn();
    });

    // --- /api/auth/signup tests ---
    describe('POST /api/auth/signup', () => {
        const userData = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123',
        };

        test('should register a new user and return 201 status with token', async () => {
            User.findOne.mockResolvedValue(null);
            bcrypt.hash.mockResolvedValue('hashedPassword123');
            jwt.sign.mockReturnValue('mockedToken');
            jwt.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });
            redisClient.setEx.mockResolvedValue('OK');

            User.mockImplementation(() => ({
                _id: 'newUserId123',
                username: userData.username,
                email: userData.email,
                password: 'hashedPassword123',
                save: jest.fn().mockResolvedValue(true),
            }));

            const res = await request(app)
                .post('/api/auth/signup')
                .send(userData);

            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('message', 'User registered successfully');
            expect(res.body).toHaveProperty('token', 'mockedToken');
            expect(res.body.user).toHaveProperty('id', 'newUserId123');
            expect(User.findOne).toHaveBeenCalledWith({ $or: [{ username: userData.username }, { email: userData.email }] });
            expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
            expect(User).toHaveBeenCalledTimes(1);
            expect(User.mock.results[0].value.save).toHaveBeenCalledTimes(1);
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: 'newUserId123', username: userData.username },
                process.env.JWT_SECRET,
                { expiresIn: '1d' }
            );
            expect(redisClient.setEx).toHaveBeenCalledWith(
                `user:newUserId123:token`,
                expect.any(Number),
                'mockedToken'
            );
        });

        test('should return 400 if user already exists (username)', async () => {
            User.findOne.mockResolvedValue({ username: userData.username });

            const res = await request(app)
                .post('/api/auth/signup')
                .send(userData);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('message', 'User already exists');
            expect(User.findOne).toHaveBeenCalledTimes(1);
            expect(bcrypt.hash).not.toHaveBeenCalled();
            expect(jwt.sign).not.toHaveBeenCalled();
        });

        test('should return 400 if user already exists (email)', async () => {
            User.findOne.mockResolvedValue({ email: userData.email });

            const res = await request(app)
                .post('/api/auth/signup')
                .send(userData);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('message', 'User already exists');
        });

        test('should return 400 if required fields are missing', async () => {
            const res = await request(app)
                .post('/api/auth/signup')
                .send({ username: 'testuser', email: 'test@example.com' });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('message', 'All fields are required');
            expect(User.findOne).not.toHaveBeenCalled();
        });

        test('should return 500 if user creation fails (e.g., DB error)', async () => {
            User.findOne.mockResolvedValue(null);
            bcrypt.hash.mockResolvedValue('hashedPassword123');
            User.mockImplementation(() => ({
                save: jest.fn().mockRejectedValue(new Error('DB connection error')),
            }));

            const res = await request(app)
                .post('/api/auth/signup')
                .send(userData);

            expect(res.statusCode).toEqual(500);
            expect(res.body).toHaveProperty('message', 'Error creating user');
            expect(res.body).toHaveProperty('error', 'DB connection error');
        });
    });

    // --- /api/auth/login tests ---
    describe('POST /api/auth/login', () => {
        const loginData = {
            email: 'test@example.com',
            password: 'password123',
        };
        const mockUser = {
            _id: 'existingUserId123',
            username: 'testuser',
            email: loginData.email,
            password: 'hashedPassword123',
        };

        test('should log in user and return 200 status with token', async () => {
            User.findOne.mockResolvedValue(mockUser);
            bcrypt.compare.mockResolvedValue(true);
            jwt.sign.mockReturnValue('mockedToken');
            jwt.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });
            redisClient.setEx.mockResolvedValue('OK');

            const res = await request(app)
                .post('/api/auth/login')
                .send(loginData);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('message', 'Login successful');
            expect(res.body).toHaveProperty('token', 'mockedToken');
            expect(res.body.user).toHaveProperty('id', 'existingUserId123');
            expect(User.findOne).toHaveBeenCalledWith({ email: loginData.email });
            expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, mockUser.password);
            expect(jwt.sign).toHaveBeenCalledWith(
                { id: mockUser._id, username: mockUser.username },
                process.env.JWT_SECRET,
                { expiresIn: '1d' }
            );
            expect(redisClient.setEx).toHaveBeenCalledWith(
                `user:${mockUser._id}:token`,
                expect.any(Number),
                'mockedToken'
            );
        });

        test('should return 400 if email or password are missing', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com' });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('message', 'Email and password are required');
            expect(User.findOne).not.toHaveBeenCalled();
        });

        test('should return 404 if user not found', async () => {
            User.findOne.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/auth/login')
                .send(loginData);

            expect(res.statusCode).toEqual(404);
            expect(res.body).toHaveProperty('message', 'User not found');
            expect(User.findOne).toHaveBeenCalledWith({ email: loginData.email });
            expect(bcrypt.compare).not.toHaveBeenCalled();
        });

        test('should return 400 if invalid credentials (wrong password)', async () => {
            User.findOne.mockResolvedValue(mockUser);
            bcrypt.compare.mockResolvedValue(false);

            const res = await request(app)
                .post('/api/auth/login')
                .send(loginData);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('message', 'Invalid credentials');
            expect(User.findOne).toHaveBeenCalledWith({ email: loginData.email });
            expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, mockUser.password);
            expect(jwt.sign).not.toHaveBeenCalled();
        });

        test('should return 500 if login process fails (e.g., DB error)', async () => {
            User.findOne.mockRejectedValue(new Error('DB error'));

            const res = await request(app)
                .post('/api/auth/login')
                .send(loginData);

            expect(res.statusCode).toEqual(500);
            expect(res.body).toHaveProperty('message', 'Error logging in');
            expect(res.body).toHaveProperty('error', 'DB error');
        });
    });

    // --- /api/auth/logout tests ---
    describe('POST /api/auth/logout', () => {
        const mockToken = 'valid.jwt.token';
        const mockUserId = 'testUserId123';

        test('should log out user and return 200 status', async () => {
            // Ensure the mock middleware sets req.user correctly for this test
            // This is handled by the general app.use mock above.
            redisClient.del.mockResolvedValue(1);

            const res = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${mockToken}`)
                .send();

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('message', 'User logged out successfully');
            expect(redisClient.del).toHaveBeenCalledWith(`user:${mockUserId}:token`);
        });

        test('should return 401 if authentication middleware fails', async () => {
    jwt.verify.mockImplementation(() => { throw new Error('Invalid signature'); });
    
    const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalidToken')
        .expect(401);
    
    expect(res.body).toHaveProperty('message', 'Invalid token');
});


        test('should return 500 if logout process fails (e.g., Redis error)', async () => {
            // Ensure the mock middleware sets req.user correctly for this test
            redisClient.del.mockRejectedValue(new Error('Redis connection lost'));

            const res = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${mockToken}`)
                .send();

            expect(res.statusCode).toEqual(500);
            expect(res.body).toHaveProperty('message', 'Error logging out');
            expect(res.body).toHaveProperty('error', 'Redis connection lost');
            expect(redisClient.del).toHaveBeenCalledWith(`user:${mockUserId}:token`);
        });
    });
});
