import authenticate from "../middlewares/auth.js";
import { createPost, getAllPosts, getPostById, replyToComment, deletePost, getPostsByUser, toggleLike, addComment, deleteComment } from "../controllers/post.js";
import express from 'express';
import { handleUploadErrors, upload } from "../middlewares/upload.js";

const postRoutes = express.Router();

// Public routes
postRoutes.get('/', getAllPosts);               // Global feed (paginated)
// postRoutes.get('/:postId', getPostById);       // Single post view

// Protected routes
postRoutes.post('/', authenticate, upload.array('images', 3), handleUploadErrors, createPost);
postRoutes.get('/allmyposts', authenticate, getPostsByUser);
postRoutes.delete('/:postId', authenticate, deletePost);
postRoutes.post('/likepost/:postId', authenticate, toggleLike);
postRoutes.post('/:postId/comment', authenticate, addComment);
postRoutes.post('/:postId/comment/:commentId/replycomment', authenticate, replyToComment);
postRoutes.delete('/:postId/comments/:commentId', authenticate, deleteComment);


export default postRoutes;