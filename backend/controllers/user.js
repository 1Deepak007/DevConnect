import redisClient from "../config/redis.js";
import User from '../models/User.js';

const getProfile = async (req, res) => {
    const userId = req.params.id;
    try{
        const user = await User.findById(userId).select('-password');
        await redisClient.set(`user:${userId}:profile`, JSON.stringify(user), { EX: 60 * 60 }); // Cache for 1 hour
        res.status(200).json(user);
    }
    catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ message: "Error fetching user profile", error: error.message });
    }
}

export default getProfile;