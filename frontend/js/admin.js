const reportsList = document.getElementById('reportsList');
const statusFilter = document.getElementById('statusFilter');

async function loadReports() {
  reportsList.innerHTML = '<div class="loading-state"><span class="spinner"></span> Loading reports...</div>';
  try {
    const res = await fetch(`${API_BASE}/reports?status=${statusFilter.value}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 403) {
      reportsList.innerHTML = '<p>Admin access required.</p>';
      return;
    }

    const reports = await res.json();

    if (reports.length === 0) {
      reportsList.innerHTML = '<p style="text-align:center; color:var(--muted); padding:30px 0;">No reports to show.</p>';
      return;
    }

    reportsList.innerHTML = reports.map(r => `
      <div class="report-card" data-id="${r.id}">
        <div class="report-top">
          <div>
            <div class="report-reason">${r.reason}</div>
            <div class="report-meta">Reported by @${r.reporter.username} · ${new Date(r.createdAt).toLocaleDateString()}</div>
          </div>
          <span class="report-status status-${r.status}">${r.status}</span>
        </div>

        ${r.post ? `
          <div class="report-target">
            ${r.post.mediaUrl ? `<img src="${API_BASE.replace('/api', '')}${r.post.mediaUrl}">` : ''}
            <div>
              <strong>@${r.post.user.username}</strong>
              <p style="font-size:.8rem; color:var(--muted);">${r.post.caption || ''}</p>
            </div>
          </div>
        ` : ''}

        ${r.reportedUser ? `
          <div class="report-target">
            <div>
              <strong>@${r.reportedUser.username}</strong>
              ${r.reportedUser.isBanned ? '<span style="color:var(--danger); font-size:.75rem; margin-left:6px;">Banned</span>' : ''}
            </div>
          </div>
        ` : ''}

        <div class="report-actions">
          ${r.status === 'pending' ? `<button class="dismiss-btn" onclick="reviewReport('${r.id}')">Dismiss</button>` : ''}
          ${r.post ? `<button class="delete-post-btn" onclick="deletePost('${r.post.id}', '${r.id}')">Delete Post</button>` : ''}
          ${r.reportedUser ? (
            r.reportedUser.isBanned
              ? `<button class="unban-btn" onclick="toggleBan('${r.reportedUser.id}', false)">Unban User</button>`
              : `<button class="ban-btn" onclick="toggleBan('${r.reportedUser.id}', true)">Ban User</button>`
          ) : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    reportsList.innerHTML = '<p>Failed to load reports.</p>';
  }
}

async function reviewReport(id) {
  try {
    await fetch(`${API_BASE}/reports/${id}/review`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    loadReports();
  } catch (err) {
    alert('Failed to dismiss report');
  }
}

async function deletePost(postId, reportId) {
  if (!confirm('Delete this post? This cannot be undone.')) return;
  try {
    await fetch(`${API_BASE}/reports/post/${postId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    loadReports();
  } catch (err) {
    alert('Failed to delete post');
  }
}

async function toggleBan(userId, banned) {
  if (!confirm(banned ? 'Ban this user?' : 'Unban this user?')) return;
  try {
    await fetch(`${API_BASE}/reports/ban/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ banned }),
    });
    loadReports();
  } catch (err) {
    alert('Failed to update ban status');
  }
}

statusFilter.addEventListener('change', loadReports);
loadReports();