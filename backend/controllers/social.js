import User from "../models/User.js";

export const followUser = async (req, res) => {
    const targetUser = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user);

    // Check if the user is already following
    if(targetUser._id === currentUser._id) {
        return res.status(400).json({ message: "You cannot follow yourself." });
    }
    if(currentUser.following.includes(targetUser._id)) {
        return res.status(400).json({ message: "You are already following this user." });
    }
    try{
        targetUser.followers.push(currentUser._id);
        currentUser.following.push(targetUser._id);

        await Promise.all([
            targetUser.save(),
            currentUser.save()
        ]);

        res.status(200).json({ message: "User followed successfully" });
    }
    catch(error){
        res.status(500).json({ message: "Error following user", error: error.message });
    }
}

