// automation_testing/integration/posts.api.test.js

import request from 'supertest';
import express from 'express';
import postRoutes from '../../routes/posts.js';
import Post from '../../models/Post.js';
import User from '../../models/User.js'; // Needed for mocking populate
import { upload, handleUploadErrors } from '../../middlewares/upload.js';

// Helper to create chainable Mongoose mocks for integration tests
const createMockQuery = () => {
    const query = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn(), // This will be the final resolver for queries
    };
    return query;
};

// Mock Mongoose models with chainable methods
jest.mock('../../models/Post.js', () => {
    // This is the mock for the Post constructor (e.g., new Post())
    const mockPostConstructor = jest.fn().mockImplementation((data) => {
        const instance = {
            ...data,
            save: jest.fn().mockResolvedValue(true),
            toObject: jest.fn().mockReturnValue(data),
            // Mock user subdocument with equals method
            user: {
                equals: jest.fn((id) => id === (data.user?.id || data.user?._id)),
                id: data.user?.id || data.user?._id,
                _id: data.user?.id || data.user?._id,
            },
            // Mock comments array with .id() and .push()
            comments: (data.comments || []).map(c => ({ ...c, replies: c.replies || [] })), // Deep copy and ensure replies
            // Add .id() method to the comments array mock
            // This needs to be a function on the array-like object
            id: jest.fn(function(commentId) { // Use function keyword for 'this' context
                return this.find(c => c._id === commentId);
            }),
            push: jest.fn(function(comment) { // Use function keyword for 'this' context
                this.push(comment); // Push to the underlying array
            }),
        };

        // Make comments array-like and add the .id method to it
        Object.defineProperty(instance.comments, 'id', {
            value: jest.fn(function(commentId) {
                return instance.comments.find(c => c._id === commentId);
            }),
            writable: true,
            configurable: true,
        });
        Object.defineProperty(instance.comments, 'push', {
            value: jest.fn(function(comment) {
                Array.prototype.push.call(this, comment); // Call original push on the array
            }),
            writable: true,
            configurable: true,
        });


        return instance;
    });

    // This is the mock for the static methods (e.g., Post.find())
    mockPostConstructor.find = jest.fn(() => createMockQuery());
    mockPostConstructor.findById = jest.fn(() => createMockQuery());
    mockPostConstructor.findByIdAndUpdate = jest.fn(() => createMockQuery());
    mockPostConstructor.deleteOne = jest.fn(() => createMockQuery()); // If deleteOne is a static method

    return {
        __esModule: true,
        default: mockPostConstructor, // The default export is the constructor
        // Expose static methods directly
        find: mockPostConstructor.find,
        findById: mockPostConstructor.findById,
        findByIdAndUpdate: mockPostConstructor.findByIdAndUpdate,
        deleteOne: mockPostConstructor.deleteOne,
    };
});

jest.mock('../../models/User.js', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('../../middlewares/upload.js', () => ({
    upload: {
        array: jest.fn((fieldName, maxCount) => (req, res, next) => {
            req.files = req.body.mockFiles || [];
            next();
        }),
    },
    handleUploadErrors: jest.fn((err, req, res, next) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }
        next();
    }),
}));

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock the authenticate middleware for integration tests
app.use((req, res, next) => {
    req.user = { id: 'authenticatedUserId123', _id: 'authenticatedUserId123', username: 'authuser' };
    next();
});

app.use('/api/posts', postRoutes);


