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

// Global unsubscribe functions array for cleanup
let dashboardUnsubscribers = [];

// Load all dashboard data with REAL-TIME listeners
function loadAllDashboardData() {
  console.log('🔄 Setting up real-time dashboard data listeners...');

  const groupId = localStorage.getItem('groupId');
  const userId = localStorage.getItem('uid');

  if (!groupId || !userId) {
    console.log('❌ Missing groupId or userId');
    if (typeof showNotification !== 'undefined') {
      showNotification('Missing user information. Please log in again.', 'error');
    }
    return;
  }

  // Clean up any existing listeners
  dashboardUnsubscribers.forEach(unsub => unsub());
  dashboardUnsubscribers = [];

  // Set up real-time listeners for each data type
  setupRealtimeProjectData(groupId);
  setupRealtimeProposalsData(groupId);
  setupRealtimeTasksData(groupId);
  setupRealtimeFilesData(groupId);
  setupRealtimeMeetingsData(groupId);
  setupRealtimeFeedbackData(groupId);
  setupRealtimeAnnouncementsData();
  setupRealtimeGroupMembers(groupId);

  console.log('✅ Real-time dashboard listeners activated');
  if (typeof showNotification !== 'undefined') {
    showNotification('Real-time dashboard active!', 'success');
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
    // Try with orderBy first (requires index)
    let tasksSnapshot;
    try {
      tasksSnapshot = await db.collection('tasks')
        .where('groupId', '==', groupId)
        .orderBy('dueDate', 'asc')
        .get();
    } catch (indexError) {
      // Fallback: query without orderBy if index doesn't exist
      console.log('⚠️ Tasks index not found, using fallback query');
      tasksSnapshot = await db.collection('tasks')
        .where('groupId', '==', groupId)
        .get();
    }
    
    const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('✅ Loaded', tasks.length, 'tasks');
    return tasks;
  } catch (error) {
    console.error('❌ Error loading tasks data:', error);
    return [];
  }
}

// Load files data
async function loadFilesData(groupId) {
  try {
    // Try with orderBy first (requires index)
    let filesSnapshot;
    try {
      filesSnapshot = await db.collection('files')
        .where('groupId', '==', groupId)
        .orderBy('uploadedDate', 'desc')
        .get();
    } catch (indexError) {
      // Fallback: query without orderBy if index doesn't exist
      console.log('⚠️ Files index not found, using fallback query');
      filesSnapshot = await db.collection('files')
        .where('groupId', '==', groupId)
        .get();
    }
    
    const files = filesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('✅ Loaded', files.length, 'files');
    return files;
  } catch (error) {
    console.error('❌ Error loading files data:', error);
    return [];
  }
}

// Load meetings data
async function loadMeetingsData(groupId) {
  try {
    // Try with orderBy first (requires index)
    let meetingsSnapshot;
    try {
      meetingsSnapshot = await db.collection('meetings')
        .where('groupId', '==', groupId)
        .orderBy('scheduledDate', 'asc')
        .get();
    } catch (indexError) {
      // Fallback: query without orderBy if index doesn't exist
      console.log('⚠️ Meetings index not found, using fallback query');
      meetingsSnapshot = await db.collection('meetings')
        .where('groupId', '==', groupId)
        .get();
    }
    
    const meetings = meetingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('✅ Loaded', meetings.length, 'meetings');
    return meetings;
  } catch (error) {
    console.error('❌ Error loading meetings data:', error);
    return [];
  }
}

// Load feedback data
async function loadFeedbackData(groupId) {
  try {
    // Try with orderBy first (requires index)
    let feedbackSnapshot;
    try {
      feedbackSnapshot = await db.collection('feedback')
        .where('groupId', '==', groupId)
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();
    } catch (indexError) {
      // Fallback: query without orderBy if index doesn't exist
      console.log('⚠️ Feedback index not found, using fallback query');
      feedbackSnapshot = await db.collection('feedback')
        .where('groupId', '==', groupId)
        .limit(5)
        .get();
    }
    
    const feedback = feedbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('✅ Loaded', feedback.length, 'feedback items');
    return feedback;
  } catch (error) {
    console.error('❌ Error loading feedback data:', error);
    return [];
  }
}

