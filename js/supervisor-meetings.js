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
    
    // Update stats (count pending as needing attention)
    updateMeetingsStats(meetingsData);
    
    // Show pending requests at the top in a dedicated section
    displayPendingRequests(meetingsData.filter(m => m.status === 'pending'));

    // Display confirmed/other meetings
    displayMeetingsList(meetingsData.filter(m => m.status !== 'pending'));
    
    // Load groups for meeting scheduling
    await loadGroupsForMeetingSchedule(supervisorId);
    
    console.log('Supervisor meetings page loaded successfully');
    loadNotificationCount();
    
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
    // No orderBy to avoid needing a composite index; sort client-side
    const meetingsSnapshot = await db.collection('meetings')
      .where('supervisorId', '==', supervisorId)
      .get();
    
    const meetings = [];
    
    for (const meetingDoc of meetingsSnapshot.docs) {
      const meetingData = meetingDoc.data();
      
      // Get group information
      const groupDoc = await db.collection('groups').doc(meetingData.groupId).get();
      const groupData = groupDoc.exists ? groupDoc.data() : null;
      
      // Get student names — members array may be objects {fullName, ...} or plain UID strings
      let studentNames = [];
      if (groupData) {
        // Prefer memberUids array (set during registration)
        const memberUids = Array.isArray(groupData.memberUids) ? groupData.memberUids : [];

        // Also extract UIDs from the members objects array
        const membersArr = Array.isArray(groupData.members) ? groupData.members : [];
        const uidSet = new Set(memberUids);
        for (const m of membersArr) {
          if (typeof m === 'string') uidSet.add(m);
          else if (m && typeof m === 'object') {
            // Collect display name directly from the object if available
            if (m.fullName) studentNames.push(m.fullName);
            else if (m.displayName) studentNames.push(m.displayName);
            else if (m.name) studentNames.push(m.name);
            // Still record UID for further lookup
            if (m.uid) uidSet.add(m.uid);
          }
        }

        // Fetch names for UIDs not yet resolved
        if (studentNames.length === 0 && uidSet.size > 0) {
          for (const uid of uidSet) {
            try {
              const memberDoc = await db.collection('users').doc(uid).get();
              if (memberDoc.exists) studentNames.push(memberDoc.data().displayName || uid);
            } catch (_) { /* skip silently */ }
          }
        }
      }
      
      meetings.push({
        id: meetingDoc.id,
        title: meetingData.title || 'Meeting Request',
        type: meetingData.type || 'general',
        status: meetingData.status || 'pending',
        // Support both field names written by student and supervisor forms
        scheduledDate: meetingData.scheduledDate || meetingData.date || null,
        time: meetingData.time || '',
        duration: meetingData.duration || 60,
        location: meetingData.location || '',
        agenda: meetingData.agenda || meetingData.purpose || '',
        purpose: meetingData.purpose || meetingData.agenda || '',
        groupId: meetingData.groupId,
        groupName: groupData?.groupName || groupData?.groupId || meetingData.groupId || 'Unknown Group',
        studentNames,
        supervisorId: meetingData.supervisorId,
        requestedBy: meetingData.requestedBy || null,
        requestedDate: meetingData.requestedDate || null,
        notes: meetingData.notes || '',
        createdAt: meetingData.createdAt || null
      });
    }

    meetings.sort((a, b) => new Date(b.scheduledDate || 0) - new Date(a.scheduledDate || 0));
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