describe('Posts API Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Clear static method mocks and reset mockReturnThis chains
        Post.find.mockClear().mockImplementation(() => createMockQuery());
        Post.findById.mockClear().mockImplementation(() => createMockQuery());
        Post.findByIdAndUpdate.mockClear().mockImplementation(() => createMockQuery());
        Post.deleteOne.mockClear().mockImplementation(() => createMockQuery());
        Post.default.mockClear(); // Clear constructor mock
    });

    // --- /api/posts (POST) - createPost tests ---
    describe('POST /api/posts', () => {
        const postData = {
            content: 'My first post!',
            codeSnippet: JSON.stringify({ language: 'javascript', code: 'console.log("hello");' }),
        };
        const mockFiles = [{ path: 'http://cloudinary.com/image1.jpg' }];

        test('should create a new post with content and return 201 status', async () => {
            const mockPostInstance = {
                _id: 'newPostId123',
                user: { id: 'authenticatedUserId123', _id: 'authenticatedUserId123', equals: jest.fn().mockReturnValue(true) },
                content: postData.content,
                codeSnippet: JSON.parse(postData.codeSnippet),
                images: [],
                save: jest.fn().mockResolvedValue(true),
                toObject: jest.fn().mockReturnThis(),
                comments: { id: jest.fn(), push: jest.fn() }, // Mock comments array methods
                likes: [],
                deleteOne: jest.fn(),
            };
            Post.default.mockImplementation(() => mockPostInstance);

            const res = await request(app)
                .post('/api/posts')
                .set('Authorization', 'Bearer mockToken')
                .send(postData);

            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('message', 'Post created successfully');
            expect(res.body.post).toHaveProperty('_id', 'newPostId123');
            expect(Post.default).toHaveBeenCalledTimes(1);
            expect(Post.default.mock.calls[0][0].user).toEqual({ id: 'authenticatedUserId123', _id: 'authenticatedUserId123' });
            expect(mockPostInstance.save).toHaveBeenCalledTimes(1);
        });

        test('should create a new post with images and code snippet', async () => {
            const mockPostInstance = {
                _id: 'newPostId456',
                user: { id: 'authenticatedUserId123', _id: 'authenticatedUserId123', equals: jest.fn().mockReturnValue(true) },
                content: postData.content,
                codeSnippet: JSON.parse(postData.codeSnippet),
                images: mockFiles.map(f => f.path),
                save: jest.fn().mockResolvedValue(true),
                toObject: jest.fn().mockReturnThis(),
                comments: { id: jest.fn(), push: jest.fn() },
                likes: [],
                deleteOne: jest.fn(),
            };
            Post.default.mockImplementation(() => mockPostInstance);

            const res = await request(app)
                .post('/api/posts')
                .set('Authorization', 'Bearer mockToken')
                .field('content', postData.content)
                .field('codeSnippet', postData.codeSnippet)
                .field('mockFiles', JSON.stringify(mockFiles))
                .expect(201);

            expect(res.body).toHaveProperty('message', 'Post created successfully');
            expect(res.body.post).toHaveProperty('images', mockFiles.map(f => f.path));
            expect(Post.default).toHaveBeenCalledTimes(1);
            expect(Post.default.mock.calls[0][0].images).toEqual(mockFiles.map(f => f.path));
        });

        test('should return 500 if post creation fails', async () => {
            Post.default.mockImplementation(() => ({
                save: jest.fn().mockRejectedValue(new Error('DB error')),
            }));

            const res = await request(app)
                .post('/api/posts')
                .set('Authorization', 'Bearer mockToken')
                .send(postData);

            expect(res.statusCode).toEqual(500);
            expect(res.body).toHaveProperty('message', 'Error creating post : ');
            expect(res.body).toHaveProperty('error', 'DB error');
        });
    });

    // --- /api/posts (GET) - getAllPosts tests ---
    describe('GET /api/posts', () => {
        test('should return all posts with 200 status', async () => {
            const mockPosts = [{ _id: 'post1', content: 'Post 1' }, { _id: 'post2', content: 'Post 2' }];
            Post.find().exec.mockResolvedValue(mockPosts);

            const res = await request(app)
                .get('/api/posts')
                .expect(200);

            expect(res.body).toEqual(mockPosts);
            expect(Post.find).toHaveBeenCalledTimes(1);
            expect(Post.find().sort).toHaveBeenCalledWith({ createdAt: -1 });
            expect(Post.find().skip).toHaveBeenCalledWith(0);
            expect(Post.find().limit).toHaveBeenCalledWith(10);
        });

        test('should handle pagination for getAllPosts', async () => {
            const mockPosts = [{ _id: 'post11', content: 'Post 11' }];
            Post.find().exec.mockResolvedValue(mockPosts);

            const res = await request(app)
                .get('/api/posts?page=2&limit=5')
                .expect(200);

            expect(Post.find().skip).toHaveBeenCalledWith(5);
            expect(Post.find().limit).toHaveBeenCalledWith(5);
        });

        test('should return 500 if fetching posts fails', async () => {
            Post.find.mockImplementation(() => {
                const query = createMockQuery();
                query.exec.mockRejectedValue(new Error('DB error'));
                return query;
            });

            const res = await request(app)
                .get('/api/posts')
                .expect(500);

            expect(res.body).toHaveProperty('message', 'Error fetching posts');
            expect(res.body).toHaveProperty('error', 'DB error');
        });
    });

    // --- /api/posts/allmyposts (GET) - getPostsByUser tests ---
    describe('GET /api/posts/allmyposts', () => {
        test('should return posts by authenticated user with 200 status', async () => {
            const mockPosts = [{ _id: 'userPost1', content: 'My Post 1' }];
            Post.find().exec.mockResolvedValue(mockPosts);

            const res = await request(app)
                .get('/api/posts/allmyposts')
                .set('Authorization', 'Bearer mockToken')
                .expect(200);

            expect(res.body).toEqual(mockPosts);
            expect(Post.find).toHaveBeenCalledWith({ user: 'authenticatedUserId123' });
            expect(Post.find().sort).toHaveBeenCalledWith({ createdAt: -1 });
        });

        test('should return 401 if user ID not found in token', async () => {
            const tempApp = express();
            tempApp.use(express.json());
            tempApp.use(express.urlencoded({ extended: true }));

            // Temporarily override the mock authenticate middleware for this specific test
            tempApp.use('/api/posts', (req, res, next) => {
                req.user = undefined; // Simulate no user from middleware
                next();
            }, postRoutes);

            const res = await request(tempApp)
                .get('/api/posts/allmyposts')
                .set('Authorization', 'Bearer mockToken')
                .expect(401);

            expect(res.body).toHaveProperty('message', 'User ID not found in token. Authentication required.');
        });

        test('should return 500 if fetching user posts fails', async () => {
            Post.find.mockImplementation(() => {
                const query = createMockQuery();
                query.exec.mockRejectedValue(new Error('DB error'));
                return query;
            });

            const res = await request(app)
                .get('/api/posts/allmyposts')
                .set('Authorization', 'Bearer mockToken')
                .expect(500);

            expect(res.body).toHaveProperty('message', 'Error fetching posts by user');
            expect(res.body).toHaveProperty('error', 'DB error');
        });
    });

    // --- /api/posts/:postId (DELETE) - deletePost tests ---
    describe('DELETE /api/posts/:postId', () => {
        const postId = 'postToDelete123';
        const mockPostInstance = {
            _id: postId,
            user: { equals: jest.fn().mockReturnValue(true), id: 'authenticatedUserId123', _id: 'authenticatedUserId123' },
            deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
            save: jest.fn().mockResolvedValue(true),
            comments: { id: jest.fn(), push: jest.fn() },
            likes: [],
        };

        beforeEach(() => {
            mockPostInstance.user.equals.mockClear().mockReturnValue(true);
            mockPostInstance.deleteOne.mockClear().mockResolvedValue({ deletedCount: 1 });
            Post.findById.mockClear().mockImplementation(() => createMockQuery());
        });

        test('should delete a post if authorized and return 200 status', async () => {
            Post.findById().exec.mockResolvedValue(mockPostInstance);

            const res = await request(app)
                .delete(`/api/posts/${postId}`)
                .set('Authorization', 'Bearer mockToken')
                .expect(200);

            expect(res.body).toHaveProperty('message', 'Post deleted successfully');
            expect(Post.findById).toHaveBeenCalledWith(postId);
            expect(Post.findById().exec).toHaveBeenCalledTimes(1);
            expect(mockPostInstance.user.equals).toHaveBeenCalledWith('authenticatedUserId123');
            expect(mockPostInstance.deleteOne).toHaveBeenCalledWith({ _id: postId });
        });

        test('should return 404 if post not found', async () => {
            Post.findById().exec.mockResolvedValue(null);

            const res = await request(app)
                .delete(`/api/posts/${postId}`)
                .set('Authorization', 'Bearer mockToken')
                .expect(404);

            expect(res.body).toHaveProperty('message', 'Post not found');
            expect(Post.findById).toHaveBeenCalledWith(postId);
        });

        test('should return 403 if not authorized to delete post', async () => {
            mockPostInstance.user.equals.mockReturnValue(false);
            Post.findById().exec.mockResolvedValue(mockPostInstance);

            const res = await request(app)
                .delete(`/api/posts/${postId}`)
                .set('Authorization', 'Bearer mockToken')
                .expect(403);

            expect(res.body).toHaveProperty('message', 'You are not authorized to delete this post');
            expect(Post.findById).toHaveBeenCalledWith(postId);
            expect(mockPostInstance.user.equals).toHaveBeenCalledWith('authenticatedUserId123');
            expect(mockPostInstance.deleteOne).not.toHaveBeenCalled();
        });

        test('should return 500 if deleting post fails', async () => {
            mockPostInstance.user.equals.mockReturnValue(true);
            Post.findById().exec.mockResolvedValue(mockPostInstance);
            mockPostInstance.deleteOne.mockRejectedValue(new Error('DB error'));

            const res = await request(app)
                .delete(`/api/posts/${postId}`)
                .set('Authorization', 'Bearer mockToken')
                .expect(500);

            expect(res.body).toHaveProperty('message', 'Error deleting post');
            expect(res.body).toHaveProperty('error', 'DB error');
        });
    });

    // --- /api/posts/likepost/:postId (POST) - toggleLike tests ---
    describe('POST /api/posts/likepost/:postId', () => {
        const postId = 'postToLike123';
        const mockPostInstance = {
            _id: postId,
            likes: [],
            save: jest.fn().mockResolvedValue(true),
            comments: { id: jest.fn(), push: jest.fn() },
            user: { equals: jest.fn() }, // Add a mock user for this instance
        };

        beforeEach(() => {
            mockPostInstance.likes = [];
            mockPostInstance.save.mockClear().mockResolvedValue(true);
            Post.findById.mockClear().mockImplementation(() => createMockQuery());
        });

        test('should like a post if not already liked and return 200 status', async () => {
            Post.findById().exec.mockResolvedValue(mockPostInstance);

            const res = await request(app)
                .post(`/api/posts/likepost/${postId}`)
                .set('Authorization', 'Bearer mockToken')
                .expect(200);

            expect(res.body).toHaveProperty('message', 'Post liked');
            expect(res.body).toHaveProperty('likesCount', 1);
            expect(mockPostInstance.likes).toContain('authenticatedUserId123');
            expect(mockPostInstance.save).toHaveBeenCalledTimes(1);
        });

        test('should unlike a post if already liked and return 200 status', async () => {
            mockPostInstance.likes = ['authenticatedUserId123', 'otherUser'];
            Post.findById().exec.mockResolvedValue(mockPostInstance);

            const res = await request(app)
                .post(`/api/posts/likepost/${postId}`)
                .set('Authorization', 'Bearer mockToken')
                .expect(200);

            expect(res.body).toHaveProperty('message', 'Like removed');
            expect(res.body).toHaveProperty('likesCount', 1);
            expect(mockPostInstance.likes).not.toContain('authenticatedUserId123');
            expect(mockPostInstance.save).toHaveBeenCalledTimes(1);
        });

        test('should return 404 if post not found', async () => {
            Post.findById().exec.mockResolvedValue(null);

            const res = await request(app)
                .post(`/api/posts/likepost/${postId}`)
                .set('Authorization', 'Bearer mockToken')
                .expect(404);

            expect(res.body).toHaveProperty('message', 'Post not found');
            expect(Post.findById).toHaveBeenCalledWith(postId);
            expect(mockPostInstance.save).not.toHaveBeenCalled();
        });

        test('should return 500 if toggling like fails', async () => {
            Post.findById().exec.mockResolvedValue(mockPostInstance);
            mockPostInstance.save.mockRejectedValue(new Error('Save error'));

            const res = await request(app)
                .post(`/api/posts/likepost/${postId}`)
                .set('Authorization', 'Bearer mockToken')
                .expect(500);

            expect(res.body).toHaveProperty('message', 'Error toggling like');
            expect(res.body).toHaveProperty('error', 'Save error');
        });
    });

    // --- /api/posts/:postId/comment (POST) - addComment tests ---
    describe('POST /api/posts/:postId/comment', () => {
        const postId = 'postToComment123';
        const commentContent = 'This is a test comment.';
        const mockPostInstance = {
            _id: postId,
            comments: [], // This will be the actual array for comments
            save: jest.fn().mockResolvedValue(true),
            toObject: jest.fn().mockReturnThis(),
            likes: [],
            user: { equals: jest.fn() },
            deleteOne: jest.fn(),
        };
        // Manually add the .id and .push methods to the comments array
        Object.defineProperty(mockPostInstance.comments, 'id', {
            value: jest.fn(function(commentId) {
                return this.find(c => c._id === commentId);
            }),
            writable: true,
            configurable: true,
        });
        Object.defineProperty(mockPostInstance.comments, 'push', {
            value: jest.fn(function(comment) {
                Array.prototype.push.call(this, comment);
            }),
            writable: true,
            configurable: true,
        });

        beforeEach(() => {
            mockPostInstance.comments = []; // Reset comments for each test
            mockPostInstance.save.mockClear().mockResolvedValue(true);
            Post.findById.mockClear().mockImplementation(() => createMockQuery());
            mockPostInstance.comments.id.mockClear();
            mockPostInstance.comments.push.mockClear();
        });

        test('should add a comment to a post and return 200 status', async () => {
            Post.findById().exec.mockResolvedValue(mockPostInstance);

            const res = await request(app)
                .post(`/api/posts/${postId}/comment`)
                .set('Authorization', 'Bearer mockToken')
                .send({ content: commentContent })
                .expect(200);

            expect(mockPostInstance.comments.push).toHaveBeenCalledTimes(1);
            expect(mockPostInstance.comments[0]).toHaveProperty('user', 'authenticatedUserId123');
            expect(mockPostInstance.comments[0]).toHaveProperty('text', commentContent);
            expect(mockPostInstance.save).toHaveBeenCalledTimes(1);
            // The response body will contain the updated post, so check its comments
            expect(res.body.comments).toHaveLength(1);
            expect(res.body.comments[0]).toHaveProperty('user', 'authenticatedUserId123');
            expect(res.body.comments[0]).toHaveProperty('text', commentContent);
        });

        test('should return 404 if post not found', async () => {
            Post.findById().exec.mockResolvedValue(null);

            const res = await request(app)
                .post(`/api/posts/${postId}/comment`)
                .set('Authorization', 'Bearer mockToken')
                .send({ content: commentContent })
                .expect(404);

            expect(res.body).toHaveProperty('message', 'Post not found');
            expect(mockPostInstance.save).not.toHaveBeenCalled();
        });

        test('should return 500 if adding comment fails', async () => {
            Post.findById().exec.mockResolvedValue(mockPostInstance);
            mockPostInstance.save.mockRejectedValue(new Error('Save error'));

            const res = await request(app)
                .post(`/api/posts/${postId}/comment`)
                .set('Authorization', 'Bearer mockToken')
                .send({ content: commentContent })
                .expect(500);

            expect(res.body).toHaveProperty('message', 'Error adding comment');
            expect(res.body).toHaveProperty('error', 'Save error');
        });
    });

    // --- /api/posts/:postId/comments/:commentId (DELETE) - deleteComment tests ---
    describe('DELETE /api/posts/:postId/comments/:commentId', () => {
        const postId = 'postWithComment123';
        const commentId = 'commentToDelete456';
        const initialComments = [{ _id: commentId, user: 'authenticatedUserId123', text: 'Comment text' }];
        const mockPostWithComment = {
            _id: postId,
            comments: initialComments,
            save: jest.fn().mockResolvedValue(true),
            toObject: jest.fn().mockReturnThis(),
            likes: [],
            user: { equals: jest.fn() },
            deleteOne: jest.fn(),
        };

        beforeEach(() => {
            // Reset comments array for each test
            mockPostWithComment.comments = initialComments.map(c => ({ ...c })); // Deep copy
            mockPostWithComment.save.mockClear().mockResolvedValue(true);
            Post.findByIdAndUpdate.mockClear().mockImplementation(() => createMockQuery());
        });

        test('should delete a comment and return 200 status', async () => {
            Post.findByIdAndUpdate().exec.mockResolvedValue({
                ...mockPostWithComment,
                comments: mockPostWithComment.comments.filter(c => c._id !== commentId)
            });

            const res = await request(app)
                .delete(`/api/posts/${postId}/comments/${commentId}`)
                .set('Authorization', 'Bearer mockToken')
                .expect(200);

            expect(res.body).toHaveProperty('message', 'Comment deleted successfully');
            expect(res.body.post.comments).toHaveLength(0);
            expect(Post.findByIdAndUpdate).toHaveBeenCalledWith(
                postId,
                { $pull: { comments: { _id: commentId } } },
                { new: true }
            );
            expect(Post.findByIdAndUpdate().exec).toHaveBeenCalledTimes(1);
        });

        test('should return 404 if post not found', async () => {
            Post.findByIdAndUpdate().exec.mockResolvedValue(null);

            const res = await request(app)
                .delete(`/api/posts/${postId}/comments/${commentId}`)
                .set('Authorization', 'Bearer mockToken')
                .expect(404);

            expect(res.body).toHaveProperty('message', 'Post not found');
        });

        test('should return 500 if deleting comment fails', async () => {
            Post.findByIdAndUpdate().exec.mockRejectedValue(new Error('DB error'));

            const res = await request(app)
                .delete(`/api/posts/${postId}/comments/${commentId}`)
                .set('Authorization', 'Bearer mockToken')
                .expect(500);

            expect(res.body).toHaveProperty('message', 'Error deleting comment');
            expect(res.body).toHaveProperty('error', 'DB error');
        });
    });

    // --- /api/posts/:postId/comment/:commentId/replycomment (POST) - replyToComment tests ---
    describe('POST /api/posts/:postId/comment/:commentId/replycomment', () => {
        const postId = 'postWithCommentToReply123';
        const commentId = 'commentToReply456';
        const replyContent = 'This is a test reply.';
        const mockComment = {
            _id: commentId,
            user: 'someUser',
            text: 'Original comment',
            replies: [],
        };
        const mockPostInstance = {
            _id: postId,
            comments: [mockComment], // Ensure comments array is directly accessible
            save: jest.fn().mockResolvedValue(true),
            toObject: jest.fn().mockReturnThis(),
            likes: [],
            user: { equals: jest.fn() },
            deleteOne: jest.fn(),
        };
        // Manually add the .id method to the comments array
        Object.defineProperty(mockPostInstance.comments, 'id', {
            value: jest.fn(function(id) {
                return this.find(c => c._id === id);
            }),
            writable: true,
            configurable: true,
        });

        beforeEach(() => {
            mockComment.replies = []; // Reset replies for each test
            mockPostInstance.save.mockClear().mockResolvedValue(true);
            mockPostInstance.comments.id.mockClear();
            Post.findById.mockClear().mockImplementation(() => createMockQuery());
        });

        test('should add a reply to a comment and return 200 status', async () => {
            Post.findById().exec.mockResolvedValue(mockPostInstance);

            const res = await request(app)
                .post(`/api/posts/${postId}/comment/${commentId}/replycomment`)
                .set('Authorization', 'Bearer mockToken')
                .send({ content: replyContent })
                .expect(200);

            expect(res.body).toHaveProperty('message', 'Reply added successfully');
            expect(mockComment.replies).toHaveLength(1);
            expect(mockComment.replies[0]).toHaveProperty('user', 'authenticatedUserId123');
            expect(mockComment.replies[0]).toHaveProperty('text', replyContent);
            expect(mockPostInstance.save).toHaveBeenCalledTimes(1);
        });

        test('should return 404 if post not found', async () => {
            Post.findById().exec.mockResolvedValue(null);

            const res = await request(app)
                .post(`/api/posts/${postId}/comment/${commentId}/replycomment`)
                .set('Authorization', 'Bearer mockToken')
                .send({ content: replyContent })
                .expect(404);

            expect(res.body).toHaveProperty('message', 'Post not found');
            expect(mockPostInstance.save).not.toHaveBeenCalled();
        });

        test('should return 404 if comment not found', async () => {
            // Mock Post.findById to return a post, but its comments.id() returns null
            Post.findById().exec.mockResolvedValue({
                _id: postId,
                comments: { id: jest.fn().mockReturnValue(null) },
                save: jest.fn(),
            });

            const res = await request(app)
                .post(`/api/posts/${postId}/comment/nonExistentComment/replycomment`)
                .set('Authorization', 'Bearer mockToken')
                .send({ content: replyContent })
                .expect(404);

            expect(res.body).toHaveProperty('message', 'Comment not found');
            // Check that save was not called on the mock post instance
            expect(mockPostInstance.save).not.toHaveBeenCalled();
        });

        test('should return 500 if replying to comment fails', async () => {
            Post.findById().exec.mockResolvedValue(mockPostInstance);
            mockPostInstance.save.mockRejectedValue(new Error('Save error'));

            const res = await request(app)
                .post(`/api/posts/${postId}/comment/${commentId}/replycomment`)
                .set('Authorization', 'Bearer mockToken')
                .send({ content: replyContent })
                .expect(500);

            expect(res.body).toHaveProperty('message', 'Error replying to comment');
            expect(res.body).toHaveProperty('error', 'Save error');
        });
    });
});
