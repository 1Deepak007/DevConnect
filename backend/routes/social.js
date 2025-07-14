import express from "express";
import { followUser, unfollowUser, getFollowers, getFollowing, getSuggestions } from "../controllers/social.js";
import authenticate from "../middlewares/auth.js";


const socialrouter = express.Router();

socialrouter.post('/follow/:id', authenticate, followUser);
socialrouter.post('/unfollow/:id', authenticate, unfollowUser);
socialrouter.get('/followers', authenticate, getFollowers);
socialrouter.get('/following', authenticate, getFollowing);
socialrouter.get('/suggestions', authenticate, getSuggestions);  // Get follow user suggestions

export default socialrouter;