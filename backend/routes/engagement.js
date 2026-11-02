const express = require('express');
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// LIKE / UNLIKE a post
router.post('/like/:postId', async (req, res) => {
  try {
    const existing = await prisma.like.findUnique({
      where: { postId_userId: { postId: req.params.postId, userId: req.userId } },
    });

    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
      await prisma.notification.deleteMany({
        where: { type: 'like', fromUserId: req.userId, postId: req.params.postId },
      });
      return res.json({ liked: false });
    }

    await prisma.like.create({ data: { postId: req.params.postId, userId: req.userId } });

    const post = await prisma.post.findUnique({ where: { id: req.params.postId } });
    if (post && post.userId !== req.userId) {
      await prisma.notification.create({
        data: { userId: post.userId, type: 'like', fromUserId: req.userId, postId: req.params.postId },
      });
    }

    res.json({ liked: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/like/:postId', async (req, res) => {
  try {
    const likes = await prisma.like.findMany({
      where: { postId: req.params.postId },
      include: { user: { select: { id: true, username: true, profilePicUrl: true } } },
    });
    res.json(likes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ADD comment — supports optional parentId for replies
router.post('/comment/:postId', async (req, res) => {
  try {
    const { content, parentId } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const comment = await prisma.comment.create({
      data: {
        postId: req.params.postId,
        userId: req.userId,
        content,
        parentId: parentId || null,
      },
      include: {
        user: { select: { id: true, username: true, profilePicUrl: true } },
        _count: { select: { likes: true } },
      },
    });

    // Notify the post owner (unless commenting on your own post)
    const post = await prisma.post.findUnique({ where: { id: req.params.postId } });
    if (post && post.userId !== req.userId) {
      await prisma.notification.create({
        data: { userId: post.userId, type: 'comment', fromUserId: req.userId, postId: req.params.postId },
      });
    }

    // If this is a reply, also notify the comment author being replied to
    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId } });
      if (parent && parent.userId !== req.userId) {
        await prisma.notification.create({
          data: { userId: parent.userId, type: 'comment', fromUserId: req.userId, postId: req.params.postId },
        });
      }
    }

    res.status(201).json(comment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// GET comments for a post — flat list with parentId, client groups into threads
router.get('/comment/:postId', async (req, res) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { postId: req.params.postId },
      include: {
        user: { select: { id: true, username: true, profilePicUrl: true } },
        _count: { select: { likes: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(comments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// LIKE / UNLIKE a comment
router.post('/comment-like/:commentId', async (req, res) => {
  try {
    const existing = await prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId: req.params.commentId, userId: req.userId } },
    });

    if (existing) {
      await prisma.commentLike.delete({ where: { id: existing.id } });
      return res.json({ liked: false });
    }

    await prisma.commentLike.create({
      data: { commentId: req.params.commentId, userId: req.userId },
    });
    res.json({ liked: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// DELETE comment (and its replies) — author or admin only
router.delete('/comment/:commentId', async (req, res) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId } });

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.userId !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    const replies = await prisma.comment.findMany({ where: { parentId: req.params.commentId } });
    const replyIds = replies.map((r) => r.id);

    await prisma.$transaction([
      prisma.commentLike.deleteMany({ where: { commentId: { in: [req.params.commentId, ...replyIds] } } }),
      prisma.comment.deleteMany({ where: { parentId: req.params.commentId } }),
      prisma.comment.delete({ where: { id: req.params.commentId } }),
    ]);

    res.json({ message: 'Comment deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// SAVE / UNSAVE a post
router.post('/save/:postId', async (req, res) => {
  try {
    const existing = await prisma.savedPost.findUnique({
      where: { userId_postId: { userId: req.userId, postId: req.params.postId } },
    });

    if (existing) {
      await prisma.savedPost.delete({ where: { id: existing.id } });
      return res.json({ saved: false });
    }

    await prisma.savedPost.create({ data: { userId: req.userId, postId: req.params.postId } });
    res.json({ saved: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/saved', async (req, res) => {
  try {
    const saved = await prisma.savedPost.findMany({
      where: { userId: req.userId },
      include: {
        post: { include: { user: { select: { id: true, username: true, profilePicUrl: true } } } },
      },
      orderBy: { id: 'desc' },
    });
    res.json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;