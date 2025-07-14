import Chat from "../models/Chat.js";
import Message from "../models/Message.js";


// 1:1/group chat creation
export const createChat = async (req, res) => {
    try {
        const { participants, isGroup, groupName } = req.body;
        const chat = new Chat({ participants, isGroup, groupName });
        await chat.save();
        res.status(201).json(chat);
    }
    catch (err) {
        console.error('Error creating chat:', err);
        res.status(500).json({ error: 'Failed to create chat' });
    }
}

// Send a message in a chat
export const sendMessage = async (req, res) => {
    try {
        const { chatId, text } = req.body;
        const message = new Message({
            chat: chatId,
            sender: req.user._id,
            text,
            readBy: [req.user._id]
        });
        await message.save();

        await Chat.findByIdAndUpdate(chatId, {
            lastMessage: message._id
        });

        req.app.get('redis').publish(`chat:${chatId}`, JSON.stringify({
            ...message.toObject(),
            eventType: 'new-message'
        }));
        res.status(201).json(message);
    }
    catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ error: `Failed to send message : ${err.message}` });
    }
}

// Get history of messages
export const getMessages = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    try {
        const messages = await Message.find({ chat: req.params.chatId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        res.json(messages.reverse());
    }
    catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
}

// Get all chats for a user
export const getChats = async (req, res) => {
    try {
        const chats = await Chat.find({ participants: req.user._id })
            .populate('participants', 'name profilePicture')
            .populate('lastMessage')
        res.json(chats);
    }
    catch (err) {
        console.error('Error fetching chats:', err);
        res.status(500).json({ error: 'Failed to fetch chats' });
    }
}


// // Read message tick
// message.readBy = [req.user._id];
// await message.save();

export const markAsRead = async (req, res) => {
    try {
        const { messageId, chatId } = req.params;
        
        // Update in DB
        await Message.updateOne(
            { _id: messageId },
            { $addToSet: { readBy: req.user._id } }
        );

        // Notify others in chat
        req.app.get('redis').publish(`chat:${chatId}`, JSON.stringify({
            eventType: 'message-read',
            messageId,
            readBy: req.user._id
        }));

        res.status(200).json({ status: 'read' });
    } catch (err) {
        console.error('Error marking as read:', err);
        res.status(500).json({ error: 'Failed to update read status' });
    }
}