// Load announcements data
async function loadAnnouncementsData() {
  try {
    // Try with orderBy first (requires index on single field - usually exists)
    let announcementsSnapshot;
    try {
      announcementsSnapshot = await db.collection('announcements')
        .orderBy('date', 'desc')
        .limit(5)
        .get();
    } catch (indexError) {
      // Fallback: query without orderBy
      console.log('⚠️ Announcements index not found, using fallback query');
      announcementsSnapshot = await db.collection('announcements')
        .limit(5)
        .get();
    }
    
    const announcements = announcementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log('✅ Loaded', announcements.length, 'announcements');
    return announcements;
  } catch (error) {
    console.error('❌ Error loading announcements data:', error);
    return [];
  }
}

// ============================================
// REAL-TIME LISTENER SETUP FUNCTIONS
// ============================================

// Real-time Project Data Listener
function setupRealtimeProjectData(groupId) {
  const unsub = db.collection('projects')
    .where('groupId', '==', groupId)
    .limit(1)
    .onSnapshot(snapshot => {
      const projectData = snapshot.empty ? null : snapshot.docs[0].data();
      updateProjectInfo(projectData);
      console.log('🔄 Project data updated in real-time');
    }, error => {
      console.error('❌ Real-time project error:', error);
      updateProjectInfo(null);
    });
  dashboardUnsubscribers.push(unsub);
}

// Real-time Proposals Data Listener
function setupRealtimeProposalsData(groupId) {
  const unsub = db.collection('proposals')
    .where('groupId', '==', groupId)
    .limit(10)
    .onSnapshot(snapshot => {
      let proposalData = null;
      if (!snapshot.empty) {
        const currentProposal = snapshot.docs.find(doc => doc.data().isCurrent === true);
        proposalData = currentProposal ? currentProposal.data() : snapshot.docs[0].data();
      }
      updateProposalStatus(proposalData);
      console.log('🔄 Proposals data updated in real-time:', snapshot.size, 'proposals');
    }, error => {
      console.error('❌ Real-time proposals error:', error);
      updateProposalStatus(null);
    });
  dashboardUnsubscribers.push(unsub);
}

// Real-time Tasks Data Listener
function setupRealtimeTasksData(groupId) {
  const unsub = db.collection('tasks')
    .where('groupId', '==', groupId)
    .onSnapshot(snapshot => {
      const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateTasksSection(tasksData);
      console.log('🔄 Tasks data updated in real-time:', tasksData.length, 'tasks');
    }, error => {
      console.error('❌ Real-time tasks error:', error);
      updateTasksSection([]);
    });
  dashboardUnsubscribers.push(unsub);
}

// Real-time Files Data Listener
function setupRealtimeFilesData(groupId) {
  const unsub = db.collection('files')
    .where('groupId', '==', groupId)
    .onSnapshot(snapshot => {
      const filesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateFilesSection(filesData);
      console.log('🔄 Files data updated in real-time:', filesData.length, 'files');
    }, error => {
      console.error('❌ Real-time files error:', error);
      updateFilesSection([]);
    });
  dashboardUnsubscribers.push(unsub);
}

// Real-time Meetings Data Listener
function setupRealtimeMeetingsData(groupId) {
  const unsub = db.collection('meetings')
    .where('groupId', '==', groupId)
    .onSnapshot(snapshot => {
      const meetingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateMeetingsSection(meetingsData);
      console.log('🔄 Meetings data updated in real-time:', meetingsData.length, 'meetings');
    }, error => {
      console.error('❌ Real-time meetings error:', error);
      updateMeetingsSection([]);
    });
  dashboardUnsubscribers.push(unsub);
}

// Real-time Feedback Data Listener
function setupRealtimeFeedbackData(groupId) {
  const unsub = db.collection('feedback')
    .where('groupId', '==', groupId)
    .limit(5)
    .onSnapshot(snapshot => {
      const feedbackData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateFeedbackSection(feedbackData);
      console.log('🔄 Feedback data updated in real-time:', feedbackData.length, 'items');
    }, error => {
      console.error('❌ Real-time feedback error:', error);
      updateFeedbackSection([]);
    });
  dashboardUnsubscribers.push(unsub);
}

