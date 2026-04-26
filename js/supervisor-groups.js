// Firebase Authentication Check for Supervisor Groups Page
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    console.log('No user signed in, redirecting to login...');
    window.location.href = "login.html";
    return;
  }

  console.log('User authenticated:', user.email);
  
  try {
    if (typeof db === 'undefined') {
      console.error('Firebase database not initialized');
      if (typeof showNotification !== 'undefined') {
        showNotification('Firebase not initialized. Please refresh the page.', 'error');
      }
      return;
    }

    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.role !== 'supervisor') {
      console.log('User is not a supervisor, redirecting to login...');
      window.location.href = "login.html";
      return;
    }

    console.log('Supervisor role confirmed, loading groups data...');
    
    localStorage.setItem('uid', user.uid);
    localStorage.setItem('displayName', userData.displayName || user.email);
    localStorage.setItem('role', userData.role);
    
    loadSupervisorGroupsPage();
  } catch (error) {
    console.error('Error checking user role:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Authentication error. Please try logging in again.', 'error');
    }
    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);
  }
});

// Global variable to store groups data
let supervisorGroupsData = [];

// Load all groups page data
async function loadSupervisorGroupsPage() {
  console.log('Loading supervisor groups page data...');
  
  try {
    const supervisorId = localStorage.getItem('uid');
    
    if (!supervisorId) {
      console.log('Missing supervisorId');
      if (typeof showNotification !== 'undefined') {
        showNotification('Missing user information. Please log in again.', 'error');
      }
      return;
    }
    
    // Load groups data
    const groupsData = await loadAllSupervisorGroups(supervisorId);
    supervisorGroupsData = groupsData;
    
    // Update stats
    updateGroupsStats(groupsData);
    
    // Display groups
    displayGroupsList(groupsData);
    
    // Load recent activity
    await loadGroupActivity(supervisorId);
    
    console.log('Supervisor groups page loaded successfully');
    
  } catch (error) {
    console.error('Error loading supervisor groups page:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error loading groups data.', 'error');
    }
  }
}

// Load all supervisor groups with details
async function loadAllSupervisorGroups(supervisorId) {
  try {
    const groupsSnapshot = await db.collection('groups')
      .where('supervisorId', '==', supervisorId)
      .get();
    
    const groups = [];
    
    for (const groupDoc of groupsSnapshot.docs) {
      const groupData = groupDoc.data();
      
      // Get project data for this group
      const projectSnapshot = await db.collection('projects')
        .where('groupId', '==', groupDoc.id)
        .limit(1)
        .get();
      
      const projectData = !projectSnapshot.empty ? projectSnapshot.docs[0].data() : null;
      
      // Get members count
      const membersCount = groupData.members ? groupData.members.length : 0;
      
      groups.push({
        id: groupDoc.id,
        groupName: groupData.groupName || groupDoc.id,
        status: groupData.status || 'active',
        membersCount: membersCount,
        projectTitle: projectData ? projectData.title : 'No Project Assigned',
        projectStatus: projectData ? projectData.status : 'N/A',
        progress: projectData ? (projectData.progress || 0) : 0,
        category: projectData ? projectData.category : 'N/A',
        createdAt: groupData.createdAt || null
      });
    }
    
    return groups;
  } catch (error) {
    console.error('Error loading supervisor groups:', error);
    return [];
  }
}

// Update statistics cards
function updateGroupsStats(groupsData) {
  const totalGroups = groupsData.length;
  let totalStudents = 0;
  let activeProjects = 0;
  let completedProjects = 0;
  
  groupsData.forEach(group => {
    totalStudents += group.membersCount || 0;
    if (group.projectStatus === 'in_progress' || group.projectStatus === 'active') {
      activeProjects++;
    }
    if (group.projectStatus === 'completed') {
      completedProjects++;
    }
  });
  
  document.getElementById('totalGroupsCount').textContent = totalGroups;
  document.getElementById('totalStudentsCount').textContent = totalStudents;
  document.getElementById('activeProjectsCount').textContent = activeProjects;
  document.getElementById('completedProjectsCount').textContent = completedProjects;
}

