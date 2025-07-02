// JWT validation
import jwt from 'jsonwebtoken';
import redisClient from '../config/redis.js';

const authenticate = async(req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: "Access Denied. No token provided." });
    }
    else{
        try{
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // Check if the token is stored in Redis
            const storedToken = await redisClient.get(`user : ${decoded.id} : token`);
            
            
            req.user = decoded.id;
            next(); // Proceed to the next middleware or route handler
        }
        catch (error) {
            res.status(401).json({ message: "Invalid token", error: error.message });
        }
    }
}
export default authenticate;