/**
 * Central Firebase auth guard for all protected pages.
 * Usage: requireAuth('student', (userData) => initPage());
 */

function syncUserSession(user, userData) {
  localStorage.setItem('uid', user.uid);
  localStorage.setItem('email', user.email || userData.email || '');
  localStorage.setItem('role', userData.role);
  localStorage.setItem('displayName', userData.displayName || user.displayName || userData.email || '');
  if (userData.groupId) localStorage.setItem('groupId', userData.groupId);
  if (userData.loginId) localStorage.setItem('loginId', userData.loginId);
  if (userData.isGroupLeader != null) localStorage.setItem('isGroupLeader', userData.isGroupLeader);
}

function requireAuth(allowedRoles, onReady) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const authInstance = window.firebaseServices?.auth || (typeof firebase !== 'undefined' ? firebase.auth() : null);
  const dbInstance = window.firebaseServices?.db || (typeof firebase !== 'undefined' ? firebase.firestore() : null);

  if (!authInstance || !dbInstance) {
    console.error('Firebase not initialized');
    window.location.href = 'login.html';
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    authInstance.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = 'login.html';
        return;
      }

      try {
        const userDoc = await dbInstance.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
          await authInstance.signOut();
          window.location.href = 'login.html';
          return;
        }

        const userData = userDoc.data();
        if (!roles.includes(userData.role)) {
          alert('Access denied. You do not have permission to view this page.');
          window.location.href = 'login.html';
          return;
        }

        if (userData.isActive === false) {
          await authInstance.signOut();
          alert(
            userData.role === 'admin' || userData.role === 'supervisor'
              ? 'Your account is pending admin approval.'
              : 'Your account is not active. Please contact the administrator.'
          );
          window.location.href = 'login.html';
          return;
        }

        syncUserSession(user, userData);

        const userNameEl = document.getElementById('dynamicUserName');
        if (userNameEl) userNameEl.textContent = userData.displayName || user.email;

        const adminNameEl = document.getElementById('adminName');
        if (adminNameEl) adminNameEl.textContent = userData.displayName || userData.fullName || 'Admin';

        if (typeof onReady === 'function') onReady(userData, user);
        resolve(userData);
      } catch (error) {
        console.error('Auth guard error:', error);
        window.location.href = 'login.html';
      }
    });
  });
}

async function firebaseLogout(redirectTo = 'login.html') {
  try {
    const authInstance = window.firebaseServices?.auth || firebase.auth();
    await authInstance.signOut();
  } catch (error) {
    console.error('Sign out error:', error);
  }

  ['uid', 'role', 'email', 'displayName', 'groupId', 'loginId', 'isGroupLeader', 'user'].forEach((key) => {
    localStorage.removeItem(key);
  });

  window.location.href = redirectTo;
}
