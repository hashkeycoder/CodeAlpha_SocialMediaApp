const express = require('express');
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// GET feed — your own posts + posts from people you follow, newest first,
// with a small ranking boost for authors you've recently engaged with.
router.get('/', async (req, res) => {
  try {
    const following = await prisma.follow.findMany({
      where: { followerId: req.userId, status: 'accepted' },
      select: { followingId: true },
    });

    const followingIds = following.map((f) => f.followingId);
    followingIds.push(req.userId); // always include your own posts

    const recentLikes = await prisma.like.findMany({
      where: { userId: req.userId },
      include: { post: { select: { userId: true } } },
      orderBy: { id: 'desc' },
      take: 50,
    });
    const recentComments = await prisma.comment.findMany({
      where: { userId: req.userId },
      include: { post: { select: { userId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const engagementCounts = {};
    [...recentLikes, ...recentComments].forEach((item) => {
      const authorId = item.post.userId;
      engagementCounts[authorId] = (engagementCounts[authorId] || 0) + 1;
    });

    const posts = await prisma.post.findMany({
      where: { userId: { in: followingIds } },
      include: {
        user: { select: { id: true, username: true, profilePicUrl: true } },
        hashtags: { include: { hashtag: true } },
        repostOf: {
          include: { user: { select: { id: true, username: true, profilePicUrl: true } } },
        },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const scored = posts.map((post) => ({
      ...post,
      _engagementBoost: engagementCounts[post.userId] || 0,
    }));

    scored.sort((a, b) => {
      const timeDiff = new Date(b.createdAt) - new Date(a.createdAt);
      if (Math.abs(timeDiff) > 1000 * 60 * 60 * 6) return timeDiff;
      return b._engagementBoost - a._engagementBoost || timeDiff;
    });

    res.json({ posts: scored });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;