// Real-time Announcements Data Listener
function setupRealtimeAnnouncementsData() {
  const unsub = db.collection('announcements')
    .limit(5)
    .onSnapshot(snapshot => {
      const announcementsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateAnnouncementsSection(announcementsData);
      console.log('🔄 Announcements updated in real-time:', announcementsData.length, 'items');
    }, error => {
      console.error('❌ Real-time announcements error:', error);
      updateAnnouncementsSection([]);
    });
  dashboardUnsubscribers.push(unsub);
}

// Real-time Group Members Listener
function setupRealtimeGroupMembers(groupId) {
  const unsub = db.collection('groups').doc(groupId)
    .onSnapshot(async snapshot => {
      if (!snapshot.exists) {
        console.log('❌ Group not found in real-time listener:', groupId);
        updateGroupMembers(null, groupId);
        return;
      }

      const groupData = snapshot.data();
      let rawMembers = groupData.members || groupData.memberIds || groupData.studentIds || [];
      const groupName = groupData.groupId || groupData.groupName || groupId;

      console.log('🔄 Group members updated in real-time:', rawMembers.length, 'members');
      console.log('📋 Raw members data:', rawMembers);

      if (rawMembers.length === 0) {
        updateGroupMembers({ groupName, members: [] }, groupId);
        return;
      }

      // Handle both embedded objects and UID strings
      const members = [];
      for (let i = 0; i < rawMembers.length; i++) {
        const memberData = rawMembers[i];

        // Check if member is an object with full data (like your Firebase structure)
        if (typeof memberData === 'object' && memberData !== null && memberData.fullName) {
          // Member data is embedded in the group document
          members.push({
            uid: memberData.loginId || memberData.registrationNumber || `member-${i}`,
            name: memberData.fullName,
            email: memberData.email || '',
            loginId: memberData.loginId || memberData.registrationNumber || '',
            isGroupLeader: memberData.isGroupLeader || (i === 0),
            role: memberData.role || 'student',
            batch: memberData.batch || '',
            section: memberData.section || ''
          });
          console.log('✅ [' + i + '] Loaded embedded member:', memberData.fullName);
        }
        // Check if member is a string (UID) - need to fetch from users collection
        else if (typeof memberData === 'string') {
          try {
            const userDoc = await db.collection('users').doc(memberData).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              members.push({
                uid: memberData,
                name: userData.displayName || userData.fullName || 'Unknown',
                email: userData.email || '',
                loginId: userData.loginId || userData.registrationNumber || memberData.substring(0, 8),
                isGroupLeader: userData.isGroupLeader || (i === 0),
                role: userData.role || 'student'
              });
              console.log('✅ [' + i + '] Loaded member from users:', userData.fullName || userData.displayName);
            } else {
              console.log('⚠️ [' + i + '] User not found:', memberData);
            }
          } catch (e) {
            console.error('❌ [' + i + '] Error fetching member:', memberData, e);
          }
        }
        // Handle object with just UID (fallback)
        else if (typeof memberData === 'object' && memberData !== null) {
          const userId = memberData.uid || memberData.userId || memberData.id;
          if (userId) {
            try {
              const userDoc = await db.collection('users').doc(userId).get();
              if (userDoc.exists) {
                const userData = userDoc.data();
                members.push({
                  uid: userId,
                  name: userData.displayName || userData.fullName || 'Unknown',
                  email: userData.email || '',
                  loginId: userData.loginId || userData.registrationNumber || userId.substring(0, 8),
                  isGroupLeader: userData.isGroupLeader || (i === 0),
                  role: userData.role || 'student'
                });
              }
            } catch (e) {
              console.error('Error fetching member:', userId);
            }
          }
        }
      }

      console.log('✅ Successfully loaded', members.length, 'out of', rawMembers.length, 'group members');
      updateGroupMembers({ groupName, members }, groupId);
    }, error => {
      console.error('❌ Real-time group members error:', error);
      updateGroupMembers(null, groupId);
    });
  dashboardUnsubscribers.push(unsub);
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
      </div>
    </div>
  `;
}

// Update proposal status section
function updateProposalStatus(proposalData) {
  const proposalStatusElement = document.getElementById('proposalStatus');
  if (!proposalStatusElement) return;
  
  if (!proposalData) {
    proposalStatusElement.innerHTML = `
      <div class="no-proposal-status">
        <i class="fas fa-file-alt"></i>
        <h4>No Proposal Submitted</h4>
        <p>You haven't submitted any proposal yet.</p>
        <button class="btn btn-primary" onclick="openSubmitProposalModal()">Submit Proposal</button>
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

