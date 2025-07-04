import express from 'express';
import { signup, login, logout } from '../controllers/auth.js';
import authenticate from '../middlewares/auth.js';
import rateLimit from 'express-rate-limit';

const authRoutes = express.Router();    

// Rate limiting for auth routes (prevent brute force attacks)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,     // Temporary Block IP for 15 minutes Duration
  max: 20,                      // Limit each IP to 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later'
});

// Public routes
authRoutes.post('/signup', authLimiter, signup);

authRoutes.post('/login', authLimiter, login);

// Protected route (requires valid JWT)
authRoutes.post('/logout', authenticate, logout);

export default authRoutes;