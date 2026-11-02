const express = require('express');
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

const router = express.Router();

router.use(authMiddleware);

// FILE a report — against a post, a user, or both
router.post('/', async (req, res) => {
  try {
    const { postId, reportedUserId, reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A reason is required' });
    }

    if (!postId && !reportedUserId) {
      return res.status(400).json({ error: 'Must report either a post or a user' });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: req.userId,
        postId: postId || null,
        reportedUserId: reportedUserId || null,
        reason,
      },
    });

    res.status(201).json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// --- Everything below is admin-only ---
router.use(adminMiddleware);

// GET all reports (default: pending only, or ?status=all)
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const where = status === 'all' ? {} : { status: 'pending' };

    const reports = await prisma.report.findMany({
      where,
      include: {
        reporter: { select: { id: true, username: true } },
        reportedUser: { select: { id: true, username: true, isBanned: true } },
        post: {
          include: { user: { select: { id: true, username: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// MARK a report as reviewed (no action taken, just dismissing)
router.put('/:id/review', async (req, res) => {
  try {
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { status: 'reviewed' },
    });
    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// DELETE the reported post (moderation action)
router.delete('/post/:postId', async (req, res) => {
  try {
    await prisma.$transaction([
      prisma.postHashtag.deleteMany({ where: { postId: req.params.postId } }),
      prisma.like.deleteMany({ where: { postId: req.params.postId } }),
      prisma.comment.deleteMany({ where: { postId: req.params.postId } }),
      prisma.savedPost.deleteMany({ where: { postId: req.params.postId } }),
      prisma.report.updateMany({
        where: { postId: req.params.postId },
        data: { status: 'reviewed' },
      }),
      prisma.post.delete({ where: { id: req.params.postId } }),
    ]);

    res.json({ message: 'Post removed by moderation' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// BAN / UNBAN a user
router.put('/ban/:userId', async (req, res) => {
  try {
    const { banned } = req.body;

    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { isBanned: !!banned },
    });

    res.json({ message: banned ? 'User banned' : 'User unbanned', user: { id: user.id, username: user.username, isBanned: user.isBanned } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;