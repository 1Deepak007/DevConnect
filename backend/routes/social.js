import express from "express";
import { followUser } from "../controllers/social.js";


const socialrouter = express.Router();

socialrouter.post('/follow/:id', followUser);

export default socialrouter;