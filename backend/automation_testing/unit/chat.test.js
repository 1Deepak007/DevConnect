// automation_testing/unit/chat.test.js

import {
    createChat,
    sendMessage,
    getMessages,
    getChats,
    markAsRead
} from '../../controllers/chat.js';
// Import the models directly, Jest will handle the mocking
import Chat from '../../models/Chat.js';
import Message from '../../models/Message.js';

// Helper to create chainable Mongoose mocks
const createMockQuery = () => {
    const query = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn(), // This will be the final resolver
    };
    return query;
};

// Mock Mongoose models with chainable methods
// When you import Chat from '../../models/Chat.js', it imports the default export.
// So, we need to mock the default export as the constructor function.
jest.mock('../../models/Chat.js', () => {
    const mockChatConstructor = jest.fn().mockImplementation((data) => ({
        ...data,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue(data),
    }));

    // Attach static methods directly to the mock constructor
    mockChatConstructor.find = jest.fn(() => createMockQuery());
    mockChatConstructor.findById = jest.fn(() => createMockQuery());
    mockChatConstructor.findByIdAndUpdate = jest.fn(() => createMockQuery());

    // Ensure it's treated as an ES Module with a default export
    return {
        __esModule: true,
        default: mockChatConstructor,
    };
});

jest.mock('../../models/Message.js', () => {
    const mockMessageConstructor = jest.fn().mockImplementation((data) => ({
        ...data,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue(data),
    }));

    mockMessageConstructor.find = jest.fn(() => createMockQuery());
    mockMessageConstructor.findById = jest.fn(() => createMockQuery());
    mockMessageConstructor.findByIdAndUpdate = jest.fn(() => createMockQuery());
    mockMessageConstructor.updateOne = jest.fn(() => createMockQuery());

    return {
        __esModule: true,
        default: mockMessageConstructor,
    };
});


// Mock redisClient and the Express app's redis getter
const mockRedisClient = {
    publish: jest.fn().mockImplementation(() => Promise.resolve()),
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn()
};

const mockApp = {
    get: jest.fn((key) => {
        if (key === 'redis') {
            return mockRedisClient;
        }
        return undefined;
    }),
};

