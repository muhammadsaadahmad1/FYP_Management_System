// Firebase Authentication Check for Student Dashboard
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    console.log('❌ No user signed in, redirecting to login...');
    window.location.href = "login.html";
    return;
  }

  console.log('✅ User authenticated:', user.email);
  
  try {
    // Wait for Firebase to be fully initialized
    if (typeof db === 'undefined') {
      console.error('❌ Firebase database not initialized');
      if (typeof showNotification !== 'undefined') {
        showNotification('Firebase not initialized. Please refresh the page.', 'error');
      }
      return;
    }

    // Get user role from Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.role !== 'student') {
      console.log('❌ User is not a student, redirecting to login...');
      window.location.href = "login.html";
      return;
    }

    console.log('✅ Student role confirmed, loading dashboard data...');
    
    // Store user data in localStorage for easy access
    localStorage.setItem('uid', user.uid);
    localStorage.setItem('displayName', userData.displayName || user.email);
    localStorage.setItem('groupId', userData.groupId || user.uid);
    localStorage.setItem('role', userData.role);
    
    // Update welcome message
    const userNameElement = document.getElementById('dynamicUserName');
    if (userNameElement) {
      userNameElement.textContent = userData.displayName || user.email;
    }
    
    // User is authenticated and is a student, load dashboard data
    loadAllDashboardData();
  } catch (error) {
    console.error('❌ Error checking user role:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Authentication error. Please try logging in again.', 'error');
    }
    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);
  }
});

// Load all dashboard data
async function loadAllDashboardData() {
  console.log('🔄 Loading all dashboard data...');
  
  try {
    const groupId = localStorage.getItem('groupId');
    const userId = localStorage.getItem('uid');
    
    if (!groupId || !userId) {
      console.log('❌ Missing groupId or userId');
      if (typeof showNotification !== 'undefined') {
        showNotification('Missing user information. Please log in again.', 'error');
      }
      return;
    }
    
    // Load all data in parallel with error handling
    const results = await Promise.allSettled([
      loadProjectData(groupId),
      loadProposalsData(groupId),
      loadTasksData(groupId),
      loadFilesData(groupId),
      loadMeetingsData(groupId),
      loadFeedbackData(groupId),
      loadAnnouncementsData()
    ]);
    
    // Extract results and handle any failures
    const [projectData, proposalsData, tasksData, filesData, meetingsData, feedbackData, announcementsData] = results.map(result => 
      result.status === 'fulfilled' ? result.value : null
    );
    
    // Update all dashboard sections with real Firebase data only (no demo data fallback)
    updateProjectInfo(projectData);
    updateProposalStatus(proposalsData);
    updateTasksSection(tasksData);
    updateFilesSection(filesData);
    updateMeetingsSection(meetingsData);
    updateFeedbackSection(feedbackData);
    updateAnnouncementsSection(announcementsData);
    
    console.log('✅ Dashboard data loaded successfully');
    if (typeof showNotification !== 'undefined') {
      showNotification('Dashboard loaded successfully!', 'success');
    }
    
  } catch (error) {
    console.error('❌ Error loading dashboard data:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error loading dashboard data.', 'error');
    }
  }
}

// Load project data
async function loadProjectData(groupId) {
  try {
    const projectsSnapshot = await db.collection('projects')
      .where('groupId', '==', groupId)
      .limit(1)
      .get();
    
    if (!projectsSnapshot.empty) {
      return projectsSnapshot.docs[0].data();
    }
    return null;
  } catch (error) {
    console.error('Error loading project data:', error);
    return null;
  }
}

// Load proposals data
async function loadProposalsData(groupId) {
  try {
    console.log('🔍 Loading proposals for groupId:', groupId);
    
    // Simple query without complex ordering to avoid index requirements
    const proposalsSnapshot = await db.collection('proposals')
      .where('groupId', '==', groupId)
      .limit(10) // Get all proposals for this group, will filter in code
      .get();
    
    console.log('📊 Proposals query result:', proposalsSnapshot.size, 'proposals found');
    
    if (!proposalsSnapshot.empty) {
      // Find the current proposal (isCurrent: true) from the results
      const currentProposal = proposalsSnapshot.docs.find(doc => {
        const data = doc.data();
        return data.isCurrent === true;
      });
      
      if (currentProposal) {
        const proposalData = currentProposal.data();
        console.log('✅ Current proposal data found:', proposalData);
        return proposalData;
      } else {
        console.log('⚠️ No current proposal (isCurrent: true) found, returning first proposal');
        const proposalData = proposalsSnapshot.docs[0].data();
        console.log('✅ First proposal data found:', proposalData);
        return proposalData;
      }
    }
    
    console.log('❌ No proposals found for groupId:', groupId);
    return null;
  } catch (error) {
    console.error('Error loading proposals data:', error);
    return null;
  }
}

