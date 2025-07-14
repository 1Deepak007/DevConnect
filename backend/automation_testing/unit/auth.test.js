// backend/automation_testing/unit/auth.test.js

// 1. Import the middleware we want to test
import authenticate from '../../middlewares/auth.js';
import jwt from 'jsonwebtoken';
import redisClient from '../../config/redis.js';
// 2. Import and mock its external dependencies
//    For ES Modules, when using jest.mock(), and especially with persistent
//    'require is not defined' errors, using `jest.createMockFromModule`
//    within the factory can sometimes resolve it.
//    We are mocking the 'default' export because we import them as:
//    `import jwt from 'jsonwebtoken';` and `import redisClient from '../../config/redis.js';`

jest.mock('jsonwebtoken', () => ({
    default: {
        verify: jest.fn(),
    },
}));

jest.mock('../../config/redis.js', () => ({
    default: {
        get: jest.fn(),
    },
}));

// 3. Describe block for the test suite
describe('authenticate middleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {
            headers: {}
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        mockNext = jest.fn();

        // Access mocked functions directly
        jwt.default.verify.mockClear();
        redisClient.default.get.mockClear();
    });
    // --- Test Cases ---

    // Test Case 1: No token provided
    test('should return 401 if no token is provided', async () => {
        await authenticate(mockReq, mockRes, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Access Denied. No token provided.' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    // Test Case 2: Invalid token (jwt.verify throws an error)
    test('should return 401 if token is invalid', async () => {
        mockReq.headers.authorization = 'Bearer invalidtokenstring';
        jwt.verify.mockImplementation(() => { // Use jwt.verify directly
            throw new Error('Invalid signature');
        });

        await authenticate(mockReq, mockRes, mockNext);

        expect(jwt.verify).toHaveBeenCalledWith('invalidtokenstring', process.env.JWT_SECRET);
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid token', error: 'Invalid signature' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    // Test Case 3: Token is valid but not found/doesn't match in Redis (simulating logout/invalidated session)
    test('should return 401 if token is valid but not found in Redis or does not match', async () => {
        const validToken = 'valid.jwt.token';
        const decodedPayload = { id: 'testUserId', username: 'testuser' };
        mockReq.headers.authorization = `Bearer ${validToken}`;

        jwt.verify.mockReturnValue(decodedPayload); // Use jwt.verify directly
        redisClient.get.mockResolvedValue(null); // Use redisClient.get directly

        await authenticate(mockReq, mockRes, mockNext);

        expect(jwt.verify).toHaveBeenCalledWith(validToken, process.env.JWT_SECRET);
        expect(redisClient.get).toHaveBeenCalledWith(`user:${decodedPayload.id}:token`);
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    // Test Case 4: Valid token, found in Redis, and matches
    test('should call next() and attach user to req if token is valid and found in Redis', async () => {
        const validToken = 'valid.jwt.token';
        const decodedPayload = { id: 'testUserId', username: 'testuser' };
        mockReq.headers.authorization = `Bearer ${validToken}`;

        jwt.verify.mockReturnValue(decodedPayload); // Use jwt.verify directly
        redisClient.get.mockResolvedValue(validToken); // Use redisClient.get directly

        await authenticate(mockReq, mockRes, mockNext);

        expect(jwt.verify).toHaveBeenCalledWith(validToken, process.env.JWT_SECRET);
        expect(redisClient.get).toHaveBeenCalledWith(`user:${decodedPayload.id}:token`);
        expect(mockReq.user).toEqual(decodedPayload);
        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockRes.status).not.toHaveBeenCalled();
        expect(mockRes.json).not.toHaveBeenCalled();
    });

    // Test Case 5: Token in Redis does not strictly match provided token (e.g., if token refresh or some alteration happened)
    test('should return 401 if stored token does not strictly match the provided token', async () => {
        const providedToken = 'valid.jwt.token.provided';
        const storedDifferentToken = 'valid.jwt.token.stored.different';
        const decodedPayload = { id: 'testUserId', username: 'testuser' };
        mockReq.headers.authorization = `Bearer ${providedToken}`;

        jwt.verify.mockReturnValue(decodedPayload);
        redisClient.get.mockResolvedValue(storedDifferentToken);

        await authenticate(mockReq, mockRes, mockNext);

        expect(jwt.verify).toHaveBeenCalledWith(providedToken, process.env.JWT_SECRET);
        expect(redisClient.get).toHaveBeenCalledWith(`user:${decodedPayload.id}:token`);
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    // Test Case 6: Test `req.headers.authorization` undefined but other headers exist
    test('should return 401 if authorization header is missing but other headers exist', async () => {
        mockReq.headers = { 'Content-Type': 'application/json' };

        await authenticate(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ message: 'Access Denied. No token provided.' });
        expect(mockNext).not.toHaveBeenCalled();
    });
});