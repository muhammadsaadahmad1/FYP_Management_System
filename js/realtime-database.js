// Firebase Realtime Database Configuration
console.log('🔥 Initializing Firebase Realtime Database...');

// Initialize Realtime Database
const rtdb = firebase.database();

// Real-time data structure
const realtimePaths = {
  users: 'users',
  proposals: 'proposals', 
  projects: 'projects',
  tasks: 'tasks',
  notifications: 'notifications',
  announcements: 'announcements',
  onlineStatus: 'online_status',
  activities: 'activities'
};

// Real-time listeners registry
const realtimeListeners = new Map();

// Initialize Realtime Database when page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('🔄 Setting up Firebase Realtime Database...');
  
  // Wait for Firebase to be ready
  setTimeout(() => {
    if (typeof rtdb !== 'undefined') {
      initializeRealtimeFeatures();
    } else {
      console.log('⚠️ Realtime Database not ready, retrying...');
      setTimeout(initializeRealtimeFeatures, 2000);
    }
  }, 1000);
});

function initializeRealtimeFeatures() {
  console.log('✅ Firebase Realtime Database initialized successfully!');
  
  // Get current user info
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.log('❌ No user authenticated for realtime features');
    return;
  }

  const userId = currentUser.uid;
  const groupId = localStorage.getItem('groupId') || userId;
  
  console.log('👤 Setting up realtime features for user:', currentUser.email);
  console.log('📋 Group ID:', groupId);

  // Setup real-time listeners
  setupRealtimeListeners(userId, groupId);
  
  // Setup online status tracking
  setupOnlineStatus(userId);
  
  // Setup real-time notifications
  setupRealtimeNotifications(userId);
  
  console.log('🚀 All realtime features activated!');
}

// Setup real-time listeners for different data types
function setupRealtimeListeners(userId, groupId) {
  console.log('🔍 Setting up real-time listeners...');
  
  // Listen to user data changes
  setupUserListener(userId);
  
  // Listen to proposal changes
  setupProposalListener(groupId);
  
  // Listen to project changes
  setupProjectListener(groupId);
  
  // Listen to task changes
  setupTaskListener(groupId);
  
  // Listen to announcements
  setupAnnouncementListener();
}

// Real-time user data listener
function setupUserListener(userId) {
  const userRef = rtdb.ref(`${realtimePaths.users}/${userId}`);
  
  const listener = userRef.on('value', (snapshot) => {
    const userData = snapshot.val();
    if (userData) {
      console.log('👤 Real-time user update:', userData.displayName);
      
      // Update UI with real-time user data
      updateRealtimeUserInfo(userData);
      
      // Show notification for important changes
      if (userData.statusUpdate) {
        showRealtimeNotification('Status Update', userData.statusUpdate, 'info');
      }
    }
  });
  
  realtimeListeners.set(`user_${userId}`, listener);
  console.log('✅ User listener setup complete');
}

// Real-time proposal listener
function setupProposalListener(groupId) {
  const proposalRef = rtdb.ref(`${realtimePaths.proposals}`)
    .orderByChild('groupId')
    .equalTo(groupId);
  
  const listener = proposalRef.on('value', (snapshot) => {
    const proposals = snapshot.val();
    if (proposals) {
      console.log('📄 Real-time proposal updates detected');
      
      // Process proposals and update UI
      const proposalArray = Object.values(proposals || {});
      updateRealtimeProposals(proposalArray, groupId);
      
      // Show notification for new proposals
      const newProposal = Object.values(proposals || {}).find(p => p.isNew);
      if (newProposal) {
        showRealtimeNotification('New Proposal', `${newProposal.title} has been submitted`, 'success');
      }
    }
  });
  
  realtimeListeners.set(`proposals_${groupId}`, listener);
  console.log('✅ Proposal listener setup complete');
}

// Real-time project listener
function setupProjectListener(groupId) {
  const projectRef = rtdb.ref(`${realtimePaths.projects}`)
    .orderByChild('groupId')
    .equalTo(groupId);
  
  const listener = projectRef.on('value', (snapshot) => {
    const projects = snapshot.val();
    if (projects) {
      console.log('🎯 Real-time project updates detected');
      
      // Update UI with real-time project data
      const projectArray = Object.values(projects || {});
      updateRealtimeProjects(projectArray, groupId);
    }
  });
  
  realtimeListeners.set(`projects_${groupId}`, listener);
  console.log('✅ Project listener setup complete');
}

// Real-time task listener
function setupTaskListener(groupId) {
  const taskRef = rtdb.ref(`${realtimePaths.tasks}`)
    .orderByChild('groupId')
    .equalTo(groupId);
  
  const listener = taskRef.on('value', (snapshot) => {
    const tasks = snapshot.val();
    if (tasks) {
      console.log('📋 Real-time task updates detected');
      
      // Update UI with real-time task data
      const taskArray = Object.values(tasks || {});
      updateRealtimeTasks(taskArray, groupId);
      
      // Show notification for urgent tasks
      const urgentTasks = Object.values(tasks || {}).filter(t => t.priority === 'urgent');
      if (urgentTasks.length > 0) {
        showRealtimeNotification('Urgent Tasks', `You have ${urgentTasks.length} urgent tasks`, 'warning');
      }
    }
  });
  
  realtimeListeners.set(`tasks_${groupId}`, listener);
  console.log('✅ Task listener setup complete');
}