// Helper function to get status display text
function getStatusDisplay(status) {
  switch (status) {
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
    localStorage.clear();
    window.location.href = "index.html";
  }
}

// =========================
// PROPOSAL SUBMISSION FUNCTIONS
// =========================

// Global variable to store selected file
let selectedProposalFile = null;

// Open submit proposal modal
function openSubmitProposalModal() {
  document.getElementById('submitProposalModal').style.display = 'block';
  document.getElementById('submitProposalForm').reset();
  selectedProposalFile = null;
  document.getElementById('fileInfo').textContent = 'Supported formats: PDF, DOC, DOCX (Max 10MB)';
}

// Close submit proposal modal
function closeSubmitProposalModal() {
  document.getElementById('submitProposalModal').style.display = 'none';
  document.getElementById('submitProposalForm').reset();
  selectedProposalFile = null;
}

// Handle file selection
function handleFileSelect(event) {
  const file = event.target.files[0];
  const fileInfo = document.getElementById('fileInfo');
  
  if (file) {
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      fileInfo.textContent = 'Error: File size exceeds 10MB limit';
      fileInfo.style.color = '#dc2626';
      event.target.value = '';
      selectedProposalFile = null;
      return;
    }
    
    // Check file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      fileInfo.textContent = 'Error: Invalid file type. Please use PDF, DOC, or DOCX';
      fileInfo.style.color = '#dc2626';
      event.target.value = '';
      selectedProposalFile = null;
      return;
    }
    
    selectedProposalFile = file;
    fileInfo.textContent = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    fileInfo.style.color = '#059669';
  } else {
    selectedProposalFile = null;
    fileInfo.textContent = 'Supported formats: PDF, DOC, DOCX (Max 10MB)';
    fileInfo.style.color = '#6b7280';
  }
}

