import express from 'express';
import authenticate from '../middlewares/auth.js';
import { createChat, sendMessage, getMessages, getChats, markAsRead } from '../controllers/chat.js';

const chatRoutes = express.Router();

chatRoutes.post('/', authenticate, createChat);     // Create a new chat
chatRoutes.post('/:chatId/messages', authenticate, sendMessage); // Send a message in a chat
chatRoutes.get('/:chatId/messages', authenticate, getMessages);  // Get messages in a chat
chatRoutes.get('/', authenticate, getChats);        // Get all chats of user
chatRoutes.patch('/:chatId/messages/:messageId/read', authenticate, markAsRead); // Mark a message as read

export default chatRoutes;