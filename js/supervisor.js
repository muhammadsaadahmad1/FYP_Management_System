// Firebase Authentication Check for Supervisor Dashboard
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    console.log('No user signed in, redirecting to login...');
    window.location.href = "login.html";
    return;
  }

  console.log('User authenticated:', user.email);
  
  try {
    // Wait for Firebase to be fully initialized
    if (typeof db === 'undefined') {
      console.error('Firebase database not initialized');
      if (typeof showNotification !== 'undefined') {
        showNotification('Firebase not initialized. Please refresh the page.', 'error');
      }
      return;
    }

    // Get user role from Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.role !== 'supervisor') {
      console.log('User is not a supervisor, redirecting to login...');
      window.location.href = "login.html";
      return;
    }

    console.log('Supervisor role confirmed, loading dashboard data...');
    
    // Store user data in localStorage for easy access
    localStorage.setItem('uid', user.uid);
    localStorage.setItem('displayName', userData.displayName || user.email);
    localStorage.setItem('role', userData.role);
    
    // Update welcome message
    const supervisorNameElement = document.getElementById('supervisorName');
    if (supervisorNameElement) {
      supervisorNameElement.textContent = userData.displayName || user.email;
    }
    
    // User is authenticated and is a supervisor, load dashboard data
    loadSupervisorDashboard();
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

// Load all supervisor dashboard data
async function loadSupervisorDashboard() {
  console.log('Loading supervisor dashboard data...');
  
  try {
    const supervisorId = localStorage.getItem('uid');
    
    if (!supervisorId) {
      console.log('Missing supervisorId');
      if (typeof showNotification !== 'undefined') {
        showNotification('Missing user information. Please log in again.', 'error');
      }
      return;
    }
    
    // Load all data in parallel with error handling
    const results = await Promise.allSettled([
      loadSupervisorGroups(supervisorId),
      loadPendingProposals(supervisorId),
      loadUpcomingMeetings(supervisorId),
      loadPendingReviews(supervisorId),
      loadRecentReports(supervisorId),
      loadStudentProgress(supervisorId),
      loadAnnouncementsData()
    ]);
    
    // Extract results and handle any failures
    const [groupsData, proposalsData, meetingsData, reviewsData, reportsData, progressData, announcementsData] = results.map(result => 
      result.status === 'fulfilled' ? result.value : null
    );
    
    // Update all dashboard sections
    updateStatsCards(groupsData, proposalsData, meetingsData, reviewsData);
    updateGroupsSection(groupsData);
    updateProposalsSection(proposalsData);
    updateMeetingsSection(meetingsData);
    updateReportsSection(reportsData);
    updateProgressSection(progressData);
    updateAnnouncementsSection(announcementsData);
    
    console.log('Supervisor dashboard data loaded successfully');
    if (typeof showNotification !== 'undefined') {
      showNotification('Dashboard loaded successfully!', 'success');
    }
    
  } catch (error) {
    console.error('Error loading supervisor dashboard data:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error loading dashboard data.', 'error');
    }
  }
}

// Load supervisor's assigned groups
async function loadSupervisorGroups(supervisorId) {
  try {
    const groupsSnapshot = await db.collection('groups')
      .where('supervisorId', '==', supervisorId)
      .get();
    
    return groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error loading supervisor groups:', error);
    return [];
  }
}

// Load pending proposals for supervisor's groups
async function loadPendingProposals(supervisorId) {
  try {
    const proposalsSnapshot = await db.collection('proposals')
      .where('supervisorId', '==', supervisorId)
      .where('status', 'in', ['pending', 'under_review'])
      .orderBy('submittedDate', 'desc')
      .get();
    
    return proposalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error loading pending proposals:', error);
    return [];
  }
}

// Load upcoming meetings for supervisor
async function loadUpcomingMeetings(supervisorId) {
  try {
    const now = new Date();
    const meetingsSnapshot = await db.collection('meetings')
      .where('supervisorId', '==', supervisorId)
      .where('scheduledDate', '>=', now)
      .orderBy('scheduledDate', 'asc')
      .limit(10)
      .get();
    
    return meetingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error loading upcoming meetings:', error);
    return [];
  }
}

// Load pending reviews count
async function loadPendingReviews(supervisorId) {
  try {
    // Get pending proposals count
    const proposalsSnapshot = await db.collection('proposals')
      .where('supervisorId', '==', supervisorId)
      .where('status', '==', 'pending_supervisor')
      .count().get();
    
    // Get pending reports count
    const reportsSnapshot = await db.collection('reports')
      .where('supervisorId', '==', supervisorId)
      .where('status', '==', 'pending_review')
      .count().get();
    
    return {
      proposals: proposalsSnapshot.data().count || 0,
      reports: reportsSnapshot.data().count || 0,
      total: (proposalsSnapshot.data().count || 0) + (reportsSnapshot.data().count || 0)
    };
  } catch (error) {
    console.error('Error loading pending reviews:', error);
    return { proposals: 0, reports: 0, total: 0 };
  }
}