describe('Chat Controller Unit Tests', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        jest.clearAllMocks(); // Clears all mocks, including constructor mocks and their methods

        mockReq = {
            body: {},
            params: {},
            query: {},
            user: { _id: 'user123', username: 'testuser' }, // Mock authenticated user
            app: mockApp, // Attach the mocked app to req
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        mockNext = jest.fn();

        // Reset the mock implementations for the static methods of the models
        // This is crucial because mockClear() only clears call history, not implementations.
        // We need to re-set the mockImplementation to return a fresh chainable query object.
        Chat.find.mockImplementation(() => createMockQuery());
        Chat.findById.mockImplementation(() => createMockQuery());
        Chat.findByIdAndUpdate.mockImplementation(() => createMockQuery());

        Message.find.mockImplementation(() => createMockQuery());
        Message.findById.mockImplementation(() => createMockQuery());
        Message.findByIdAndUpdate.mockImplementation(() => createMockQuery());
        Message.updateOne.mockImplementation(() => createMockQuery());

        // Reset the constructor mocks to return new instances for each test
        Chat.mockImplementation((data) => ({
            ...data,
            save: jest.fn().mockResolvedValue(true),
            toObject: jest.fn().mockReturnValue(data),
        }));
        Message.mockImplementation((data) => ({
            ...data,
            save: jest.fn().mockResolvedValue(true),
            toObject: jest.fn().mockReturnValue(data),
        }));

        mockRedisClient.publish.mockClear();
    });

    // --- createChat tests ---
    describe('createChat', () => {
        test('should handle Redis publish failure gracefully', async () => {
    mockRedisClient.publish.mockRejectedValueOnce(new Error('Redis error'));
    
    await sendMessage(mockReq, mockRes);
    
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
        error: expect.stringContaining('Failed to send message')
    });
});

        test('should create a new chat and return 201 status', async () => {
            const chatData = {
                participants: ['user123', 'user456'],
                isGroup: false,
                groupName: null,
            };
            mockReq.body = chatData;

            // The mock implementation for Chat constructor is already set in beforeEach
            // It will return an object with a mock save method.

            await createChat(mockReq, mockRes);

            // Use Chat directly as it's the default export
            expect(Chat).toHaveBeenCalledWith(chatData);
            expect(Chat.mock.results[0].value.save).toHaveBeenCalledTimes(1); // Access save on the instance
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(Chat.mock.results[0].value);
        });

        test('should return 500 if chat creation fails', async () => {
            mockReq.body = { participants: ['user123', 'user456'] };
            Chat.mockImplementation(() => ({
                save: jest.fn().mockRejectedValue(new Error('DB error')),
                toObject: jest.fn(), // Always mock toObject if it might be called
            }));

            await createChat(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to create chat' });
        });

        test('should handle Redis publish failure gracefully', async () => {
            mockReq.body = { chatId: 'chat123', text: 'Hello' };
            mockRedisClient.publish.mockRejectedValue(new Error('Redis error'));

            await sendMessage(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(201); // Main operation should still succeed
        });
    });

    // --- sendMessage tests ---
    describe('sendMessage', () => {
        test('should send a message and return 201 status, and publish to Redis', async () => {
            const messageData = { chatId: 'chat123', text: 'Hello' };
            mockReq.body = messageData;
            mockReq.user._id = 'user123';

            const mockMessageInstance = {
                _id: 'msg1',
                chat: messageData.chatId,
                sender: mockReq.user._id,
                text: messageData.text,
                readBy: [mockReq.user._id],
                save: jest.fn().mockResolvedValue(true),
                toObject: jest.fn().mockReturnValue({
                    _id: 'msg1',
                    chat: messageData.chatId,
                    sender: mockReq.user._id,
                    text: messageData.text,
                    readBy: [mockReq.user._id],
                }),
            };
            Message.mockImplementation(() => mockMessageInstance);

            // Mock the findByIdAndUpdate on Chat to return a resolvable promise
            Chat.findByIdAndUpdate().exec.mockResolvedValue({});


            await sendMessage(mockReq, mockRes);

            expect(Message).toHaveBeenCalledWith({
                chat: messageData.chatId,
                sender: mockReq.user._id,
                text: messageData.text,
                readBy: [mockReq.user._id],
            });
            expect(mockMessageInstance.save).toHaveBeenCalledTimes(1);
            expect(Chat.findByIdAndUpdate).toHaveBeenCalledWith(messageData.chatId, { lastMessage: 'msg1' });
            expect(Chat.findByIdAndUpdate().exec).toHaveBeenCalledTimes(1);
            expect(mockRedisClient.publish).toHaveBeenCalledWith(
                `chat:${messageData.chatId}`,
                JSON.stringify({ ...mockMessageInstance.toObject(), eventType: 'new-message' })
            );
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(mockMessageInstance);
        });

        test('should return 500 if message sending fails', async () => {
            mockReq.body = { chatId: 'chat123', text: 'Hello' };
            mockReq.user._id = 'user123';
            Message.mockImplementation(() => ({
                save: jest.fn().mockRejectedValue(new Error('Save error')),
                toObject: jest.fn(),
            }));

            await sendMessage(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to send message : Save error' });
        });
    });

    // --- getMessages tests ---
    describe('getMessages', () => {
        test('should fetch messages for a chat and return 200 status', async () => {
            mockReq.params.chatId = 'chat123';
            mockReq.query.page = '1';
            const mockMessages = [{ _id: 'msg1', text: 'Hi' }, { _id: 'msg2', text: 'Hello' }];

            Message.find().exec.mockResolvedValue([...mockMessages]);

            await getMessages(mockReq, mockRes);

            expect(Message.find).toHaveBeenCalledWith({ chat: 'chat123' });
            expect(Message.find().sort).toHaveBeenCalledWith({ createdAt: -1 });
            expect(Message.find().skip).toHaveBeenCalledWith(0);
            expect(Message.find().limit).toHaveBeenCalledWith(20);
            expect(mockRes.json).toHaveBeenCalledWith(mockMessages.reverse());
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        test('should handle pagination correctly', async () => {
            mockReq.params.chatId = 'chat123';
            mockReq.query.page = '2';
            const mockMessages = [{ _id: 'msg21', text: 'Page 2 msg 1' }];

            Message.find().exec.mockResolvedValue(mockMessages);

            await getMessages(mockReq, mockRes);

            expect(Message.find().skip).toHaveBeenCalledWith(20);
            expect(mockRes.json).toHaveBeenCalledWith(mockMessages.reverse());
        });

        test('should return 500 if fetching messages fails', async () => {
            mockReq.params.chatId = 'chat123';
            Message.find.mockImplementation(() => {
                const query = createMockQuery();
                query.exec.mockRejectedValue(new Error('DB error'));
                return query;
            });

            await getMessages(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to fetch messages' });
        });
    });

    // --- getChats tests ---
    describe('getChats', () => {
        test('should fetch chats for a user and return 200 status', async () => {
            mockReq.user._id = 'user123';
            const mockChats = [{ _id: 'chat1', participants: ['user123', 'user456'] }];

            Chat.find().exec.mockResolvedValue(mockChats);

            await getChats(mockReq, mockRes);

            expect(Chat.find).toHaveBeenCalledWith({ participants: 'user123' });
            expect(Chat.find().populate).toHaveBeenCalledWith('participants', 'name profilePicture');
            expect(Chat.find().populate).toHaveBeenCalledWith('lastMessage');
            expect(mockRes.json).toHaveBeenCalledWith(mockChats);
        });

        test('should return 500 if fetching chats fails', async () => {
            mockReq.user._id = 'user123';
            Chat.find.mockImplementation(() => {
                const query = createMockQuery();
                query.exec.mockRejectedValue(new Error('DB error'));
                return query;
            });

            await getChats(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to fetch chats' });
        });
    });

    // --- markAsRead tests ---
    describe('markAsRead', () => {
        test('should mark a message as read and return 200 status, and publish to Redis', async () => {
            mockReq.params.chatId = 'chat123';
            mockReq.params.messageId = 'msg123';
            mockReq.user._id = 'user123';

            Message.updateOne().exec.mockResolvedValue({ acknowledged: true, modifiedCount: 1 });

            await markAsRead(mockReq, mockRes);

            expect(Message.updateOne).toHaveBeenCalledWith(
                { _id: 'msg123' },
                { $addToSet: { readBy: 'user123' } }
            );
            expect(Message.updateOne().exec).toHaveBeenCalledTimes(1);
            expect(mockRedisClient.publish).toHaveBeenCalledWith(
                `chat:chat123`,
                JSON.stringify({
                    eventType: 'message-read',
                    messageId: 'msg123',
                    readBy: 'user123',
                })
            );
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({ status: 'read' });
        });

        test('should return 500 if marking as read fails', async () => {
            mockReq.params.chatId = 'chat123';
            mockReq.params.messageId = 'msg123';
            mockReq.user._id = 'user123';

            Message.updateOne().exec.mockRejectedValue(new Error('Update failed'));

            await markAsRead(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to update read status' });
        });
    });
});