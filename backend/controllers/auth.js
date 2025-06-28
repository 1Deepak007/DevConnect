import User from "../models/User";
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