const express = require('express');
const prisma = require('../config/db');

const router = express.Router();

// GET /api/search?q=...&type=users|posts|hashtags|all (default: all)
router.get('/', async (req, res) => {
  try {
    const { q, type = 'all' } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const query = q.trim();
    const results = {};

    if (type === 'all' || type === 'users') {
      results.users = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, username: true, name: true, profilePicUrl: true, bio: true },
        take: 20,
      });
    }

    if (type === 'all' || type === 'posts') {
      results.posts = await prisma.post.findMany({
        where: {
          caption: { contains: query, mode: 'insensitive' },
        },
        include: {
          user: { select: { id: true, username: true, profilePicUrl: true } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    }

    if (type === 'all' || type === 'hashtags') {
      results.hashtags = await prisma.hashtag.findMany({
        where: {
          tag: { contains: query.replace('#', ''), mode: 'insensitive' },
        },
        include: {
          _count: { select: { posts: true } },
        },
        take: 20,
      });
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// GET posts for a specific hashtag
router.get('/hashtag/:tag', async (req, res) => {
  try {
    const hashtag = await prisma.hashtag.findUnique({
      where: { tag: req.params.tag.toLowerCase() },
    });

    if (!hashtag) {
      return res.json({ posts: [] });
    }

    const postHashtags = await prisma.postHashtag.findMany({
      where: { hashtagId: hashtag.id },
      include: {
        post: {
          include: {
            user: { select: { id: true, username: true, profilePicUrl: true } },
            _count: { select: { likes: true, comments: true } },
          },
        },
      },
    });

    const posts = postHashtags
      .map((ph) => ph.post)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ posts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;