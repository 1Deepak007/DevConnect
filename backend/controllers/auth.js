import User from '../models/User.js'
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import redisClient from "../config/redis.js";

export const signup = async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }
    else {
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }
        else {
            const hashedPassword = await bcrypt.hash(password, 10);
            try {
                const newUser = new User({ username, email, password: hashedPassword });
                await newUser.save();
                const token = jwt.sign(
                    { id: newUser._id, username: newUser.username },
                    process.env.JWT_SECRET,
                    { expiresIn: "1d" }
                );
                const decodedToken = jwt.decode(token);
                const tokenExpirationSeconds = decodedToken.exp - Math.floor(Date.now() / 1000);

                if(tokenExpirationSeconds > 0) {
                    await redisClient.setEx(`user:${newUser._id}:token`, tokenExpirationSeconds, token);
                    // console.log(`DEBUG (Signup): Token set in Redis for user:${newUser._id}`); // Added log
                }
                else{
                    console.warn("Generated token for signup has already expired or has no expiry time.");
                    return res.status(500).json({ message: "Generated token has already expired or has no expiry time." });
                }

                return res.status(201).json({ message: "User registered successfully", token, user: { id: newUser._id, username, email } });
            }
            catch (error) {
                console.error("Error creating user:", error);
                return res.status(500).json({ message: "Error creating user", error: error.message });
            }
        }
    }
}

export const login = async (req, res) => {
    const {email,password} = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }
    else {
        try {
            // Find user by email
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            else {
                // Check password
                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) {
                    return res.status(400).json({ message: "Invalid credentials" });
                }
                else {
                    // Generate JWT token
                    const token = jwt.sign(
                        { id: user._id, username: user.username },
                        process.env.JWT_SECRET,
                        { expiresIn: "1d" }
                    );
                    // Store token in Redis
                    const decodedToken = jwt.decode(token);
                    const tokenExpirationSeconds = decodedToken.exp - Math.floor(Date.now() / 1000);

                    // console.log(`DEBUG (Login): User ID for token storage: ${user._id}`);
                    // console.log(`DEBUG (Login): Token to store: ${token.substring(0, 30)}... (full length: ${token.length})`);
                    // console.log(`DEBUG (Login): Token expiration (seconds): ${tokenExpirationSeconds}`);

                    if(tokenExpirationSeconds > 0) {
                        const redisKey = `user:${user._id}:token`;
                        try {
                            await redisClient.setEx(redisKey, tokenExpirationSeconds, token);
                            // console.log(`DEBUG (Login): Successfully called setEx for key: ${redisKey}`);

                            // *** NEW CRITICAL DEBUGGING STEP: Immediately try to retrieve the token ***
                            // const retrievedTokenImmediately = await redisClient.get(redisKey);
                            // console.log(`DEBUG (Login): Token retrieved immediately after setEx: ${retrievedTokenImmediately ? retrievedTokenImmediately.substring(0, 30) + '...' : 'null'} (full length: ${retrievedTokenImmediately ? retrievedTokenImmediately.length : 'N/A'})`);
                            // console.log(`DEBUG (Login): Does immediately retrieved token match original? ${retrievedTokenImmediately === token}`);

                        } catch (redisErr) {
                            // console.error("ERROR (Login): Failed to setEx token in Redis:", redisErr);
                            return res.status(500).json({ message: "Error storing session token in Redis.", error: redisErr.message });
                        }
                    }
                    else{
                        console.warn("Generated token has already expired or has no expiry time.");
                        return res.status(500).json({ message: "Generated token has already expired or has no expiry time." });
                    }
                    return res.status(200).json({ message: "Login successful", token, user: { id: user._id, username: user.username, email: user.email } });
                }
            }
        } catch (error) {
            // console.error("Error logging in:", error);
            return res.status(500).json({ message: "Error logging in", error: error.message });
        }
    }
}

export const logout = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(400).json({ message: "User ID not found in request for logout." });
        }
        
        await redisClient.del(`user:${req.user}:token`);

        res.status(200).json({ message: "User logged out successfully" });
    }
    catch (error) {
        console.error("Error logging out:", error);
        res.status(500).json({ message: "Error logging out", error: error.message });
    }
}