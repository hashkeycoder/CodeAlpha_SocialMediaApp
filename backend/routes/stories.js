const express = require('express');
const multer = require('multer');
const path = require('path');
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

router.use(authMiddleware);

// CREATE a story — expires 24 hours from now
router.post('/', upload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Media file is required' });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = await prisma.story.create({
      data: {
        userId: req.userId,
        mediaUrl: `/uploads/${req.file.filename}`,
        expiresAt,
      },
      include: { user: { select: { id: true, username: true, profilePicUrl: true } } },
    });

    res.status(201).json(story);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// GET active stories from people you follow, grouped by user
router.get('/feed', async (req, res) => {
  try {
    const following = await prisma.follow.findMany({
      where: { followerId: req.userId, status: 'accepted' },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);
    // Include your own stories too
    followingIds.push(req.userId);

    const stories = await prisma.story.findMany({
      where: {
        userId: { in: followingIds },
        expiresAt: { gt: new Date() }, // only non-expired stories
      },
      include: { user: { select: { id: true, username: true, profilePicUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // Group by user for a typical "story tray" UI
    const grouped = {};
    stories.forEach((story) => {
      if (!grouped[story.userId]) {
        grouped[story.userId] = { user: story.user, stories: [] };
      }
      grouped[story.userId].stories.push(story);
    });

    res.json(Object.values(grouped));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// GET a specific user's active stories
router.get('/user/:userId', async (req, res) => {
  try {
    const stories = await prisma.story.findMany({
      where: {
        userId: req.params.userId,
        expiresAt: { gt: new Date() },
      },
      include: { user: { select: { id: true, username: true, profilePicUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(stories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// DELETE a story — owner or admin only
router.delete('/:id', async (req, res) => {
  try {
    const story = await prisma.story.findUnique({ where: { id: req.params.id } });

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    if (story.userId !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this story' });
    }

    await prisma.story.delete({ where: { id: req.params.id } });
    res.json({ message: 'Story deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;