// Load recent reports
async function loadRecentReports(supervisorId) {
  try {
    const reportsSnapshot = await db.collection('reports')
      .where('supervisorId', '==', supervisorId)
      .orderBy('submittedDate', 'desc')
      .limit(5)
      .get();
    
    return reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error loading recent reports:', error);
    return [];
  }
}

// Load student progress data
async function loadStudentProgress(supervisorId) {
  try {
    // Get all groups assigned to supervisor
    const groupsSnapshot = await db.collection('groups')
      .where('supervisorId', '==', supervisorId)
      .get();
    
    const progressData = [];
    
    for (const groupDoc of groupsSnapshot.docs) {
      const groupData = groupDoc.data();
      
      // Get project progress for this group
      const projectSnapshot = await db.collection('projects')
        .where('groupId', '==', groupDoc.id)
        .limit(1)
        .get();
      
      if (!projectSnapshot.empty) {
        const projectData = projectSnapshot.docs[0].data();
        progressData.push({
          groupId: groupDoc.id,
          groupName: groupData.groupName || groupDoc.id,
          projectTitle: projectData.title || 'Untitled Project',
          progress: projectData.progress || 0,
          status: projectData.status || 'In Progress'
        });
      }
    }
    
    return progressData;
  } catch (error) {
    console.error('Error loading student progress:', error);
    return [];
  }
}

// Load announcements data
async function loadAnnouncementsData() {
  try {
    const announcementsSnapshot = await db.collection('announcements')
      .orderBy('date', 'desc')
      .limit(5)
      .get();
    
    return announcementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error loading announcements data:', error);
    return [];
  }
}

// Update stats cards
function updateStatsCards(groupsData, proposalsData, meetingsData, reviewsData) {
  const groupsCount = document.getElementById('assignedGroupsCount');
  const proposalsCount = document.getElementById('pendingProposalsCount');
  const meetingsCount = document.getElementById('upcomingMeetingsCount');
  const reviewsCount = document.getElementById('pendingReviewsCount');
  
  if (groupsCount) groupsCount.textContent = groupsData ? groupsData.length : 0;
  if (proposalsCount) proposalsCount.textContent = proposalsData ? proposalsData.length : 0;
  if (meetingsCount) meetingsCount.textContent = meetingsData ? meetingsData.length : 0;
  if (reviewsCount) reviewsCount.textContent = reviewsData ? reviewsData.total : 0;
}

// Update groups section
function updateGroupsSection(groupsData) {
  const groupsList = document.getElementById('groupsList');
  if (!groupsList) return;
  
  if (!groupsData || groupsData.length === 0) {
    groupsList.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No groups assigned yet</p>';
    return;
  }
  
  const groupsHtml = groupsData.map(group => `
    <div class="group-item">
      <div class="group-header">
        <h4>${group.groupName || group.id}</h4>
        <span class="group-status ${group.status || 'active'}">${group.status || 'Active'}</span>
      </div>
      <p><strong>Members:</strong> ${group.members ? group.members.length : 0} students</p>
      <p><strong>Project:</strong> ${group.projectTitle || 'Not assigned'}</p>
      <div class="group-actions">
        <button class="btn btn-secondary" onclick="viewGroupDetails('${group.id}')">
          <i class="fas fa-eye"></i> View Details
        </button>
      </div>
    </div>
  `).join('');
  
  groupsList.innerHTML = groupsHtml;
}

// Update proposals section
function updateProposalsSection(proposalsData) {
  const proposalsList = document.getElementById('pendingProposalsList');
  if (!proposalsList) return;
  
  if (!proposalsData || proposalsData.length === 0) {
    proposalsList.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No pending proposals</p>';
    return;
  }
  
  const proposalsHtml = proposalsData.map(proposal => `
    <div class="proposal-item">
      <div class="proposal-header">
        <h4>${proposal.title || 'Untitled Proposal'}</h4>
        <span class="proposal-status ${proposal.status || 'pending'}">${proposal.status || 'Pending'}</span>
      </div>
      <p><strong>Group:</strong> ${proposal.groupName || proposal.groupId || 'Unknown'}</p>
      <p><strong>Submitted:</strong> ${proposal.submittedDate ? new Date(proposal.submittedDate).toLocaleDateString() : 'Unknown'}</p>
      <p><strong>Category:</strong> ${proposal.category || 'N/A'}</p>
      <div class="proposal-actions">
        <button class="btn btn-primary" onclick="reviewProposal('${proposal.id}')">
          <i class="fas fa-clipboard-check"></i> Review
        </button>
      </div>
    </div>
  `).join('');
  
  proposalsList.innerHTML = proposalsHtml;
}

