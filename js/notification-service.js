/**
 * Shared notification helpers for student, supervisor, and admin roles.
 */
const NotificationService = (function () {
  function getDb() {
    return window.firebaseServices?.db
      || (typeof db !== 'undefined' ? db : null)
      || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
  }

  async function getActiveAdminUserIds() {
    const firestore = getDb();
    if (!firestore) return [];
    try {
      const snap = await firestore.collection('admins').where('isActive', '==', true).get();
      return snap.docs.map((d) => d.id);
    } catch (_) {
      return [];
    }
  }

  async function getGroupMemberUserIds(groupId) {
    const firestore = getDb();
    if (!firestore || !groupId) return [];
    try {
      const groupDoc = await firestore.collection('groups').doc(groupId).get();
      if (!groupDoc.exists) return [];
      const data = groupDoc.data();
      if (Array.isArray(data.memberUids) && data.memberUids.length) return data.memberUids;
      if (Array.isArray(data.members)) {
        const uids = data.members
          .map((m) => (typeof m === 'string' ? m : m?.uid))
          .filter(Boolean);
        if (uids.length) return uids;
      }
      const usersSnap = await firestore.collection('users').where('groupId', '==', groupId).get();
      return usersSnap.docs.map((d) => d.id);
    } catch (_) {
      return [];
    }
  }

  async function send(userId, payload) {
    const firestore = getDb();
    if (!firestore || !userId) return;
    await firestore.collection('notifications').add({
      userId,
      read: false,
      createdAt: new Date().toISOString(),
      ...payload
    });
  }

  async function notifyAdmins(payload) {
    const ids = await getActiveAdminUserIds();
    await Promise.all(ids.map((id) => send(id, payload)));
  }

  async function notifyGroup(groupId, payload) {
    const ids = await getGroupMemberUserIds(groupId);
    await Promise.all(ids.map((id) => send(id, payload)));
  }

  async function loadCount(badgeId) {
    const uid = localStorage.getItem('uid');
    const badge = document.getElementById(badgeId || 'notificationCount');
    if (!uid || !badge) return 0;
    try {
      const snap = await getDb().collection('notifications')
        .where('userId', '==', uid)
        .where('read', '==', false)
        .get();
      badge.textContent = snap.size;
      badge.style.display = snap.size > 0 ? 'flex' : 'none';
      return snap.size;
    } catch (e) {
      console.warn('Notification count error:', e.message);
      return 0;
    }
  }

  async function showPanel() {
    const uid = localStorage.getItem('uid');
    if (!uid) return;
    const firestore = getDb();

    let existing = document.getElementById('notifDropdown');
    if (existing) { existing.remove(); return; }

    const snap = await firestore.collection('notifications')
      .where('userId', '==', uid)
      .where('read', '==', false)
      .get();

    const sorted = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (!sorted.length) {
      if (typeof showNotification === 'function') {
        showNotification('No new notifications.', 'info');
      }
      return;
    }

    const dropdown = document.createElement('div');
    dropdown.id = 'notifDropdown';
    dropdown.style.cssText = `position:fixed;top:60px;right:20px;background:#fff;border:1px solid #e5e7eb;
      border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);width:340px;max-height:420px;
      overflow-y:auto;z-index:9999;`;

    const items = sorted.map((n) => {
      const link = n.link ? `<a href="${n.link}" style="font-size:12px;color:#2563eb;">Open →</a>` : '';
      return `<div style="padding:12px 16px;border-bottom:1px solid #f3f4f6;cursor:pointer;"
                   onclick="NotificationService.markRead('${n.id}', this)">
        <p style="margin:0;font-weight:600;font-size:14px;">${n.title || 'Notification'}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${n.message || ''}</p>
        ${link}
      </div>`;
    }).join('');

    dropdown.innerHTML = `
      <div style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:14px;
                  display:flex;justify-content:space-between;align-items:center;">
        Notifications (${sorted.length})
        <span onclick="document.getElementById('notifDropdown').remove()"
              style="cursor:pointer;color:#9ca3af;font-size:18px;">&times;</span>
      </div>
      ${items}`;

    document.body.appendChild(dropdown);
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!dropdown.contains(e.target)) {
          dropdown.remove();
          document.removeEventListener('click', handler);
        }
      });
    }, 100);
  }

  async function markRead(docId, el) {
    try {
      await getDb().collection('notifications').doc(docId).update({ read: true });
      if (el) el.style.opacity = '0.5';
      await loadCount();
    } catch (_) {}
  }

  return {
    getDb,
    getActiveAdminUserIds,
    getGroupMemberUserIds,
    send,
    notifyAdmins,
    notifyGroup,
    loadCount,
    showPanel,
    markRead
  };
})();

// Backward-compatible globals used by supervisor pages
window.loadNotificationCount = () => NotificationService.loadCount();
window.showNotifications = () => NotificationService.showPanel();
window.markNotifRead = (id, el) => NotificationService.markRead(id, el);
