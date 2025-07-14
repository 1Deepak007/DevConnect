import User from "../models/User.js";

export const followUser = async (req, res) => {
    const id = req.params.id;
    console.log("Follow User ID: ", id);

    if (!id || id === "undefined") {
        return res.status(400).json({ message: "Error following user", error: "Invalid user ID" });
    }

    try {
        const targetUser = await User.findById(id);
        const currentUser = await User.findById(req.user.id || req.user._id);

        if (!targetUser || !currentUser) {
            return res.status(404).json({ message: "User not found" });
        }

        // Prevent following yourself
        if (targetUser._id.equals(currentUser._id)) {
            return res.status(400).json({ message: "You cannot follow yourself." });
        }

        // Already following?
        if (currentUser.following.includes(targetUser._id)) {
            return res.status(400).json({ message: "You are already following this user." });
        }

        targetUser.followers.push(currentUser._id);
        currentUser.following.push(targetUser._id);

        await Promise.all([
            targetUser.save(),
            currentUser.save()
        ]);

        res.status(200).json({ message: "User followed successfully" });

    } catch (error) {
        if (error.name === "CastError") {
            return res.status(400).json({ message: "Error following user", error: "Invalid user ID" });
        }
        res.status(500).json({ message: "Error following user", error: error.message });
    }
};

export const unfollowUser = async (req, res) => {
    const targetUser = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.id);
    console.log("Unfollow User ID: ", targetUser);
    console.log("Current User ID: ", currentUser);
    console.log(eval(targetUser == currentUser));

    // Check if the user is not following
    if(!currentUser.following.includes(targetUser._id)) {
        return res.status(400).json({ message: "You are not following this user." });
    }
    try{
        targetUser.followers = targetUser.followers.filter(follower => follower.toString() !== currentUser._id.toString());
        currentUser.following = currentUser.following.filter(following => following.toString() !== targetUser._id.toString());

        await Promise.all([
            targetUser.save(),
            currentUser.save()
        ]);

        res.status(200).json({ message: "User unfollowed successfully" });
    }
    catch(error){
        res.status(500).json({ message: "Error unfollowing user", error: error.message });
    }
};

export const getFollowers = async (req, res) => {
    // exrtact current user ID from jwt token
    const currentUserId = req.user.id || req.user._id;
    try {
        const currentUser = await User.findById(currentUserId).populate('followers', 'username email');
        
        if (!currentUser) {
            return res.status(404).json({ message: "Current user not found" });
        }

        res.status(200).json({
            followers: currentUser.followers,
            count: currentUser.followers.length
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching followers", error: error.message });
    }
}

export const getFollowing = async (req, res) => {
    const currentUserId = req.user.id || req.user._id;
    try {
        const currentUser = await User.findById(currentUserId).populate('following', 'username email');
        
        if (!currentUser) {
            return res.status(404).json({ message: "Current user not found" });
        }

        res.status(200).json({
            following: currentUser.following,
            count: currentUser.following.length
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching following", error: error.message });
    }
}

export const getSuggestions = async (req, res) => {
    const currentUserId = req.user.id || req.user._id;
    try {
        const currentUser = await User.findById(currentUserId);
        
        if (!currentUser) {
            return res.status(404).json({ message: "Current user not found" });
        }

        // Find users who are not followed by the current user and are not the current user
        const suggestions = await User.find({
            _id: { $ne: currentUserId, $nin: currentUser.following }
        }).select('username email').limit(10); // Limit to 10 suggestions

        res.status(200).json({
            suggestions,
            count: suggestions.length
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching suggestions", error: error.message });
    }
}