// Display groups list
function displayGroupsList(groupsData) {
  const container = document.getElementById('groupsListContainer');
  if (!container) return;
  
  if (groupsData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users" style="font-size: 48px; color: #cbd5e1; margin-bottom: 20px;"></i>
        <h4>No Groups Assigned</h4>
        <p style="color: #6b7280;">You don't have any student groups assigned yet.</p>
      </div>
    `;
    return;
  }
  
  const groupsHtml = groupsData.map(group => `
    <div class="group-card" data-group-id="${group.id}" data-status="${group.projectStatus || 'active'}">
      <div class="group-card-header">
        <div class="group-info">
          <h4>${group.groupName}</h4>
          <span class="group-id">ID: ${group.id}</span>
        </div>
        <span class="status-badge ${group.projectStatus || 'in_progress'}">${formatStatus(group.projectStatus)}</span>
      </div>
      
      <div class="group-card-body">
        <div class="group-detail">
          <i class="fas fa-project-diagram"></i>
          <div>
            <label>Project</label>
            <p>${group.projectTitle}</p>
          </div>
        </div>
        
        <div class="group-detail">
          <i class="fas fa-user-graduate"></i>
          <div>
            <label>Members</label>
            <p>${group.membersCount} students</p>
          </div>
        </div>
        
        <div class="group-detail">
          <i class="fas fa-tag"></i>
          <div>
            <label>Category</label>
            <p>${group.category}</p>
          </div>
        </div>
      </div>
      
      <div class="group-progress-section">
        <div class="progress-header">
          <span>Project Progress</span>
          <span class="progress-percentage">${group.progress}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress" style="width: ${group.progress}%"></div>
        </div>
      </div>
      
      <div class="group-card-actions">
        <button class="btn btn-primary" onclick="viewGroupDetails('${group.id}')">
          <i class="fas fa-eye"></i> View Details
        </button>
        <button class="btn btn-secondary" onclick="sendMessageToGroup('${group.id}')">
          <i class="fas fa-envelope"></i> Message
        </button>
        <button class="btn btn-success" onclick="viewGroupProgress('${group.id}')">
          <i class="fas fa-chart-line"></i> Progress
        </button>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = groupsHtml;
}

// Filter groups based on search and status
function filterGroups() {
  const searchInput = document.getElementById('groupSearchInput').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  
  const filteredGroups = supervisorGroupsData.filter(group => {
    const matchesSearch = 
      group.groupName.toLowerCase().includes(searchInput) ||
      group.projectTitle.toLowerCase().includes(searchInput) ||
      group.id.toLowerCase().includes(searchInput);
    
    const matchesStatus = statusFilter === 'all' || 
      (group.projectStatus || 'active') === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  displayGroupsList(filteredGroups);
}

// Load recent group activity
async function loadGroupActivity(supervisorId) {
  try {
    // Get recent proposals, reports, and meetings
    const activityList = document.getElementById('groupActivityList');
    if (!activityList) return;
    
    // Get recent proposals
    const proposalsSnapshot = await db.collection('proposals')
      .where('supervisorId', '==', supervisorId)
      .orderBy('submittedDate', 'desc')
      .limit(5)
      .get();
    
    const activities = [];
    
    proposalsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      activities.push({
        type: 'proposal',
        title: `New proposal submitted: ${data.title || 'Untitled'}`,
        group: data.groupName || data.groupId,
        date: data.submittedDate,
        icon: 'fa-file-alt',
        color: '#2563eb'
      });
    });
    
    // Get recent reports
    const reportsSnapshot = await db.collection('reports')
      .where('supervisorId', '==', supervisorId)
      .orderBy('submittedDate', 'desc')
      .limit(5)
      .get();
    
    reportsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      activities.push({
        type: 'report',
        title: `Report submitted: ${data.title || 'Untitled'}`,
        group: data.groupName || data.groupId,
        date: data.submittedDate,
        icon: 'fa-file-pdf',
        color: '#dc2626'
      });
    });
    
    // Sort by date
    activities.sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateB - dateA;
    });
    
    // Take top 5
    const recentActivities = activities.slice(0, 5);
    
    if (recentActivities.length === 0) {
      activityList.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No recent activity</p>';
      return;
    }
    
    const activityHtml = recentActivities.map(activity => `
      <div class="activity-item">
        <div class="activity-icon" style="background: ${activity.color}20; color: ${activity.color};">
          <i class="fas ${activity.icon}"></i>
        </div>
        <div class="activity-content">
          <p class="activity-title">${activity.title}</p>
          <p class="activity-meta">
            <span class="activity-group">${activity.group}</span>
            <span class="activity-date">${activity.date ? new Date(activity.date).toLocaleDateString() : 'Unknown date'}</span>
          </p>
        </div>
      </div>
    `).join('');
    
    activityList.innerHTML = activityHtml;
    
  } catch (error) {
    console.error('Error loading group activity:', error);
    const activityList = document.getElementById('groupActivityList');
    if (activityList) {
      activityList.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">Unable to load activity</p>';
    }
  }
}

// Helper function to format status
function formatStatus(status) {
  if (!status) return 'Active';
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Action handlers
function viewGroupDetails(groupId) {
  if (typeof showNotification !== 'undefined') {
    showNotification(`Viewing details for group: ${groupId}`, 'info');
  }
  // TODO: Navigate to group details page or open modal
}

function sendMessageToGroup(groupId) {
  if (typeof showNotification !== 'undefined') {
    showNotification(`Opening message composer for group: ${groupId}`, 'info');
  }
  // TODO: Open message composer modal
}

function viewGroupProgress(groupId) {
  if (typeof showNotification !== 'undefined') {
    showNotification(`Viewing progress for group: ${groupId}`, 'info');
  }
  // TODO: Navigate to progress tracking page or open modal
}

function showNotifications() {
  if (typeof showNotification !== 'undefined') {
    showNotification('Notification center coming soon!', 'info');
  }
}
