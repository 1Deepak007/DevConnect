import Post from '../models/Post.js';


// create a new post (user,content,codeSnippet,image,likes,comments,timestamps)
export const createPost = async (req, res) => {
    try {
        const { content, codeSnippet } = req.body;
        const userid = req.user.id || req.user._id;    // from jwt token

        const newPost = new Post({
            user: userid,
            content: content,
            codeSnippet: codeSnippet ? JSON.parse(codeSnippet) : null,
            images: req.files?.map(file => file.path) || [],  // Cloudinary URL as using cloudinary for image upload/storage of posts
        });
        await newPost.save();
        res.status(201).json({
            message: "Post created successfully",
            post: newPost
        });
    }
    catch (error) {
        console.error("Error creating post : ", error);
        res.status(500).json({ message: "Error creating post :  ", error: error.message });
    }
}

// Get all posts (paginated)
export const getAllPosts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Default to page 1
        const limit = 10; // Default to 10 posts per page
        const skip = (page - 1) * limit;

        const posts = await Post.find()
            .populate('user', 'username avatar') // Populate user details
            .sort({ createdAt: -1 }) // Sort by creation date, newest first
            .skip(skip)
            .limit(limit);

        res.json(posts);
    }
    catch (error) {
        console.error("Error fetching posts: ", error);
        res.status(500).json({ message: "Error fetching posts", error: error.message });
    }
}

// Get all posts by a specific user
export const getPostsByUser = async (req, res) => {
    try {
        // userId comes from the JWT token, which 'authenticate' middleware adds to req.user
        const userId = req.user.id;

        if (!userId) {
            return res.status(401).json({ message: "User ID not found in token. Authentication required." });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const posts = await Post.find({ user: userId }) // This is correct: query by the user's ObjectId
            .populate('user', 'username avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json(posts);
    } catch (error) {
        console.error("Error fetching posts by user: ", error);
        res.status(500).json({ message: "Error fetching posts by user", error: error.message });
    }
}


// Get a single post by ID
export const getPostById = async (req, res) => {
    try {
        const postId = req.params.postId;
        const post = await Post.findById(postId)
            .populate('user', 'username avatar') // Populate user details
            .populate('comments.user', 'username avatar'); // Populate comment user details

        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        res.json(post);
    } catch (error) {
        console.error("Error fetching post by ID: ", error);
        res.status(500).json({ message: "Error fetching post", error: error.message });
    }
}

// Delete a post
export const deletePost = async (req, res) => {
    try {
        const postId = req.params.postId;
        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        if (!post.user.equals(req.user.id || req.user._id)) {
            return res.status(403).json({ message: "You are not authorized to delete this post" });
        }
        await post.deleteOne({ _id: postId });
        res.json({ message: "Post deleted successfully" });
    } catch (error) {
        console.error("Error deleting post: ", error);
        res.status(500).json({ message: "Error deleting post", error: error.message });
    }
}

// Toggle like on a post
export const toggleLike = async (req, res) => {
    try {
        const postId = req.params.postId;
        const post = await Post.findById(postId);

        console.log("Post ID: ", postId);
        console.log("User ID: ", req.user);

        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        const userId = req.user.id || req.user._id;

        const alreadyLiked = post.likes.some(id => id.toString() === userId);

        if (alreadyLiked) {
            post.likes = post.likes.filter(id => id.toString() !== userId);
        } else {
            post.likes.push(userId);
        }

        await post.save();

        res.json({
            message: alreadyLiked ? "Like removed" : "Post liked",
            likesCount: post.likes.length,
            post
        });
    } catch (error) {
        console.error("Error toggling like: ", error);
        res.status(500).json({ message: "Error toggling like", error: error.message });
    }
};


// Add a comment to a post
export const addComment = async (req, res) => {
    try {
        const postId = req.params.postId;
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        const { content } = req.body;
        const newComment = { user: req.user.id || req.user._id, text: content };
        post.comments.push(newComment);
        await post.save();
        res.json(post);
    } catch (error) {
        console.error("Error adding comment: ", error);
        res.status(500).json({ message: "Error adding comment", error: error.message });
    }
}

// Delete a comment from a post
export const deleteComment = async (req, res) => {
    const { postId, commentId } = req.params;
    const post = await Post.findById(postId);
    const comment = post.comments.id(commentId);

    console.log("Post ID: ", postId);
    console.log("Comment ID: ", commentId);
    console.log("User ID: ", req.user.id);
    console.log("Post : ", post);

    try {
        const updatedPost = await Post.findByIdAndUpdate(
            postId,
            // Remove the comment from the post ($pull removes the comment with the specified ID from the comments array)
            { $pull: { comments: { _id: commentId } } },
            { new: true } // Return the updated post
        )
            .populate('user', 'username avatar')
            .populate('comments.user', 'username avatar');

        if (!updatedPost) {
            return res.status(404).json({ message: "Post not found" });
        }

        res.json({
            message: "Comment deleted successfully",
            post: updatedPost
        });
    }
    catch (error) {
        console.error("Error deleting comment: ", error);
        res.status(500).json({ message: "Error deleting comment", error: error.message });
    }
}

// Reply to a comment on a post
export const replyToComment = async (req, res) => {
    const { postId, commentId } = req.params;
    const { content } = req.body;

    try {
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        const comment = post.comments.id(commentId);
        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }

        const reply = {
            user: req.user.id || req.user._id,
            text: content,
            createdAt: new Date()
        };

        if (!comment.replies) {
            comment.replies = [];
        }
        
        comment.replies.push(reply);

        await post.save();
        res.json({
            message: "Reply added successfully",
            post
        });
    } catch (error) {
        console.error("Error replying to comment: ", error);
        res.status(500).json({ message: "Error replying to comment", error: error.message });
    }
}

// Like a comment on a post
export const likeComment = async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }
        else if (!post.comments.id(commentId)) {
            return res.status(404).json({ message: "Comment not found" });
        }
        else {
            const comment = post.comments.id(commentId);
            const userId = req.user.id || req.user._id;

            if (comment.likes.includes(userId)) {
                comment.likes = comment.likes.filter(id => id.toString() !== userId);
            } else {
                comment.likes.push(userId);
            }

            await post.save();
            res.json({
                message: "Comment like toggled",
                likesCount: comment.likes.length,
                post
            });
        }
    }
    catch (error) {
        console.error("Error toggling comment like: ", error);
        res.status(500).json({ message: "Error toggling comment like", error: error.message });
    }
}
