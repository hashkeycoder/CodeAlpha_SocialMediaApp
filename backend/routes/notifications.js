const express = require('express');
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId },
      include: { fromUser: { select: { id: true, username: true, profilePicUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: req.userId, isRead: false },
    });

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    const updated = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.userId },
      data: { isRead: true },
    });
    if (updated.count === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.put('/read-all', async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// DELETE a single notification
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await prisma.notification.deleteMany({
      where: { id: req.params.id, userId: req.userId },
    });
    if (deleted.count === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// DELETE all notifications
router.delete('/', async (req, res) => {
  try {
    await prisma.notification.deleteMany({ where: { userId: req.userId } });
    res.json({ message: 'All notifications cleared' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;