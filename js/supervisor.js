requireAuth('supervisor', (userData) => {
  const supervisorNameElement = document.getElementById('supervisorName');
  if (supervisorNameElement) {
    supervisorNameElement.textContent = userData.displayName || userData.email;
  }

  const isDashboard = document.body.dataset.supervisorPage === 'dashboard'
    || window.location.pathname.endsWith('supervisor-dashboard.html');

  if (isDashboard) {
    loadSupervisorDashboard();
  }
  // Load notification badge on every supervisor page
  loadNotificationCount();
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
    // No compound filter/orderBy to avoid requiring a composite index; sort client-side
    const meetingsSnapshot = await db.collection('meetings')
      .where('supervisorId', '==', supervisorId)
      .get();

    const now = new Date();
    return meetingsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(m => m.status === 'pending' || new Date(m.scheduledDate || m.date || 0) >= now)
      .sort((a, b) => new Date(a.scheduledDate || a.date || 0) - new Date(b.scheduledDate || b.date || 0))
      .slice(0, 10);
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
      .get();
    
    // Get pending reports count
    const reportsSnapshot = await db.collection('reports')
      .where('supervisorId', '==', supervisorId)
      .where('status', '==', 'pending_review')
      .get();
    
    return {
      proposals: proposalsSnapshot.size || 0,
      reports: reportsSnapshot.size || 0,
      total: (proposalsSnapshot.size || 0) + (reportsSnapshot.size || 0)
    };
  } catch (error) {
    console.error('Error loading pending reviews:', error);
    return { proposals: 0, reports: 0, total: 0 };
  }
}

// Load recent reports
async function loadRecentReports(supervisorId) {
  try {
    const bySup = await db.collection('reports').where('supervisorId', '==', supervisorId).get();
    const groupsSnap = await db.collection('groups').where('supervisorId', '==', supervisorId).get();

    let byGroup = [];
    for (const g of groupsSnap.docs) {
      const rs = await db.collection('reports').where('groupId', '==', g.id).get();
      byGroup.push(...rs.docs);
    }

    const seen = new Set();
    const all = [...bySup.docs, ...byGroup]
      .filter((d) => { if (seen.has(d.id)) return false; seen.add(d.id); return true; })
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => new Date(b.submittedDate || 0) - new Date(a.submittedDate || 0))
      .slice(0, 5);

    return all;
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
  
  const meetingsHtml = meetingsData.map(meeting => {
    const isPending = meeting.status === 'pending';
    const dateStr = meeting.scheduledDate || meeting.date;
    return `
    <div class="meeting-item" style="${isPending ? 'border-left: 4px solid #f59e0b; background: #fffbeb;' : ''}">
      <div class="meeting-info">
        <h4>${meeting.title || 'Meeting'}${isPending ? ' <span style="font-size:11px;color:#92400e;background:#fef3c7;padding:2px 6px;border-radius:8px;font-weight:600;">NEEDS APPROVAL</span>' : ''}</h4>
        <p><strong>Date:</strong> ${dateStr ? new Date(dateStr).toLocaleDateString() : 'TBA'}</p>
        <p><strong>Time:</strong> ${meeting.time || 'TBA'}</p>
        <p><strong>Group:</strong> ${meeting.groupName || meeting.groupId || 'Unknown'}</p>
        <p><strong>Type:</strong> ${meeting.type || 'General'}</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
        <span class="meeting-status ${meeting.status}">${isPending ? 'Pending' : meeting.status}</span>
        ${isPending ? `<a href="supervisor-meetings.html" style="font-size:12px;color:#2563eb;text-decoration:underline;">Review →</a>` : ''}
      </div>
    </div>
  `;}).join('');
  
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
          ${report.feedback || report.remarks ? `<p style="font-size:13px;color:#374151;"><strong>Feedback:</strong> ${(report.feedback || report.remarks).substring(0, 80)}...</p>` : ''}
          ${report.grade ? `<p style="font-size:13px;"><strong>Grade:</strong> ${report.grade}</p>` : ''}
        </div>
      </div>
      <div class="report-actions">
        <span class="report-status ${report.status}">${report.status}</span>
        <a href="supervisor-reports.html" class="btn btn-secondary" style="text-decoration:none;">
          <i class="fas fa-eye"></i> Review
        </a>
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

async function loadNotificationCount() {
  try {
    const uid = localStorage.getItem('uid');
    if (!uid) return;
    const snap = await db.collection('notifications')
      .where('userId', '==', uid)
      .where('read', '==', false)
      .get();
    const badge = document.getElementById('notificationCount');
    if (badge) {
      badge.textContent = snap.size;
      badge.style.display = snap.size > 0 ? 'flex' : 'none';
    }
  } catch (e) {
    console.warn('Could not load notification count:', e.message);
  }
}

async function showNotifications() {
  const uid = localStorage.getItem('uid');
  if (!uid) return;
  try {
    const snap = await db.collection('notifications')
      .where('userId', '==', uid)
      .where('read', '==', false)
      .get();

    if (snap.empty) {
      if (typeof showNotification !== 'undefined') {
        showNotification('No new notifications.', 'info');
      }
      return;
    }

    // Build a simple dropdown list
    let existing = document.getElementById('notifDropdown');
    if (existing) { existing.remove(); return; } // toggle off

    const dropdown = document.createElement('div');
    dropdown.id = 'notifDropdown';
    dropdown.style.cssText = `position:fixed;top:60px;right:20px;background:#fff;border:1px solid #e5e7eb;
      border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);width:320px;max-height:400px;
      overflow-y:auto;z-index:9999;`;

    const items = snap.docs.map(doc => {
      const n = doc.data();
      return `<div style="padding:12px 16px;border-bottom:1px solid #f3f4f6;cursor:pointer;"
                   onclick="markNotifRead('${doc.id}', this)">
        <p style="margin:0;font-weight:600;font-size:14px;">${n.title || 'Notification'}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${n.message || ''}</p>
        ${n.type === 'meeting_request' ? `<a href="supervisor-meetings.html" style="font-size:12px;color:#2563eb;">Go to Meetings →</a>` : ''}
      </div>`;
    }).join('');

    dropdown.innerHTML = `
      <div style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:14px;
                  display:flex;justify-content:space-between;align-items:center;">
        Notifications
        <span onclick="document.getElementById('notifDropdown').remove()"
              style="cursor:pointer;color:#9ca3af;font-size:18px;">&times;</span>
      </div>
      ${items}`;
    document.body.appendChild(dropdown);

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!dropdown.contains(e.target)) { dropdown.remove(); document.removeEventListener('click', handler); }
      });
    }, 100);
  } catch (e) {
    console.warn('Error loading notifications:', e.message);
  }
}

async function markNotifRead(docId, el) {
  try {
    await db.collection('notifications').doc(docId).update({ read: true });
    el.style.opacity = '0.5';
    loadNotificationCount();
  } catch (_) {}
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