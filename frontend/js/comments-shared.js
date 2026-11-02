// Shared comment thread rendering — used by feed.js and post-view.js.
// Renders top-level comments with nested replies, per-comment like/reply/delete.

function buildCommentTree(comments) {
  const topLevel = comments.filter(c => !c.parentId);
  const repliesByParent = {};
  comments.filter(c => c.parentId).forEach(c => {
    if (!repliesByParent[c.parentId]) repliesByParent[c.parentId] = [];
    repliesByParent[c.parentId].push(c);
  });
  return { topLevel, repliesByParent };
}

function renderCommentNode(c, repliesByParent, depth = 0) {
  const isMine = c.user.id === currentUser.id;
  const replies = repliesByParent[c.id] || [];

  return `
    <div class="comment-node" style="margin-left:${depth * 24}px; margin-bottom:8px;" data-comment-id="${c.id}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <p style="font-size:.85rem; flex:1;"><strong>${c.user.username}</strong> ${c.content}</p>
      </div>
      <div style="display:flex; gap:12px; font-size:.72rem; color:var(--muted); margin-top:2px;">
        <button class="comment-like-btn" onclick="toggleCommentLike('${c.id}', this)" data-liked="false" style="background:none; border:0; padding:0; font-size:.72rem; color:var(--muted);">
          🤍 <span class="comment-like-count">${c._count?.likes || 0}</span>
        </button>
        <button onclick="showReplyBox('${c.id}')" style="background:none; border:0; padding:0; font-size:.72rem; color:var(--muted);">Reply</button>
        ${isMine ? `<button onclick="deleteComment('${c.id}')" style="background:none; border:0; padding:0; font-size:.72rem; color:var(--danger);">Delete</button>` : ''}
      </div>
      <div id="reply-box-${c.id}" class="hidden" style="margin-top:6px; display:flex; gap:6px;">
        <input type="text" id="reply-input-${c.id}" placeholder="Reply to ${c.user.username}..." style="flex:1; font-size:.8rem; padding:6px 10px;">
        <button onclick="submitReply('${c.id}')" class="primary-btn" style="width:auto; padding:6px 12px; font-size:.78rem;">Send</button>
      </div>
      ${replies.map(r => renderCommentNode(r, repliesByParent, depth + 1)).join('')}
    </div>
  `;
}

function renderCommentThread(comments) {
  const { topLevel, repliesByParent } = buildCommentTree(comments);
  if (topLevel.length === 0) {
    return '<p style="font-size:.85rem; color:var(--muted);">No comments yet.</p>';
  }
  return topLevel.map(c => renderCommentNode(c, repliesByParent)).join('');
}

function showReplyBox(commentId) {
  document.querySelectorAll('[id^="reply-box-"]').forEach(el => {
    if (el.id !== `reply-box-${commentId}`) el.classList.add('hidden');
  });
  const box = document.getElementById(`reply-box-${commentId}`);
  box.classList.toggle('hidden');
  if (!box.classList.contains('hidden')) {
    document.getElementById(`reply-input-${commentId}`).focus();
  }
}

async function toggleCommentLike(commentId, btn) {
  const wasLiked = btn.dataset.liked === 'true';
  const nowLiked = !wasLiked;
  btn.dataset.liked = String(nowLiked);
  const countSpan = btn.querySelector('.comment-like-count');
  const current = parseInt(countSpan.textContent) || 0;
  countSpan.textContent = nowLiked ? current + 1 : Math.max(0, current - 1);
  btn.innerHTML = `${nowLiked ? '❤️' : '🤍'} <span class="comment-like-count">${countSpan.textContent}</span>`;

  try {
    await fetch(`${API_BASE}/engage/comment-like/${commentId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    btn.dataset.liked = String(wasLiked);
    btn.innerHTML = `${wasLiked ? '❤️' : '🤍'} <span class="comment-like-count">${current}</span>`;
  }
}

async function deleteComment(commentId) {
  if (!confirm('Delete this comment?')) return;
  try {
    await fetch(`${API_BASE}/engage/comment/${commentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    document.querySelector(`[data-comment-id="${commentId}"]`)?.remove();
  } catch (err) {
    alert('Failed to delete comment');
  }
}

// Generic reply submission — works on any page that defines
// window.refreshCommentsForPost(postId) to redraw its own comment container.
async function submitReply(parentId) {
  const input = document.getElementById(`reply-input-${parentId}`);
  const content = input.value.trim();
  if (!content) return;

  const postCard = input.closest('.post-card');
  const postId = postCard.dataset.id;

  try {
    await fetch(`${API_BASE}/engage/comment/${postId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content, parentId }),
    });
    input.value = '';
    if (window.refreshCommentsForPost) {
      await window.refreshCommentsForPost(postId);
    }
  } catch (err) {
    alert('Failed to post reply');
  }
}