// Update meetings section
function updateMeetingsSection(meetingsData) {
  const meetingsList = document.getElementById('upcomingMeetingsList');
  if (!meetingsList) return;
  
  if (!meetingsData || meetingsData.length === 0) {
    meetingsList.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No upcoming meetings</p>';
    return;
  }
  
  const meetingsHtml = meetingsData.map(meeting => `
    <div class="meeting-item">
      <div class="meeting-info">
        <h4>${meeting.title || 'Meeting'}</h4>
        <p><strong>Date:</strong> ${meeting.scheduledDate ? new Date(meeting.scheduledDate).toLocaleDateString() : 'TBA'}</p>
        <p><strong>Time:</strong> ${meeting.time || 'TBA'}</p>
        <p><strong>Group:</strong> ${meeting.groupName || meeting.groupId || 'Unknown'}</p>
        <p><strong>Type:</strong> ${meeting.type || 'General'}</p>
      </div>
      <span class="meeting-status ${meeting.status}">${meeting.status}</span>
    </div>
  `).join('');
  
  meetingsList.innerHTML = meetingsHtml;
}

// Update reports section
function updateReportsSection(reportsData) {
  const reportsList = document.getElementById('recentReportsList');
  if (!reportsList) return;
  
  if (!reportsData || reportsData.length === 0) {
    reportsList.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No recent reports</p>';
    return;
  }
  
  const reportsHtml = reportsData.map(report => `
    <div class="report-item">
      <div class="report-info">
        <i class="fas fa-file-pdf"></i>
        <div>
          <h4>${report.title || 'Untitled Report'}</h4>
          <p>Group: ${report.groupName || report.groupId || 'Unknown'}</p>
          <p>Submitted: ${report.submittedDate ? new Date(report.submittedDate).toLocaleDateString() : 'Unknown'}</p>
        </div>
      </div>
      <div class="report-actions">
        <span class="report-status ${report.status}">${report.status}</span>
        <button class="btn btn-secondary" onclick="downloadReport('${report.id}')">
          <i class="fas fa-download"></i> Download
        </button>
      </div>
    </div>
  `).join('');
  
  reportsList.innerHTML = reportsHtml;
}

// Update progress section
function updateProgressSection(progressData) {
  const progressList = document.getElementById('studentProgressList');
  if (!progressList) return;
  
  if (!progressData || progressData.length === 0) {
    progressList.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No progress data available</p>';
    return;
  }
  
  const progressHtml = progressData.map(progress => `
    <div class="progress-item">
      <div class="progress-info">
        <h4>${progress.projectTitle}</h4>
        <p><strong>Group:</strong> ${progress.groupName}</p>
        <p><strong>Status:</strong> <span class="status-badge ${progress.status}">${progress.status}</span></p>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar">
          <div class="progress" style="width: ${progress.progress}%"></div>
        </div>
        <span class="progress-text">${progress.progress}%</span>
      </div>
    </div>
  `).join('');
  
  progressList.innerHTML = progressHtml;
}

// Update announcements section
function updateAnnouncementsSection(announcementsData) {
  const announcementsElement = document.getElementById('announcements');
  if (!announcementsElement) return;
  
  if (!announcementsData || announcementsData.length === 0) {
    announcementsElement.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No announcements</p>';
    return;
  }
  
  const announcementsHtml = announcementsData.map(announcement => `
    <div class="announcement-item">
      <div class="announcement-header">
        <h4>${announcement.title || 'Announcement'}</h4>
        <span class="announcement-date">${announcement.date ? new Date(announcement.date).toLocaleDateString() : ''}</span>
      </div>
      <p>${announcement.content || ''}</p>
    </div>
  `).join('');
  
  announcementsElement.innerHTML = announcementsHtml;
}

// Action button handlers
function handleScheduleMeeting() {
  if (typeof showNotification !== 'undefined') {
    showNotification('Schedule Meeting form coming soon!', 'info');
  }
}

function handleReviewProposals() {
  window.location.href = 'supervisor-proposals.html';
}

function handleSendFeedback() {
  if (typeof showNotification !== 'undefined') {
    showNotification('Send Feedback form coming soon!', 'info');
  }
}

function handleViewReports() {
  window.location.href = 'supervisor-reports.html';
}

function viewGroupDetails(groupId) {
  if (typeof showNotification !== 'undefined') {
    showNotification(`Viewing group: ${groupId}`, 'info');
  }
}

function reviewProposal(proposalId) {
  if (typeof showNotification !== 'undefined') {
    showNotification(`Reviewing proposal: ${proposalId}`, 'info');
  }
}

function downloadReport(reportId) {
  if (typeof showNotification !== 'undefined') {
    showNotification(`Downloading report: ${reportId}`, 'info');
  }
}

function showNotifications() {
  if (typeof showNotification !== 'undefined') {
    showNotification('Notification center coming soon!', 'info');
  }
}

// Helper function to get file icon based on type
function getFileIcon(type) {
  if (!type) return 'alt';
  if (type.includes('pdf')) return 'pdf';
  if (type.includes('word') || type.includes('doc')) return 'word';
  if (type.includes('excel') || type.includes('sheet')) return 'excel';
  if (type.includes('image') || type.includes('png') || type.includes('jpg')) return 'image';
  return 'alt';
}

// Helper function to get status display text
function getStatusDisplay(status) {
  switch(status) {
    case 'pending':
      return 'Pending Review';
    case 'under_review':
      return 'Under Review';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'revision_required':
      return 'Revision Required';
    default:
      return 'Pending';
  }
}