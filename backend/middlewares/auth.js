// JWT validation
import jwt from 'jsonwebtoken';
import redisClient from '../config/redis.js';

const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: "Access Denied. No token provided." });
    }
    else {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // console.log(`AUTH DEBUG: Token successfully verified. Decoded ID: ${decoded.id}`);

            
            // Check if the token is stored in Redis
            const storedToken = await redisClient.get(`user:${decoded.id}:token`);

            // console.log(`AUTH DEBUG: Stored Full Token from Redis: ${storedToken}`); // <-- Log the complete token retrieved from Redis
            // console.log(`AUTH DEBUG: Does storedToken exist? ${!!storedToken}`);
            // console.log(`AUTH DEBUG: Are the tokens strictly equal (storedToken === token)? ${storedToken === token}`);
            // console.log(`AUTH DEBUG: Length of Incoming Token: ${token.length}`);
            // console.log(`AUTH DEBUG: Length of Stored Token: ${storedToken ? storedToken.length : 'N/A'}`);


            if (!storedToken || storedToken !== token) {
                return res.status(401).json({ message: "Invalid or expired token" });
            }

            req.user = decoded.id;
            next(); // Proceed to the next middleware or route handler
        }
        catch (error) {
            // console.error("AUTH DEBUG: JWT Verification Failed (Error caught by jwt.verify):", error.message);
            res.status(401).json({ message: "Invalid token", error: error.message });
        }
    }
}
export default authenticate;