import Notification from '../models/Notifications.js';

const getNotifications = (req, res) => {
    // get notifications for the authenticated user
    const userId = req.user.id;
    Notification.find({ recipient: userId })
        .populate('sender', 'username profilePicture')
        .populate('postId')
        .populate('commentId')
        .then(notifications => {
            res.json(notifications);
        })
        .catch(err => {
            console.error('Error fetching notifications:', err);
            res.status(500).json({ message: 'Error fetching notifications' });
        });   
}