// Render a dedicated banner for pending student meeting requests
function displayPendingRequests(pendingMeetings) {
  // Find or create the pending requests container
  let container = document.getElementById('pendingRequestsSection');
  if (!container) {
    // Insert it before the meetings list container
    const listContainer = document.getElementById('meetingsListContainer');
    if (listContainer && listContainer.parentNode) {
      container = document.createElement('div');
      container.id = 'pendingRequestsSection';
      listContainer.parentNode.insertBefore(container, listContainer);
    } else {
      return;
    }
  }

  if (pendingMeetings.length === 0) {
    container.innerHTML = '';
    return;
  }

  const cards = pendingMeetings.map(m => {
    const dt = m.scheduledDate ? new Date(m.scheduledDate) : null;
    const dateStr = dt ? dt.toLocaleDateString() : 'N/A';
    const timeStr = m.time || (dt ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A');
    return `
      <div style="background:#fff;border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:8px;padding:16px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
          <div>
            <span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600;">PENDING APPROVAL</span>
            <h4 style="margin:8px 0 4px;">${m.title}</h4>
            <p style="margin:0;color:#6b7280;font-size:14px;">
              Group: <strong>${m.groupName}</strong> &nbsp;|&nbsp;
              Requested: <strong>${m.requestedDate ? new Date(m.requestedDate).toLocaleDateString() : 'N/A'}</strong>
            </p>
            <p style="margin:4px 0 0;color:#374151;font-size:14px;">
              Proposed date: <strong>${dateStr}</strong> at <strong>${timeStr}</strong> &nbsp;|&nbsp;
              Duration: <strong>${m.duration} min</strong> &nbsp;|&nbsp;
              Location: <strong>${m.location || 'TBD'}</strong>
            </p>
            ${m.purpose ? `<p style="margin:4px 0 0;color:#6b7280;font-size:13px;">Purpose: ${m.purpose}</p>` : ''}
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;">
            <button onclick="approveMeetingRequest('${m.id}')" style="padding:8px 16px;background:#10b981;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">
              ✓ Approve
            </button>
            <button onclick="rejectMeetingRequest('${m.id}')" style="padding:8px 16px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">
              ✗ Decline
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div style="margin-bottom:24px;">
      <h3 style="margin:0 0 12px;color:#92400e;display:flex;align-items:center;gap:8px;">
        <i class="fas fa-clock"></i> Pending Meeting Requests (${pendingMeetings.length})
      </h3>
      ${cards}
    </div>`;
}

// Approve a student meeting request
async function approveMeetingRequest(meetingId) {
  try {
    const meeting = supervisorMeetingsData.find(m => m.id === meetingId);
    if (!meeting) return;

    await db.collection('meetings').doc(meetingId).update({
      status: 'scheduled',
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Notify group members
    if (meeting.groupId) {
      const groupDoc = await db.collection('groups').doc(meeting.groupId).get();
      const memberUids = groupDoc.exists
        ? (groupDoc.data().memberUids || [])
        : [];
      for (const uid of memberUids) {
        await db.collection('notifications').add({
          userId: uid,
          type: 'meeting_approved',
          title: 'Meeting Request Approved',
          message: `Your meeting request for ${new Date(meeting.scheduledDate).toLocaleDateString()} at ${meeting.time} has been approved by your supervisor.`,
          meetingId,
          createdAt: new Date().toISOString(),
          read: false
        });
      }
    }

    if (typeof showNotification !== 'undefined') {
      showNotification('Meeting request approved and student notified.', 'success');
    }
    loadSupervisorMeetingsPage();
  } catch (err) {
    console.error('Error approving meeting request:', err);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error approving meeting request.', 'error');
    }
  }
}

// Decline a student meeting request
async function rejectMeetingRequest(meetingId) {
  const reason = prompt('Please enter a reason for declining this meeting request (optional):');
  if (reason === null) return; // User cancelled the dialog

  try {
    const meeting = supervisorMeetingsData.find(m => m.id === meetingId);
    if (!meeting) return;

    await db.collection('meetings').doc(meetingId).update({
      status: 'cancelled',
      declineReason: reason || '',
      declinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Notify group members
    if (meeting.groupId) {
      const groupDoc = await db.collection('groups').doc(meeting.groupId).get();
      const memberUids = groupDoc.exists
        ? (groupDoc.data().memberUids || [])
        : [];
      for (const uid of memberUids) {
        await db.collection('notifications').add({
          userId: uid,
          type: 'meeting_declined',
          title: 'Meeting Request Declined',
          message: `Your meeting request for ${new Date(meeting.scheduledDate).toLocaleDateString()} has been declined by your supervisor.${reason ? ' Reason: ' + reason : ''}`,
          meetingId,
          createdAt: new Date().toISOString(),
          read: false
        });
      }
    }

    if (typeof showNotification !== 'undefined') {
      showNotification('Meeting request declined and student notified.', 'info');
    }
    loadSupervisorMeetingsPage();
  } catch (err) {
    console.error('Error declining meeting request:', err);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error declining meeting request.', 'error');
    }
  }
}

// Update statistics cards
function updateMeetingsStats(meetingsData) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const pendingCount  = meetingsData.filter(m => m.status === 'pending').length;

  const upcomingCount = meetingsData.filter(m => 
    m.status === 'scheduled' && new Date(m.scheduledDate) >= today
  ).length;
  
  const todayCount = meetingsData.filter(m => {
    const meetingDate = new Date(m.scheduledDate);
    return meetingDate >= today && meetingDate < tomorrow;
  }).length;
  
  const completedCount = meetingsData.filter(m => m.status === 'completed').length;
  const cancelledCount = meetingsData.filter(m => m.status === 'cancelled').length;

  const elUpcoming   = document.getElementById('upcomingCount');
  const elToday      = document.getElementById('todayCount');
  const elCompleted  = document.getElementById('completedCount');
  const elCancelled  = document.getElementById('cancelledCount');

  if (elUpcoming)  elUpcoming.textContent  = upcomingCount;
  if (elToday)     elToday.textContent     = todayCount;
  if (elCompleted) elCompleted.textContent = completedCount;
  if (elCancelled) elCancelled.textContent = cancelledCount;

  // Highlight pending count on whichever stat card is available
  const pendingEl = document.getElementById('pendingCount');
  if (pendingEl) {
    pendingEl.textContent = pendingCount;
    const card = pendingEl.closest('.stat-card');
    if (card) card.style.borderColor = pendingCount > 0 ? '#f59e0b' : '';
  }
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
    
    // Send notifications to group members using memberUids (reliable UID list)
    const groupDoc = await db.collection('groups').doc(groupId).get();
    if (groupDoc.exists) {
      const groupData = groupDoc.data();
      const memberUids = Array.isArray(groupData.memberUids) ? groupData.memberUids : [];
      for (const uid of memberUids) {
        await db.collection('notifications').add({
          userId: uid,
          type: 'meeting_scheduled',
          title: 'New Meeting Scheduled',
          message: `Meeting "${title}" scheduled for ${new Date(scheduledDate).toLocaleDateString()} at ${time}`,
          createdAt: new Date().toISOString(),
          read: false
        });
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
      if (typeof showNotification !== 'undefined') showNotification('No new notifications.', 'info');
      return;
    }

    let existing = document.getElementById('notifDropdown');
    if (existing) { existing.remove(); return; }

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
