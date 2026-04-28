// Firebase Authentication Check for Supervisor Meetings Page
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

    console.log('Supervisor role confirmed, loading meetings data...');
    
    localStorage.setItem('uid', user.uid);
    localStorage.setItem('displayName', userData.displayName || user.email);
    localStorage.setItem('role', userData.role);
    
    loadSupervisorMeetingsPage();
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

// Global variable to store meetings data
let supervisorMeetingsData = [];

// Load all meetings page data
async function loadSupervisorMeetingsPage() {
  console.log('Loading supervisor meetings page data...');
  
  try {
    const supervisorId = localStorage.getItem('uid');
    
    if (!supervisorId) {
      console.log('Missing supervisorId');
      if (typeof showNotification !== 'undefined') {
        showNotification('Missing user information. Please log in again.', 'error');
      }
      return;
    }
    
    // Load meetings data
    const meetingsData = await loadAllSupervisorMeetings(supervisorId);
    supervisorMeetingsData = meetingsData;
    
    // Update stats
    updateMeetingsStats(meetingsData);
    
    // Display meetings
    displayMeetingsList(meetingsData);
    
    // Load groups for meeting scheduling
    await loadGroupsForMeetingSchedule(supervisorId);
    
    console.log('Supervisor meetings page loaded successfully');
    
  } catch (error) {
    console.error('Error loading supervisor meetings page:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error loading meetings data.', 'error');
    }
  }
}

// Load all supervisor meetings with details
async function loadAllSupervisorMeetings(supervisorId) {
  try {
    const meetingsSnapshot = await db.collection('meetings')
      .where('supervisorId', '==', supervisorId)
      .orderBy('scheduledDate', 'desc')
      .get();
    
    const meetings = [];
    
    for (const meetingDoc of meetingsSnapshot.docs) {
      const meetingData = meetingDoc.data();
      
      // Get group information
      const groupDoc = await db.collection('groups').doc(meetingData.groupId).get();
      const groupData = groupDoc.exists ? groupDoc.data() : null;
      
      // Get student information
      let studentNames = [];
      if (groupData && groupData.members) {
        for (const memberId of groupData.members) {
          const memberDoc = await db.collection('users').doc(memberId).get();
          if (memberDoc.exists) {
            studentNames.push(memberDoc.data().displayName);
          }
        }
      }
      
      meetings.push({
        id: meetingDoc.id,
        title: meetingData.title || 'Meeting',
        type: meetingData.type || 'general',
        status: meetingData.status || 'scheduled',
        scheduledDate: meetingData.scheduledDate || null,
        time: meetingData.time || '',
        duration: meetingData.duration || 60,
        location: meetingData.location || '',
        agenda: meetingData.agenda || '',
        groupId: meetingData.groupId,
        groupName: groupData ? groupData.groupName : 'Unknown Group',
        studentNames: studentNames,
        supervisorId: meetingData.supervisorId,
        notes: meetingData.notes || '',
        createdAt: meetingData.createdAt || null
      });
    }
    
    return meetings;
  } catch (error) {
    console.error('Error loading supervisor meetings:', error);
    return [];
  }
}

// Load groups for meeting scheduling
async function loadGroupsForMeetingSchedule(supervisorId) {
  try {
    const groupsSnapshot = await db.collection('groups')
      .where('supervisorId', '==', supervisorId)
      .get();
    
    const groupSelect = document.getElementById('meetingGroup');
    if (!groupSelect) return;
    
    // Clear existing options except the first one
    while (groupSelect.children.length > 1) {
      groupSelect.removeChild(groupSelect.lastChild);
    }
    
    groupsSnapshot.docs.forEach(doc => {
      const groupData = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = groupData.groupName || doc.id;
      groupSelect.appendChild(option);
    });
    
  } catch (error) {
    console.error('Error loading groups for meeting schedule:', error);
  }
}

// Update statistics cards
function updateMeetingsStats(meetingsData) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const upcomingCount = meetingsData.filter(m => 
    m.status === 'scheduled' && new Date(m.scheduledDate) >= today
  ).length;
  
  const todayCount = meetingsData.filter(m => {
    const meetingDate = new Date(m.scheduledDate);
    return meetingDate >= today && meetingDate < tomorrow;
  }).length;
  
  const completedCount = meetingsData.filter(m => m.status === 'completed').length;
  const cancelledCount = meetingsData.filter(m => m.status === 'cancelled').length;
  
  document.getElementById('upcomingCount').textContent = upcomingCount;
  document.getElementById('todayCount').textContent = todayCount;
  document.getElementById('completedCount').textContent = completedCount;
  document.getElementById('cancelledCount').textContent = cancelledCount;
}

