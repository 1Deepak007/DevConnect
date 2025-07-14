import express from 'express';
import getProfile from '../controllers/user.js';

const userRoutes = express.Router();

userRoutes.get('/getprofile/:id', getProfile);



export default userRoutes;