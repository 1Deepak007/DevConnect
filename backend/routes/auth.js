import express from 'express';
import { register, login, logout } from '../controllers/auth.js';
import authenticate from '../middlewares/auth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();    

// Rate limiting for auth routes (prevent brute force attacks)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,     // 15 minutes
  max: 20,                      // Limit each IP to 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later'
});

// Public routes
router.post('/register', 
  authLimiter,
  register
);

router.post('/login', 
  authLimiter,
  login
);

// Protected route (requires valid JWT)
router.post('/logout', 
  authenticate, 
  logout
);

export default router;