// Display meetings list
function displayMeetingsList(meetingsData) {
  const container = document.getElementById('meetingsListContainer');
  if (!container) return;
  
  if (meetingsData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-calendar-alt" style="font-size: 48px; color: #cbd5e1; margin-bottom: 20px;"></i>
        <h4>No Meetings Found</h4>
        <p style="color: #6b7280;">No meetings have been scheduled yet.</p>
      </div>
    `;
    return;
  }
  
  const meetingsHtml = meetingsData.map(meeting => {
    const meetingDate = new Date(meeting.scheduledDate);
    const isUpcoming = meetingDate >= new Date();
    
    return `
      <div class="meeting-card" data-meeting-id="${meeting.id}" data-status="${meeting.status}" data-type="${meeting.type}" data-date="${meeting.scheduledDate}">
        <div class="meeting-card-header">
          <div class="meeting-info">
            <h4>${meeting.title}</h4>
            <span class="meeting-id">ID: ${meeting.id}</span>
          </div>
          <span class="status-badge ${meeting.status}">${formatStatus(meeting.status)}</span>
        </div>
        
        <div class="meeting-card-body">
          <div class="meeting-detail">
            <i class="fas fa-users"></i>
            <div>
              <label>Group</label>
              <p>${meeting.groupName}</p>
            </div>
          </div>
          
          <div class="meeting-detail">
            <i class="fas fa-calendar"></i>
            <div>
              <label>Date & Time</label>
              <p>${meeting.scheduledDate ? new Date(meeting.scheduledDate).toLocaleDateString() : 'N/A'} at ${meeting.time}</p>
            </div>
          </div>
          
          <div class="meeting-detail">
            <i class="fas fa-tag"></i>
            <div>
              <label>Type</label>
              <p>${formatMeetingType(meeting.type)}</p>
            </div>
          </div>
          
          <div class="meeting-detail">
            <i class="fas fa-map-marker-alt"></i>
            <div>
              <label>Location</label>
              <p>${meeting.location || 'N/A'}</p>
            </div>
          </div>
        </div>
        
        <div class="meeting-agenda">
          <p><strong>Agenda:</strong> ${meeting.agenda.substring(0, 100)}${meeting.agenda.length > 100 ? '...' : ''}</p>
        </div>
        
        <div class="meeting-card-actions">
          <button class="btn btn-primary" onclick="viewMeetingDetails('${meeting.id}')">
            <i class="fas fa-eye"></i> Details
          </button>
          ${isUpcoming && meeting.status === 'scheduled' ? `
            <button class="btn btn-success" onclick="startMeeting('${meeting.id}')">
              <i class="fas fa-play"></i> Start
            </button>
          ` : ''}
          <button class="btn btn-secondary" onclick="editMeeting('${meeting.id}')">
            <i class="fas fa-edit"></i> Edit
          </button>
          ${isUpcoming ? `
            <button class="btn btn-danger" onclick="cancelMeeting('${meeting.id}')">
              <i class="fas fa-times"></i> Cancel
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = meetingsHtml;
}

// Filter meetings based on search and filters
function filterMeetings() {
  const searchInput = document.getElementById('meetingSearchInput').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  const typeFilter = document.getElementById('typeFilter').value;
  const dateFilter = document.getElementById('dateFilter').value;
  
  const filteredMeetings = supervisorMeetingsData.filter(meeting => {
    const matchesSearch = 
      meeting.title.toLowerCase().includes(searchInput) ||
      meeting.groupName.toLowerCase().includes(searchInput) ||
      meeting.studentNames.some(name => name.toLowerCase().includes(searchInput));
    
    const matchesStatus = statusFilter === 'all' || meeting.status === statusFilter;
    const matchesType = typeFilter === 'all' || meeting.type === typeFilter;
    
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const meetingDate = new Date(meeting.scheduledDate);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      switch(dateFilter) {
        case 'today':
          matchesDate = meetingDate >= today && meetingDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
          break;
        case 'week':
          matchesDate = meetingDate >= weekStart && meetingDate <= weekEnd;
          break;
        case 'month':
          matchesDate = meetingDate >= monthStart && meetingDate <= monthEnd;
          break;
        case 'upcoming':
          matchesDate = meetingDate >= today;
          break;
      }
    }
    
    return matchesSearch && matchesStatus && matchesType && matchesDate;
  });
  
  displayMeetingsList(filteredMeetings);
}

// View meeting details
async function viewMeetingDetails(meetingId) {
  try {
    const meeting = supervisorMeetingsData.find(m => m.id === meetingId);
    if (!meeting) {
      if (typeof showNotification !== 'undefined') {
        showNotification('Meeting not found', 'error');
      }
      return;
    }
    
    const modal = document.getElementById('meetingDetailsModal');
    const content = document.getElementById('meetingDetailsContent');
    
    content.innerHTML = `
      <div class="meeting-details">
        <div class="details-section">
          <h4>Meeting Information</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <label>Title:</label>
              <p>${meeting.title}</p>
            </div>
            <div class="detail-item">
              <label>Group:</label>
              <p>${meeting.groupName}</p>
            </div>
            <div class="detail-item">
              <label>Students:</label>
              <p>${meeting.studentNames.join(', ')}</p>
            </div>
            <div class="detail-item">
              <label>Type:</label>
              <p>${formatMeetingType(meeting.type)}</p>
            </div>
            <div class="detail-item">
              <label>Date:</label>
              <p>${meeting.scheduledDate ? new Date(meeting.scheduledDate).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div class="detail-item">
              <label>Time:</label>
              <p>${meeting.time}</p>
            </div>
            <div class="detail-item">
              <label>Duration:</label>
              <p>${meeting.duration} minutes</p>
            </div>
            <div class="detail-item">
              <label>Location:</label>
              <p>${meeting.location || 'N/A'}</p>
            </div>
            <div class="detail-item">
              <label>Status:</label>
              <span class="status-badge ${meeting.status}">${formatStatus(meeting.status)}</span>
            </div>
          </div>
        </div>
        
        <div class="details-section">
          <h4>Agenda</h4>
          <p>${meeting.agenda || 'No agenda specified'}</p>
        </div>
        
        ${meeting.notes ? `
          <div class="details-section">
            <h4>Meeting Notes</h4>
            <p>${meeting.notes}</p>
          </div>
        ` : ''}
        
        <div class="details-section">
          <h4>Actions</h4>
          <div class="action-buttons">
            ${meeting.status === 'scheduled' ? `
              <button class="btn btn-success" onclick="startMeeting('${meeting.id}')">
                <i class="fas fa-play"></i> Start Meeting
              </button>
              <button class="btn btn-warning" onclick="rescheduleMeeting('${meeting.id}')">
                <i class="fas fa-calendar-alt"></i> Reschedule
              </button>
            ` : ''}
            ${meeting.status === 'in_progress' ? `
              <button class="btn btn-primary" onclick="completeMeeting('${meeting.id}')">
                <i class="fas fa-check"></i> Complete Meeting
              </button>
            ` : ''}
            <button class="btn btn-secondary" onclick="editMeeting('${meeting.id}')">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-info" onclick="sendMeetingReminder('${meeting.id}')">
              <i class="fas fa-bell"></i> Send Reminder
            </button>
          </div>
        </div>
      </div>
    `;
    
    modal.style.display = 'block';
    
  } catch (error) {
    console.error('Error viewing meeting details:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error loading meeting details', 'error');
    }
  }
}

// Schedule meeting form submission
document.getElementById('scheduleMeetingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  try {
    const title = document.getElementById('meetingTitle').value;
    const groupId = document.getElementById('meetingGroup').value;
    const date = document.getElementById('meetingDate').value;
    const time = document.getElementById('meetingTime').value;
    const type = document.getElementById('meetingType').value;
    const location = document.getElementById('meetingLocation').value;
    const agenda = document.getElementById('meetingAgenda').value;
    const duration = parseInt(document.getElementById('meetingDuration').value);
    const supervisorId = localStorage.getItem('uid');
    
    // Combine date and time for scheduledDate
    const scheduledDate = new Date(`${date}T${time}`);
    
    await db.collection('meetings').add({
      title: title,
      groupId: groupId,
      supervisorId: supervisorId,
      scheduledDate: scheduledDate.toISOString(),
      time: time,
      duration: duration,
      type: type,
      location: location,
      agenda: agenda,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    });
    
    // Send notifications to group members
    const groupDoc = await db.collection('groups').doc(groupId).get();
    if (groupDoc.exists) {
      const groupData = groupDoc.data();
      if (groupData.members) {
        for (const memberId of groupData.members) {
          await db.collection('notifications').add({
            userId: memberId,
            type: 'meeting_scheduled',
            title: 'New Meeting Scheduled',
            message: `Meeting "${title}" scheduled for ${new Date(scheduledDate).toLocaleDateString()} at ${time}`,
            meetingId: '', // Will be set after getting the ID
            createdAt: new Date().toISOString(),
            read: false
          });
        }
      }
    }
    
    if (typeof showNotification !== 'undefined') {
      showNotification('Meeting scheduled successfully!', 'success');
    }
    
    closeScheduleMeetingModal();
    loadSupervisorMeetingsPage(); // Reload data
    
  } catch (error) {
    console.error('Error scheduling meeting:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error scheduling meeting', 'error');
    }
  }
});

// Meeting action functions
async function startMeeting(meetingId) {
  try {
    await db.collection('meetings').doc(meetingId).update({
      status: 'in_progress',
      startedAt: new Date().toISOString()
    });
    
    if (typeof showNotification !== 'undefined') {
      showNotification('Meeting started!', 'success');
    }
    
    loadSupervisorMeetingsPage();
    closeMeetingDetailsModal();
    
  } catch (error) {
    console.error('Error starting meeting:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error starting meeting', 'error');
    }
  }
}

async function completeMeeting(meetingId) {
  try {
    const notes = prompt('Enter meeting notes:');
    if (notes === null) return; // User cancelled
    
    await db.collection('meetings').doc(meetingId).update({
      status: 'completed',
      completedAt: new Date().toISOString(),
      notes: notes || ''
    });
    
    if (typeof showNotification !== 'undefined') {
      showNotification('Meeting completed!', 'success');
    }
    
    loadSupervisorMeetingsPage();
    closeMeetingDetailsModal();
    
  } catch (error) {
    console.error('Error completing meeting:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error completing meeting', 'error');
    }
  }
}

async function cancelMeeting(meetingId) {
  if (!confirm('Are you sure you want to cancel this meeting?')) return;
  
  try {
    await db.collection('meetings').doc(meetingId).update({
      status: 'cancelled',
      cancelledAt: new Date().toISOString()
    });
    
    if (typeof showNotification !== 'undefined') {
      showNotification('Meeting cancelled', 'info');
    }
    
    loadSupervisorMeetingsPage();
    
  } catch (error) {
    console.error('Error cancelling meeting:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error cancelling meeting', 'error');
    }
  }
}

function editMeeting(meetingId) {
  if (typeof showNotification !== 'undefined') {
    showNotification('Edit meeting feature coming soon!', 'info');
  }
}

function rescheduleMeeting(meetingId) {
  if (typeof showNotification !== 'undefined') {
    showNotification('Reschedule meeting feature coming soon!', 'info');
  }
}

async function sendMeetingReminder(meetingId) {
  try {
    const meeting = supervisorMeetingsData.find(m => m.id === meetingId);
    if (!meeting) return;
    
    const groupDoc = await db.collection('groups').doc(meeting.groupId).get();
    if (groupDoc.exists) {
      const groupData = groupDoc.data();
      if (groupData.members) {
        for (const memberId of groupData.members) {
          await db.collection('notifications').add({
            userId: memberId,
            type: 'meeting_reminder',
            title: 'Meeting Reminder',
            message: `Reminder: Meeting "${meeting.title}" scheduled for ${new Date(meeting.scheduledDate).toLocaleDateString()} at ${meeting.time}`,
            meetingId: meetingId,
            createdAt: new Date().toISOString(),
            read: false
          });
        }
      }
    }
    
    if (typeof showNotification !== 'undefined') {
      showNotification('Reminder sent to all participants!', 'success');
    }
    
  } catch (error) {
    console.error('Error sending reminder:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error sending reminder', 'error');
    }
  }
}

function viewCalendar() {
  if (typeof showNotification !== 'undefined') {
    showNotification('Calendar view feature coming soon!', 'info');
  }
}

// Modal functions
function closeScheduleMeetingModal() {
  document.getElementById('scheduleMeetingModal').style.display = 'none';
  document.getElementById('scheduleMeetingForm').reset();
}

function closeMeetingDetailsModal() {
  document.getElementById('meetingDetailsModal').style.display = 'none';
}

function openScheduleMeetingModal() {
  document.getElementById('scheduleMeetingModal').style.display = 'block';
}

// Helper functions
function formatStatus(status) {
  if (!status) return 'Scheduled';
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatMeetingType(type) {
  const types = {
    'proposal_review': 'Proposal Review',
    'progress_review': 'Progress Review',
    'final_review': 'Final Review',
    'general': 'General'
  };
  return types[type] || type;
}

function showNotifications() {
  if (typeof showNotification !== 'undefined') {
    showNotification('Notification center coming soon!', 'info');
  }
}

// Close modals when clicking outside
window.onclick = function(event) {
  const scheduleModal = document.getElementById('scheduleMeetingModal');
  const detailsModal = document.getElementById('meetingDetailsModal');
  
  if (event.target === scheduleModal) {
    scheduleModal.style.display = 'none';
  }
  if (event.target === detailsModal) {
    detailsModal.style.display = 'none';
  }
}