// Submit proposal form handler
document.getElementById('submitProposalForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  try {
    // Get form data
    const title = document.getElementById('proposalTitle').value.trim();
    const category = document.getElementById('proposalCategory').value;
    const description = document.getElementById('proposalDescription').value.trim();
    const objectives = document.getElementById('proposalObjectives').value.trim();
    const methodology = document.getElementById('proposalMethodology').value.trim();
    const timeline = parseInt(document.getElementById('proposalTimeline').value);
    const resources = document.getElementById('proposalResources').value.trim();
    
    // Get student and group information
    const studentId = localStorage.getItem('uid');
    const groupId = localStorage.getItem('groupId');
    
    if (!studentId || !groupId) {
      if (typeof showNotification !== 'undefined') {
        showNotification('Missing student or group information. Please log in again.', 'error');
      }
      return;
    }
    
    // AUTOMATIC SUPERVISOR ASSIGNMENT: Get supervisor from group data
    const groupDoc = await db.collection('groups').doc(groupId).get();
    if (!groupDoc.exists) {
      if (typeof showNotification !== 'undefined') {
        showNotification('Group information not found. Please contact administrator.', 'error');
      }
      return;
    }
    
    const groupData = groupDoc.data();
    const supervisorId = groupData.supervisorId;
    
    if (!supervisorId) {
      if (typeof showNotification !== 'undefined') {
        showNotification('No supervisor assigned to your group. Please contact administrator.', 'error');
      }
      return;
    }
    
    console.log('✅ Automatic supervisor assignment:', supervisorId);
    
    // Show loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;
    
    // Upload file if selected
    let attachmentUrl = '';
    let attachmentName = '';
    
    if (selectedProposalFile) {
      try {
        const storageRef = storage.ref();
        const fileRef = storageRef.child(`proposals/${groupId}/${Date.now()}_${selectedProposalFile.name}`);
        
        await fileRef.put(selectedProposalFile);
        attachmentUrl = await fileRef.getDownloadURL();
        attachmentName = selectedProposalFile.name;
        
        console.log('File uploaded successfully:', attachmentName);
      } catch (uploadError) {
        console.error('Error uploading file:', uploadError);
        if (typeof showNotification !== 'undefined') {
          showNotification('Error uploading file. Please try again.', 'error');
        }
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        return;
      }
    }
    
    // Create proposal document
    const proposalData = {
      title: title,
      category: category,
      description: description,
      objectives: objectives,
      methodology: methodology,
      timeline: timeline,
      resources: resources,
      groupId: groupId,
      groupName: groupData.groupName || groupId,
      supervisorId: supervisorId,
      submittedBy: studentId,
      submittedDate: new Date().toISOString(),
      status: 'pending',
      attachments: attachmentUrl ? [{
        name: attachmentName,
        url: attachmentUrl,
        type: selectedProposalFile ? selectedProposalFile.type : 'document'
      }] : [],
      createdAt: new Date().toISOString()
    };
    
    // Save proposal to Firestore
    const proposalRef = await db.collection('proposals').add(proposalData);
    console.log('Proposal submitted successfully with ID:', proposalRef.id);
    
    // Send notification to supervisor
    await db.collection('notifications').add({
      userId: supervisorId,
      type: 'proposal_submitted',
      title: 'New Proposal Submitted',
      message: `A new proposal "${title}" has been submitted by ${groupData.groupName || 'your group'}.`,
      proposalId: proposalRef.id,
      groupId: groupId,
      createdAt: new Date().toISOString(),
      read: false
    });
    
    // Send confirmation notification to student
    await db.collection('notifications').add({
      userId: studentId,
      type: 'proposal_confirmation',
      title: 'Proposal Submitted Successfully',
      message: `Your proposal "${title}" has been submitted and is awaiting review.`,
      proposalId: proposalRef.id,
      createdAt: new Date().toISOString(),
      read: false
    });
    
    // Success message
    if (typeof showNotification !== 'undefined') {
      showNotification('Proposal submitted successfully! Your supervisor will review it soon.', 'success');
    }
    
    // Close modal and reset form
    closeSubmitProposalModal();
    
    // Refresh proposal status in dashboard
    if (typeof loadProposalStatus === 'function') {
      loadProposalStatus();
    }
    
  } catch (error) {
    console.error('Error submitting proposal:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error submitting proposal. Please try again.', 'error');
    }
  } finally {
    // Reset button state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Submit Proposal';
    submitBtn.disabled = false;
  }
});

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('submitProposalModal');
  if (event.target === modal) {
    closeSubmitProposalModal();
  }
}

// Load group members data
async function loadGroupMembers(groupId) {
  try {
    console.log('👥 Loading group members for groupId:', groupId);

    // First get the group document to find member IDs
    const groupDoc = await db.collection('groups').doc(groupId).get();

    if (!groupDoc.exists) {
      console.log('❌ Group not found:', groupId);
      console.log('💡 To fix: Create a group document with ID:', groupId);
      return null;
    }

    const groupData = groupDoc.data();
    console.log('📋 Group data found:', groupData);

    // Get member IDs from the group - handle both array and object structures
    let memberIds = [];
    if (Array.isArray(groupData.members)) {
      memberIds = groupData.members;
      console.log('✅ Found "members" array with', memberIds.length, 'items');
    } else if (groupData.memberIds) {
      memberIds = groupData.memberIds;
      console.log('✅ Found "memberIds" array with', memberIds.length, 'items');
    } else if (groupData.studentIds) {
      memberIds = groupData.studentIds;
      console.log('✅ Found "studentIds" array with', memberIds.length, 'items');
    } else {
      console.log('❌ No members array found in group data!');
      console.log('📊 Available fields in group:', Object.keys(groupData));
      console.log('💡 To fix: Add a "members" array to your group document with user UIDs');
    }

    const groupName = groupData.groupId || groupData.groupName || groupId;

    console.log('📊 Total member IDs to fetch:', memberIds.length);
    console.log('📋 Member IDs:', memberIds);

    if (memberIds.length === 0) {
      console.log('⚠️ No members to load');
      return { groupName, members: [] };
    }

    // Fetch user data for each member
    const memberPromises = memberIds.map(async (memberId, index) => {
      try {
        // memberId could be a string UID or an object
        let userId;
        if (typeof memberId === 'string') {
          userId = memberId;
        } else if (memberId && typeof memberId === 'object') {
          userId = memberId.uid || memberId.userId || memberId.id;
        }

        if (!userId) {
          console.log('⚠️ Invalid member ID at index', index, ':', memberId);
          return null;
        }

        console.log('🔍 [' + index + '] Fetching user:', userId);
        const userDoc = await db.collection('users').doc(userId).get();

        if (userDoc.exists) {
          const userData = userDoc.data();
          const member = {
            uid: userId,
            name: userData.displayName || userData.fullName || 'Unknown',
            email: userData.email || '',
            loginId: userData.loginId || userData.registrationNumber || userId.substring(0, 8),
            isGroupLeader: userData.isGroupLeader || index === 0, // First member is leader by default
            role: userData.role || 'student'
          };
          console.log('✅ [' + index + '] Loaded member:', member.name);
          return member;
        } else {
          console.log('❌ [' + index + '] User not found in users collection:', userId);
          console.log('💡 This user UID does not exist in the users collection');
          return null;
        }
      } catch (error) {
        console.error('❌ [' + index + '] Error loading member:', memberId, error);
        return null;
      }
    });

    const members = (await Promise.all(memberPromises)).filter(m => m !== null);
    console.log('✅ Successfully loaded', members.length, 'out of', memberIds.length, 'group members');

    if (members.length === 0 && memberIds.length > 0) {
      console.log('❌ CRITICAL: All member UIDs were invalid or not found in users collection!');
      console.log('💡 Check that the member UIDs in your group document match actual user UIDs');
    }

    return { groupName, members };
  } catch (error) {
    console.error('❌ Error loading group members:', error);
    return null;
  }
}

