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

// Extract #hashtags from a caption string
function extractHashtags(caption) {
  if (!caption) return [];
  const matches = caption.match(/#[\w]+/g) || [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}

// CREATE post — requires login
router.post('/', authMiddleware, upload.single('media'), async (req, res) => {
  try {
    const { caption, location } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Media file is required' });
    }

    const mediaType = req.file.mimetype.startsWith('video') ? 'video' : 'image';
    const mediaUrl = `/uploads/${req.file.filename}`;

    const hashtags = extractHashtags(caption);

    const post = await prisma.post.create({
      data: {
        userId: req.userId,
        caption: caption || null,
        mediaUrl,
        mediaType,
        location: location || null,
        hashtags: {
          create: await Promise.all(
            hashtags.map(async (tag) => {
              const hashtag = await prisma.hashtag.upsert({
                where: { tag },
                update: {},
                create: { tag },
              });
              return { hashtagId: hashtag.id };
            })
          ),
        },
      },
      include: {
        user: { select: { id: true, username: true, profilePicUrl: true } },
        hashtags: { include: { hashtag: true } },
      },
    });

    res.status(201).json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// GET single post
router.get('/:id', async (req, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, username: true, profilePicUrl: true } },
        hashtags: { include: { hashtag: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// GET all posts by a specific user (for profile pages)
router.get('/user/:userId', async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      where: { userId: req.params.userId },
      include: {
        user: { select: { id: true, username: true, profilePicUrl: true } },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// EDIT post — caption and location only (media stays the same), owner only.
// Re-extracts hashtags from the new caption so #tags stay in sync.
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.userId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to edit this post' });
    }

    const { caption, location } = req.body;
    const hashtags = extractHashtags(caption);

    const updated = await prisma.$transaction(async (tx) => {
      // Drop old hashtag links, re-link based on the edited caption
      await tx.postHashtag.deleteMany({ where: { postId: req.params.id } });

      return tx.post.update({
        where: { id: req.params.id },
        data: {
          caption: caption !== undefined ? caption : post.caption,
          location: location !== undefined ? location : post.location,
          hashtags: {
            create: await Promise.all(
              hashtags.map(async (tag) => {
                const hashtag = await tx.hashtag.upsert({
                  where: { tag },
                  update: {},
                  create: { tag },
                });
                return { hashtagId: hashtag.id };
              })
            ),
          },
        },
        include: {
          user: { select: { id: true, username: true, profilePicUrl: true } },
          hashtags: { include: { hashtag: true } },
        },
      });
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// DELETE post — only the owner can delete
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.userId !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    // Clean up dependent records first (Prisma won't cascade automatically here)
    await prisma.$transaction([
      prisma.postHashtag.deleteMany({ where: { postId: req.params.id } }),
      prisma.like.deleteMany({ where: { postId: req.params.id } }),
      prisma.comment.deleteMany({ where: { postId: req.params.id } }),
      prisma.savedPost.deleteMany({ where: { postId: req.params.id } }),
      prisma.report.deleteMany({ where: { postId: req.params.id } }),
      prisma.post.delete({ where: { id: req.params.id } }),
    ]);

    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// REPOST — share someone's post to your own profile, with an optional caption
router.post('/:id/repost', authMiddleware, async (req, res) => {
  try {
    const original = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!original) {
      return res.status(404).json({ error: 'Original post not found' });
    }

    const { caption } = req.body;
    const hashtags = extractHashtags(caption);

    const repost = await prisma.post.create({
      data: {
        userId: req.userId,
        caption: caption || null,
        repostOfId: original.id,
        hashtags: {
          create: await Promise.all(
            hashtags.map(async (tag) => {
              const hashtag = await prisma.hashtag.upsert({
                where: { tag },
                update: {},
                create: { tag },
              });
              return { hashtagId: hashtag.id };
            })
          ),
        },
      },
      include: {
        user: { select: { id: true, username: true, profilePicUrl: true } },
        repostOf: {
          include: { user: { select: { id: true, username: true, profilePicUrl: true } } },
        },
      },
    });

    if (original.userId !== req.userId) {
      await prisma.notification.create({
        data: { userId: original.userId, type: 'repost', fromUserId: req.userId, postId: original.id },
      });
    }

    res.status(201).json(repost);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;