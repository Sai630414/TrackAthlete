const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Connection = require('../models/Connection');

// GET /api/chat/unread/:userId — fetch persisted unread counts for all connections
router.get('/unread/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.json({ totalUnread: 0, byConnection: {} });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Find all active connections for this user (as athlete or coach)
    const connections = await Connection.find({
      $or: [{ athlete: userObjectId }, { coach: userObjectId }],
      status: 'Active'
    }).select('_id');

    if (!connections || connections.length === 0) {
      return res.json({ totalUnread: 0, byConnection: {} });
    }

    const connectionIds = connections.map(c => c._id);

    // Count unread messages sent by others
    const unreadMessages = await Message.aggregate([
      {
        $match: {
          connectionId: { $in: connectionIds },
          sender: { $ne: userObjectId },
          read: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$connectionId',
          count: { $sum: 1 }
        }
      }
    ]);

    const byConnection = {};
    let totalUnread = 0;

    unreadMessages.forEach(item => {
      byConnection[item._id.toString()] = item.count;
      totalUnread += item.count;
    });

    res.json({ totalUnread, byConnection });
  } catch (err) {
    console.error('Error fetching unread counts:', err);
    res.json({ totalUnread: 0, byConnection: {} });
  }
});

// GET /api/chat/:connectionId — full message history & mark as read
router.get('/:connectionId', async (req, res) => {
  try {
    const { userId } = req.query;
    const connectionId = req.params.connectionId;

    const messages = await Message.find({ connectionId })
      .populate('sender', 'name role')
      .sort({ createdAt: 1 });

    // If userId provided, mark messages from other person as read
    if (userId) {
      await Message.updateMany(
        { connectionId, sender: { $ne: userId }, read: { $ne: true } },
        { $set: { read: true } }
      );
    }

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/chat/:connectionId/read — mark all incoming messages as read
router.put('/:connectionId/read', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    await Message.updateMany(
      { connectionId: req.params.connectionId, sender: { $ne: userId }, read: { $ne: true } },
      { $set: { read: true } }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/:connectionId — send a new message
router.post('/:connectionId', async (req, res) => {
  try {
    const { sender, text } = req.body;
    if (!sender || !text?.trim()) {
      return res.status(400).json({ error: 'sender and text are required' });
    }

    // Verify connection is Active before allowing chat
    const conn = await Connection.findOne({ _id: req.params.connectionId, status: 'Active' });
    if (!conn) return res.status(403).json({ error: 'Chat only available for active connections' });

    const message = await Message.create({
      connectionId: req.params.connectionId,
      sender,
      text: text.trim(),
      read: false
    });

    const populated = await message.populate('sender', 'name role');

    // Emit to the connection room so both parties get it live
    const io = req.app.get('io');
    if (io) {
      const roomKey = req.params.connectionId.toString();
      io.to(roomKey).emit('chat-message', populated);

      // Notify the recipient's personal room for instant in-app toast
      const athleteIdStr = (conn.athlete._id || conn.athlete).toString();
      const coachIdStr = (conn.coach._id || conn.coach).toString();
      const senderStr = sender.toString();

      const recipientId = (athleteIdStr === senderStr) ? coachIdStr : athleteIdStr;

      console.log(`[Chat] Message in ${roomKey} from ${populated.sender.name} (${senderStr}) -> sending notification to user ${recipientId}`);

      io.to(recipientId).emit('new-message-notification', {
        connectionId: conn._id.toString(),
        senderId: senderStr,
        senderName: populated.sender.name,
        senderRole: populated.sender.role,
        text: populated.text,
        createdAt: populated.createdAt
      });
    }

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