// Real-time announcement listener
function setupAnnouncementListener() {
  const announcementRef = rtdb.ref(realtimePaths.announcements)
    .orderByChild('timestamp')
    .limitToLast(10);
  
  const listener = announcementRef.on('value', (snapshot) => {
    const announcements = snapshot.val();
    if (announcements) {
      console.log('📢 Real-time announcement updates detected');
      
      // Update UI with real-time announcements
      const announcementArray = Object.values(announcements || {});
      updateRealtimeAnnouncements(announcementArray);
      
      // Show notification for new announcements
      const newAnnouncements = Object.values(announcements || {}).filter(a => a.isNew);
      if (newAnnouncements.length > 0) {
        showRealtimeNotification('New Announcement', newAnnouncements[0].title, 'info');
      }
    }
  });
  
  realtimeListeners.set('announcements', listener);
  console.log('✅ Announcement listener setup complete');
}

// Setup online status tracking
function setupOnlineStatus(userId) {
  const statusRef = rtdb.ref(`${realtimePaths.onlineStatus}/${userId}`);
  
  // Set user as online
  statusRef.set({
    isOnline: true,
    lastSeen: firebase.database.ServerValue.TIMESTAMP,
    email: auth.currentUser?.email
  });
  
  // Remove online status when user disconnects
  statusRef.onDisconnect().set({
    isOnline: false,
    lastSeen: firebase.database.ServerValue.TIMESTAMP,
    email: auth.currentUser?.email
  });
  
  console.log('✅ Online status tracking setup complete');
}

// Setup real-time notifications
function setupRealtimeNotifications(userId) {
  const notificationRef = rtdb.ref(`${realtimePaths.notifications}/${userId}`);
  
  const listener = notificationRef.on('value', (snapshot) => {
    const notifications = snapshot.val();
    if (notifications) {
      console.log('🔔 Real-time notifications received');
      
      // Update notification badge
      updateRealtimeNotificationBadge(notifications);
      
      // Show new notifications
      Object.values(notifications || {}).forEach(notification => {
        if (!notification.read) {
          showRealtimeNotification(notification.title, notification.message, notification.type);
        }
      });
    }
  });
  
  realtimeListeners.set(`notifications_${userId}`, listener);
  console.log('✅ Real-time notifications setup complete');
}

// Real-time UI update functions
function updateRealtimeUserInfo(userData) {
  const userNameElement = document.getElementById('dynamicUserName');
  if (userNameElement) {
    userNameElement.textContent = userData.displayName || userData.email;
  }
}

function updateRealtimeProposals(proposals, groupId) {
  // Update dashboard proposal section if on dashboard
  const proposalStatusElement = document.getElementById('proposalStatus');
  if (proposalStatusElement) {
    const currentProposal = proposals.find(p => p.groupId === groupId && p.isCurrent);
    if (currentProposal) {
      updateProposalStatus(currentProposal);
    }
  }
  
  // Update proposals page if on proposals page
  const proposalsTableBody = document.getElementById('proposalsTableBody');
  if (proposalsTableBody) {
    updateProposalsTable(proposals);
  }
}

function updateRealtimeProjects(projects, groupId) {
  const projectInfoElement = document.getElementById('projectInfo');
  if (projectInfoElement) {
    const currentProject = projects.find(p => p.groupId === groupId);
    if (currentProject) {
      updateProjectInfo(currentProject);
    }
  }
}

function updateRealtimeTasks(tasks, groupId) {
  const taskTableElement = document.getElementById('taskTable');
  if (taskTableElement) {
    const groupTasks = tasks.filter(t => t.groupId === groupId);
    updateTasksSection(groupTasks);
  }
}

function updateRealtimeAnnouncements(announcements) {
  const announcementsElement = document.getElementById('announcements');
  if (announcementsElement) {
    updateAnnouncementsSection(announcements);
  }
}

function updateRealtimeNotificationBadge(notifications) {
  const badgeElement = document.getElementById('notificationCount');
  if (badgeElement) {
    const unreadCount = Object.values(notifications || {}).filter(n => !n.read).length;
    badgeElement.textContent = unreadCount;
  }
}

// Real-time notification display
function showRealtimeNotification(title, message, type = 'info') {
  console.log('🔔 Real-time notification:', title, '-', message);
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `realtime-notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <strong>${title}</strong>
      <p>${message}</p>
      <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    </div>
  `;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

// Cleanup function to remove all listeners
function cleanupRealtimeListeners() {
  console.log('🧹 Cleaning up real-time listeners...');
  
  realtimeListeners.forEach((listener, key) => {
    if (typeof listener === 'function') {
      listener(); // Remove the listener
    }
  });
  
  realtimeListeners.clear();
  console.log('✅ Real-time listeners cleaned up');
}

// Export functions for global access
window.realtimeDB = {
  rtdb,
  paths: realtimePaths,
  listeners: realtimeListeners,
  cleanup: cleanupRealtimeListeners,
  showNotification: showRealtimeNotification
};