// Update group members section in the dashboard
function updateGroupMembers(membersData, groupId) {
  const membersListElement = document.getElementById('membersList');
  if (!membersListElement) return;

  if (!membersData || !membersData.members || membersData.members.length === 0) {
    membersListElement.innerHTML = `
      <div class="no-members">
        <i class="fas fa-users" style="font-size: 24px; color: #6c757d; margin-bottom: 10px;"></i>
        <p style="color: #6c757d;">No group members found</p>
        <p style="font-size: 12px; color: #adb5bd;">Group ID: ${groupId}</p>
      </div>
    `;
    return;
  }

  const { groupName, members } = membersData;

  // Build members HTML with batch/section info if available
  const membersHTML = members.map(member => {
    const extraInfo = [];
    if (member.batch) extraInfo.push(`Batch: ${member.batch}`);
    if (member.section) extraInfo.push(`Section: ${member.section}`);
    const extraInfoText = extraInfo.length > 0 ? ` • ${extraInfo.join(' • ')}` : '';

    return `
    <div class="member-item" style="
      display: flex;
      align-items: center;
      padding: 12px;
      margin-bottom: 8px;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 3px solid ${member.isGroupLeader ? '#28a745' : '#007bff'};
    ">
      <div class="member-avatar" style="
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: ${member.isGroupLeader ? '#28a745' : '#007bff'};
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        margin-right: 12px;
        font-size: 14px;
      ">
        ${member.name.charAt(0).toUpperCase()}
      </div>
      <div class="member-info" style="flex: 1;">
        <div style="font-weight: 600; color: #212529;">
          ${member.name}
          ${member.isGroupLeader ? '<span style="color: #28a745; font-size: 12px; margin-left: 8px;">(Leader)</span>' : ''}
        </div>
        <div style="font-size: 13px; color: #6c757d;">
          ID: ${member.loginId}${extraInfoText}
        </div>
      </div>
    </div>
  `}).join('');

  // Update the display with group name in header
  const groupDisplayName = groupName || groupId;
  const cardHeader = membersListElement.closest('.card')?.querySelector('h3');
  if (cardHeader) {
    cardHeader.innerHTML = `Group Members <span style="font-size: 14px; color: #6c757d; font-weight: normal;">(${groupDisplayName})</span>`;
  }

  membersListElement.innerHTML = membersHTML;

  // Also update the welcome message to show group ID
  const userNameElement = document.getElementById('dynamicUserName');
  if (userNameElement && userNameElement.textContent !== 'Loading...') {
    const currentName = userNameElement.textContent;
    if (!currentName.includes('[')) {
      userNameElement.innerHTML = `${currentName} <span style="font-size: 14px; color: #6c757d;">[${groupDisplayName}]</span>`;
    }
  }
}