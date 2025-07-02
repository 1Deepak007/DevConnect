import User from '../models/User.js'
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export const register = async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }
    else {
        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }
        else {
            const hashedPassword = await bcrypt.hash(password, 10);
            try {
                // Create new user
                const newUser = new User({ username, email, password: hashedPassword });
                await newUser.save();
                // Generate JWT token
                const token = jwt.sign(
                    { id: newUser._id, username: newUser.username },
                    process.env.JWT_SECRET,
                    { expiresIn: "1d" }
                );
                return res.status(201).json({ message: "User registered successfully", token, user: { id: newUser._id, username, email } });
            }
            catch (error) {
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
                    return res.status(200).json({ message: "Login successful", token, user: { id: user._id, username: user.username, email: user.email } });
                }
            }
        } catch (error) {
            return res.status(500).json({ message: "Error logging in", error: error.message });
        }
    }
}

export const logout = async(req, res) => {
    try{
        await redisClient.del(`user:${req.user}:token`);
        res.status(200).json({ message: "User logged out successfully" });
    }
    catch(error){
        res.status(500).json({ message: "Error logging out", error: error.message });
    }
}