// Load tasks data
async function loadTasksData(groupId) {
  try {
    const tasksSnapshot = await db.collection('tasks')
      .where('groupId', '==', groupId)
      .orderBy('dueDate', 'asc')
      .get();
    
    return tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error loading tasks data:', error);
    return [];
  }
}

// Load files data
async function loadFilesData(groupId) {
  try {
    const filesSnapshot = await db.collection('files')
      .where('groupId', '==', groupId)
      .orderBy('uploadedDate', 'desc')
      .get();
    
    return filesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error loading files data:', error);
    return [];
  }
}

// Load meetings data
async function loadMeetingsData(groupId) {
  try {
    const meetingsSnapshot = await db.collection('meetings')
      .where('groupId', '==', groupId)
      .orderBy('scheduledDate', 'asc')
      .get();
    
    return meetingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error loading meetings data:', error);
    return [];
  }
}

// Load feedback data
async function loadFeedbackData(groupId) {
  try {
    const feedbackSnapshot = await db.collection('feedback')
      .where('groupId', '==', groupId)
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();
    
    return feedbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error loading feedback data:', error);
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

// Update project info section
function updateProjectInfo(projectData) {
  const projectInfoElement = document.getElementById('projectInfo');
  if (!projectInfoElement) return;
  
  if (!projectData) {
    projectInfoElement.innerHTML = '<p style="color: #6c757d;">No project assigned yet</p>';
    return;
  }
  
  projectInfoElement.innerHTML = `
    <div class="project-details">
      <h4>${projectData.title || 'Untitled Project'}</h4>
      <p><strong>Category:</strong> ${projectData.category || 'N/A'}</p>
      <p><strong>Supervisor:</strong> ${projectData.supervisor || 'Not Assigned'}</p>
      <p><strong>Progress:</strong> ${projectData.progress || 0}%</p>
      <div class="progress-bar">
        <div class="progress" style="width: ${projectData.progress || 0}%"></div>
function updateProposalStatus(proposalData) {
  const proposalStatusElement = document.getElementById('proposalStatus');
  if (!proposalStatusElement) return;
  
  if (!proposalData) {
    proposalStatusElement.innerHTML = `
      <div class="no-proposal-status">
        <i class="fas fa-file-alt"></i>
        <h4>No Proposal Submitted</h4>
        <p>You haven't submitted any proposal yet.</p>
        <button class="btn btn-primary" onclick="window.location.href='proposals.html'">Submit Proposal</button>
      </div>
    `;
    return;
  }
  
  const statusClass = proposalData.status ? proposalData.status.toLowerCase() : 'pending';
  const statusDisplay = getStatusDisplay(proposalData.status);
  
  proposalStatusElement.innerHTML = `
    <div class="proposal-status-details">
      <div class="status-header">
        <h4>${proposalData.title || 'Untitled Proposal'}</h4>
        <span class="status-badge ${statusClass}">${statusDisplay}</span>
      </div>
      <div class="status-info">
        <p><strong>Submitted:</strong> ${new Date(proposalData.submittedDate).toLocaleDateString()}</p>
        <p><strong>Last Updated:</strong> ${new Date(proposalData.lastUpdated).toLocaleDateString()}</p>
        ${proposalData.supervisor ? `<p><strong>Supervisor:</strong> ${proposalData.supervisor}</p>` : ''}
      </div>
      <div class="status-progress">
        <p><strong>Review Progress:</strong></p>
        <div class="progress-bar">
          <div class="progress" style="width: ${proposalData.progress || 0}%"></div>
        </div>
        <span class="progress-text">${proposalData.progress || 0}%</span>
      </div>
      <div class="status-actions">
        <button class="btn btn-secondary" onclick="window.location.href='proposals.html'">
          <i class="fas fa-eye"></i> View Details
        </button>
      </div>
    </div>
  `;
}
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

// Update tasks section
function updateTasksSection(tasksData) {
  const taskTableElement = document.getElementById('taskTable');
  if (!taskTableElement) return;
  
  if (tasksData.length === 0) {
    taskTableElement.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No tasks assigned yet</p>';
    return;
  }
  
  const tasksHtml = tasksData.map(task => `
    <div class="task-item">
      <div class="task-header">
        <h4>${task.title}</h4>
        <span class="task-status ${task.status}">${task.status}</span>
      </div>
      <p>${task.description || ''}</p>
      <p><strong>Due:</strong> ${new Date(task.dueDate).toLocaleDateString()}</p>
    </div>
  `).join('');
  
  taskTableElement.innerHTML = tasksHtml;
}

// Update files section
function updateFilesSection(filesData) {
  const fileTableElement = document.getElementById('fileTable');
  if (!fileTableElement) return;
  
  if (filesData.length === 0) {
    fileTableElement.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No files uploaded yet</p>';
    return;
  }
  
  const filesHtml = filesData.map(file => `
    <div class="file-item">
      <div class="file-info">
        <i class="fas fa-file-${getFileIcon(file.type)}"></i>
        <div>
          <h4>${file.name}</h4>
          <p>Uploaded: ${new Date(file.uploadedDate).toLocaleDateString()}</p>
        </div>
      </div>
      <button class="btn btn-secondary" onclick="downloadFile('${file.id}')">Download</button>
    </div>
  `).join('');
  
  fileTableElement.innerHTML = filesHtml;
}

// Update meetings section
function updateMeetingsSection(meetingsData) {
  const meetingTableElement = document.getElementById('meetingTable');
  if (!meetingTableElement) return;
  
  if (meetingsData.length === 0) {
    meetingTableElement.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No meetings scheduled</p>';
    return;
  }
  
  const meetingsHtml = meetingsData.map(meeting => `
    <div class="meeting-item">
      <div class="meeting-info">
        <h4>${meeting.title}</h4>
        <p><strong>Date:</strong> ${new Date(meeting.scheduledDate).toLocaleDateString()}</p>
        <p><strong>Time:</strong> ${meeting.time || 'TBA'}</p>
        <p><strong>Type:</strong> ${meeting.type || 'Meeting'}</p>
      </div>
      <span class="meeting-status ${meeting.status}">${meeting.status}</span>
    </div>
  `).join('');
  
  meetingTableElement.innerHTML = meetingsHtml;
}

// Update feedback section
function updateFeedbackSection(feedbackData) {
  const feedbackListElement = document.getElementById('feedbackList');
  if (!feedbackListElement) return;
  
  if (feedbackData.length === 0) {
    feedbackListElement.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No feedback available yet</p>';
    return;
  }
  
  const feedbackHtml = feedbackData.map(feedback => `
    <div class="feedback-item">
      <div class="feedback-header">
        <span class="feedback-author">${feedback.supervisor || 'Supervisor'}</span>
        <span class="feedback-date">${new Date(feedback.timestamp).toLocaleDateString()}</span>
      </div>
      <div class="feedback-content">
        <p>${feedback.message}</p>
      </div>
    </div>
  `).join('');
  
  feedbackListElement.innerHTML = feedbackHtml;
}

// Update announcements section
function updateAnnouncementsSection(announcementsData) {
  const announcementsElement = document.getElementById('announcements');
  if (!announcementsElement) return;
  
  if (announcementsData.length === 0) {
    announcementsElement.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No announcements</p>';
    return;
  }
  
  const announcementsHtml = announcementsData.map(announcement => `
    <div class="announcement-item">
      <h4>${announcement.title}</h4>
      <p>${announcement.message}</p>
      <p><small>Posted: ${new Date(announcement.date).toLocaleDateString()}</small></p>
    </div>
  `).join('');
  
  announcementsElement.innerHTML = announcementsHtml;
}

// Helper function to get file icon
function getFileIcon(fileType) {
  switch (fileType ? fileType.toLowerCase() : '') {
    case 'pdf':
      return 'pdf';
    case 'doc':
    case 'docx':
      return 'word';
    case 'xls':
    case 'xlsx':
      return 'excel';
    case 'ppt':
    case 'pptx':
      return 'powerpoint';
    default:
      return 'alt';
  }
}

// Helper functions for dashboard interactions
function handleFileUpload() {
  if (typeof showNotification !== 'undefined') {
    showNotification('Opening file upload...', 'info');
  }
}

function handleMeetingRequest() {
  if (typeof showNotification !== 'undefined') {
    showNotification('Opening meeting request form...', 'info');
  }
}

function showNotifications() {
  if (typeof showNotification !== 'undefined') {
    showNotification('Loading notifications...', 'info');
  }
}

function showNewTaskForm() {
  if (typeof showNotification !== 'undefined') {
    showNotification('Opening new task form...', 'info');
  }
}

function downloadFile(fileId) {
  if (typeof showNotification !== 'undefined') {
    showNotification('Downloading file...', 'info');
  }
}

// Enhanced logout function with Firebase
async function logout() {
  try {
    await auth.signOut();
    localStorage.clear();
    window.location.href = "index.html";
  } catch (error) {
    console.error('Logout error:', error);
    // Fallback to localStorage logout
    localStorage.clear();
    window.location.href = "index.html";
  }
}