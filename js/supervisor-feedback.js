// Firebase Authentication Check for Supervisor Feedback Page
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

    console.log('Supervisor role confirmed, loading feedback data...');
    
    localStorage.setItem('uid', user.uid);
    localStorage.setItem('displayName', userData.displayName || user.email);
    localStorage.setItem('role', userData.role);
    
    loadSupervisorFeedbackPage();
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

// Global variables to store feedback data
let supervisorFeedbackData = {
  given: [],
  received: [],
  pending: []
};

// Load all feedback page data
async function loadSupervisorFeedbackPage() {
  console.log('Loading supervisor feedback page data...');
  
  try {
    const supervisorId = localStorage.getItem('uid');
    
    if (!supervisorId) {
      console.log('Missing supervisorId');
      if (typeof showNotification !== 'undefined') {
        showNotification('Missing user information. Please log in again.', 'error');
      }
      return;
    }
    
    // Load feedback data
    const feedbackData = await loadAllFeedbackData(supervisorId);
    supervisorFeedbackData = feedbackData;
    
    // Update stats
    updateFeedbackStats(feedbackData);
    
    // Display feedback
    displayGivenFeedback(feedbackData.given);
    displayReceivedFeedback(feedbackData.received);
    displayPendingFeedback(feedbackData.pending);
    
    // Load students and projects for feedback form
    await loadStudentsAndProjects(supervisorId);
    
    console.log('Supervisor feedback page loaded successfully');
    
  } catch (error) {
    console.error('Error loading supervisor feedback page:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error loading feedback data.', 'error');
    }
  }
}

// Load all feedback data
async function loadAllFeedbackData(supervisorId) {
  try {
    // Load given feedback
    const givenSnapshot = await db.collection('feedback')
      .where('fromUserId', '==', supervisorId)
      .orderBy('createdAt', 'desc')
      .get();
    
    const givenFeedback = [];
    for (const doc of givenSnapshot.docs) {
      const data = doc.data();
      const studentDoc = await db.collection('users').doc(data.toUserId).get();
      const studentData = studentDoc.exists ? studentDoc.data() : null;
      
      givenFeedback.push({
        id: doc.id,
        ...data,
        studentName: studentData ? studentData.displayName : 'Unknown Student',
        studentEmail: studentData ? studentData.email : ''
      });
    }
    
    // Load received feedback
    const receivedSnapshot = await db.collection('feedback')
      .where('toUserId', '==', supervisorId)
      .orderBy('createdAt', 'desc')
      .get();
    
    const receivedFeedback = [];
    for (const doc of receivedSnapshot.docs) {
      const data = doc.data();
      const fromUserDoc = await db.collection('users').doc(data.fromUserId).get();
      const fromUserData = fromUserDoc.exists ? fromUserDoc.data() : null;
      
      receivedFeedback.push({
        id: doc.id,
        ...data,
        fromUserName: fromUserData ? fromUserData.displayName : 'Unknown User',
        fromUserEmail: fromUserData ? fromUserData.email : ''
      });
    }
    
    // Load pending responses (notifications that need feedback)
    const pendingSnapshot = await db.collection('notifications')
      .where('userId', '==', supervisorId)
      .where('type', 'in', ['proposal_review_request', 'report_review_request', 'meeting_feedback_request'])
      .where('read', '==', false)
      .orderBy('createdAt', 'desc')
      .get();
    
    const pendingFeedback = [];
    for (const doc of pendingSnapshot.docs) {
      const data = doc.data();
      pendingFeedback.push({
        id: doc.id,
        ...data,
        type: 'pending_response'
      });
    }
    
    return {
      given: givenFeedback,
      received: receivedFeedback,
      pending: pendingFeedback
    };
    
  } catch (error) {
    console.error('Error loading feedback data:', error);
    return { given: [], received: [], pending: [] };
  }
}

// Load students and projects for feedback form
async function loadStudentsAndProjects(supervisorId) {
  try {
    // Get all groups assigned to supervisor
    const groupsSnapshot = await db.collection('groups')
      .where('supervisorId', '==', supervisorId)
      .get();
    
    const studentSelect = document.getElementById('feedbackStudent');
    const projectSelect = document.getElementById('feedbackProject');
    
    if (!studentSelect || !projectSelect) return;
    
    // Clear existing options
    while (studentSelect.children.length > 1) {
      studentSelect.removeChild(studentSelect.lastChild);
    }
    while (projectSelect.children.length > 1) {
      projectSelect.removeChild(projectSelect.lastChild);
    }
    
    const students = new Set();
    const projects = new Set();
    
    for (const groupDoc of groupsSnapshot.docs) {
      const groupData = groupDoc.data();
      
      // Add students
      if (groupData.members) {
        for (const memberId of groupData.members) {
          if (!students.has(memberId)) {
            students.add(memberId);
            const memberDoc = await db.collection('users').doc(memberId).get();
            if (memberDoc.exists) {
              const memberData = memberDoc.data();
              const option = document.createElement('option');
              option.value = memberId;
              option.textContent = memberData.displayName;
              studentSelect.appendChild(option);
            }
          }
        }
      }
      
      // Add projects
      const projectSnapshot = await db.collection('projects')
        .where('groupId', '==', groupDoc.id)
        .get();
      
      projectSnapshot.docs.forEach(doc => {
        if (!projects.has(doc.id)) {
          projects.add(doc.id);
          const projectData = doc.data();
          const option = document.createElement('option');
          option.value = doc.id;
          option.textContent = projectData.title || 'Untitled Project';
          projectSelect.appendChild(option);
        }
      });
    }
    
  } catch (error) {
    console.error('Error loading students and projects:', error);
  }
}

// Update statistics cards
function updateFeedbackStats(feedbackData) {
  const totalGiven = feedbackData.given.length;
  const weeklyCount = feedbackData.given.filter(f => {
    const feedbackDate = new Date(f.createdAt);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return feedbackDate >= weekAgo;
  }).length;
  
  const studentsHelped = new Set(feedbackData.given.map(f => f.toUserId)).size;
  const pendingCount = feedbackData.pending.length;
  
  document.getElementById('totalGivenCount').textContent = totalGiven;
  document.getElementById('weeklyCount').textContent = weeklyCount;
  document.getElementById('studentsHelpedCount').textContent = studentsHelped;
  document.getElementById('pendingCount').textContent = pendingCount;
}

// Display given feedback
function displayGivenFeedback(feedbackData) {
  const container = document.getElementById('givenFeedbackContainer');
  if (!container) return;
  
  if (feedbackData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-comment" style="font-size: 48px; color: #cbd5e1; margin-bottom: 20px;"></i>
        <h4>No Feedback Given</h4>
        <p style="color: #6b7280;">You haven't given any feedback yet.</p>
      </div>
    `;
    return;
  }
  
  const feedbackHtml = feedbackData.map(feedback => `
    <div class="feedback-card" data-feedback-id="${feedback.id}" data-type="${feedback.type}" data-rating="${feedback.rating}">
      <div class="feedback-card-header">
        <div class="feedback-info">
          <h4>${feedback.type ? feedback.type.charAt(0).toUpperCase() + feedback.type.slice(1) : 'General'} Feedback</h4>
          <span class="feedback-date">${feedback.createdAt ? new Date(feedback.createdAt).toLocaleDateString() : 'N/A'}</span>
        </div>
        <div class="feedback-rating">
          ${generateStars(feedback.rating || 0)}
        </div>
      </div>
      
      <div class="feedback-card-body">
        <div class="feedback-detail">
          <i class="fas fa-user-graduate"></i>
          <div>
            <label>Student</label>
            <p>${feedback.studentName}</p>
          </div>
        </div>
        
        ${feedback.projectId ? `
          <div class="feedback-detail">
            <i class="fas fa-project-diagram"></i>
            <div>
              <label>Project</label>
              <p>${feedback.projectTitle || 'Related Project'}</p>
            </div>
          </div>
        ` : ''}
        
        <div class="feedback-detail">
          <i class="fas fa-eye"></i>
          <div>
            <label>Visibility</label>
            <p>${feedback.isPrivate ? 'Private' : 'Public'}</p>
          </div>
        </div>
      </div>
      
      <div class="feedback-message">
        <p>${feedback.message}</p>
      </div>
      
      ${feedback.suggestions ? `
        <div class="feedback-suggestions">
          <h5>Suggestions:</h5>
          <p>${feedback.suggestions}</p>
        </div>
      ` : ''}
      
      <div class="feedback-card-actions">
        <button class="btn btn-primary" onclick="viewFeedbackDetails('${feedback.id}', 'given')">
          <i class="fas fa-eye"></i> View
        </button>
        <button class="btn btn-secondary" onclick="editFeedback('${feedback.id}')">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn btn-danger" onclick="deleteFeedback('${feedback.id}')">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = feedbackHtml;
}

// Display received feedback
function displayReceivedFeedback(feedbackData) {
  const container = document.getElementById('receivedFeedbackContainer');
  if (!container) return;
  
  if (feedbackData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox" style="font-size: 48px; color: #cbd5e1; margin-bottom: 20px;"></i>
        <h4>No Feedback Received</h4>
        <p style="color: #6b7280;">You haven't received any feedback yet.</p>
      </div>
    `;
    return;
  }
  
  const feedbackHtml = feedbackData.map(feedback => `
    <div class="feedback-card received" data-feedback-id="${feedback.id}" data-type="${feedback.type}" data-rating="${feedback.rating}">
      <div class="feedback-card-header">
        <div class="feedback-info">
          <h4>${feedback.type ? feedback.type.charAt(0).toUpperCase() + feedback.type.slice(1) : 'General'} Feedback</h4>
          <span class="feedback-date">${feedback.createdAt ? new Date(feedback.createdAt).toLocaleDateString() : 'N/A'}</span>
        </div>
        <div class="feedback-rating">
          ${generateStars(feedback.rating || 0)}
        </div>
      </div>
      
      <div class="feedback-card-body">
        <div class="feedback-detail">
          <i class="fas fa-user"></i>
          <div>
            <label>From</label>
            <p>${feedback.fromUserName}</p>
          </div>
        </div>
        
        ${feedback.projectId ? `
          <div class="feedback-detail">
            <i class="fas fa-project-diagram"></i>
            <div>
              <label>Project</label>
              <p>${feedback.projectTitle || 'Related Project'}</p>
            </div>
          </div>
        ` : ''}
      </div>
      
      <div class="feedback-message">
        <p>${feedback.message}</p>
      </div>
      
      ${feedback.suggestions ? `
        <div class="feedback-suggestions">
          <h5>Suggestions:</h5>
          <p>${feedback.suggestions}</p>
        </div>
      ` : ''}
      
      <div class="feedback-card-actions">
        <button class="btn btn-primary" onclick="viewFeedbackDetails('${feedback.id}', 'received')">
          <i class="fas fa-eye"></i> View
        </button>
        <button class="btn btn-success" onclick="respondToFeedback('${feedback.id}')">
          <i class="fas fa-reply"></i> Respond
        </button>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = feedbackHtml;
}

// Display pending feedback
function displayPendingFeedback(feedbackData) {
  const container = document.getElementById('pendingFeedbackContainer');
  if (!container) return;
  
  if (feedbackData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-check-circle" style="font-size: 48px; color: #cbd5e1; margin-bottom: 20px;"></i>
        <h4>No Pending Responses</h4>
        <p style="color: #6b7280;">All caught up! No pending responses.</p>
      </div>
    `;
    return;
  }
  
  const feedbackHtml = feedbackData.map(feedback => `
    <div class="feedback-card pending" data-feedback-id="${feedback.id}">
      <div class="feedback-card-header">
        <div class="feedback-info">
          <h4>${feedback.title}</h4>
          <span class="feedback-date">${feedback.createdAt ? new Date(feedback.createdAt).toLocaleDateString() : 'N/A'}</span>
        </div>
        <span class="status-badge pending">Pending</span>
      </div>
      
      <div class="feedback-card-body">
        <div class="feedback-detail">
          <i class="fas fa-info-circle"></i>
          <div>
            <label>Type</label>
            <p>${formatNotificationType(feedback.type)}</p>
          </div>
        </div>
      </div>
      
      <div class="feedback-message">
        <p>${feedback.message}</p>
      </div>
      
      <div class="feedback-card-actions">
        <button class="btn btn-primary" onclick="handlePendingResponse('${feedback.id}')">
          <i class="fas fa-reply"></i> Respond
        </button>
        <button class="btn btn-secondary" onclick="dismissNotification('${feedback.id}')">
          <i class="fas fa-times"></i> Dismiss
        </button>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = feedbackHtml;
}

// Tab switching
function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Remove active class from all buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected tab
  document.getElementById(tabName + 'Tab').classList.add('active');
  
  // Add active class to clicked button
  event.target.classList.add('active');
}

// Filter feedback
function filterFeedback() {
  const searchInput = document.getElementById('feedbackSearchInput').value.toLowerCase();
  const typeFilter = document.getElementById('typeFilter').value;
  const ratingFilter = document.getElementById('ratingFilter').value;
  const dateFilter = document.getElementById('dateFilter').value;
  
  // Get current active tab
  const activeTab = document.querySelector('.tab-content.active').id;
  const currentData = activeTab === 'givenTab' ? supervisorFeedbackData.given :
                      activeTab === 'receivedTab' ? supervisorFeedbackData.received :
                      supervisorFeedbackData.pending;
  
  const filteredFeedback = currentData.filter(feedback => {
    const matchesSearch = 
      feedback.message.toLowerCase().includes(searchInput) ||
      feedback.studentName?.toLowerCase().includes(searchInput) ||
      feedback.fromUserName?.toLowerCase().includes(searchInput) ||
      feedback.title?.toLowerCase().includes(searchInput);
    
    const matchesType = typeFilter === 'all' || feedback.type === typeFilter;
    const matchesRating = ratingFilter === 'all' || feedback.rating == ratingFilter;
    
    let matchesDate = true;
    if (dateFilter !== 'all' && feedback.createdAt) {
      const feedbackDate = new Date(feedback.createdAt);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - today.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      switch(dateFilter) {
        case 'today':
          matchesDate = feedbackDate >= today && feedbackDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
          break;
        case 'week':
          matchesDate = feedbackDate >= weekStart;
          break;
        case 'month':
          matchesDate = feedbackDate >= monthStart;
          break;
      }
    }
    
    return matchesSearch && matchesType && matchesRating && matchesDate;
  });
  
  // Display filtered results
  if (activeTab === 'givenTab') {
    displayGivenFeedback(filteredFeedback);
  } else if (activeTab === 'receivedTab') {
    displayReceivedFeedback(filteredFeedback);
  } else {
    displayPendingFeedback(filteredFeedback);
  }
}

// Rating system
document.addEventListener('DOMContentLoaded', function() {
  const stars = document.querySelectorAll('#ratingInput .fa-star');
  const ratingInput = document.getElementById('feedbackRating');
  
  stars.forEach(star => {
    star.addEventListener('click', function() {
      const rating = parseInt(this.dataset.rating);
      ratingInput.value = rating;
      updateStarDisplay(rating);
    });
    
    star.addEventListener('mouseenter', function() {
      const rating = parseInt(this.dataset.rating);
      updateStarDisplay(rating);
    });
  });
  
  document.getElementById('ratingInput').addEventListener('mouseleave', function() {
    updateStarDisplay(parseInt(ratingInput.value));
  });
});

function updateStarDisplay(rating) {
  const stars = document.querySelectorAll('#ratingInput .fa-star');
  stars.forEach((star, index) => {
    if (index < rating) {
      star.classList.add('active');
    } else {
      star.classList.remove('active');
    }
  });
}

function generateStars(rating) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += `<i class="fas fa-star ${i <= rating ? 'active' : ''}"></i>`;
  }
  return stars;
}

// New feedback form submission
document.getElementById('newFeedbackForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  try {
    const studentId = document.getElementById('feedbackStudent').value;
    const type = document.getElementById('feedbackType').value;
    const projectId = document.getElementById('feedbackProject').value;
    const rating = parseInt(document.getElementById('feedbackRating').value);
    const message = document.getElementById('feedbackMessage').value;
    const suggestions = document.getElementById('feedbackSuggestions').value;
    const isPrivate = document.getElementById('feedbackPrivate').checked;
    const supervisorId = localStorage.getItem('uid');
    
    if (rating === 0) {
      if (typeof showNotification !== 'undefined') {
        showNotification('Please select a rating', 'error');
      }
      return;
    }
    
    let projectTitle = '';
    if (projectId) {
      const projectDoc = await db.collection('projects').doc(projectId).get();
      if (projectDoc.exists) {
        projectTitle = projectDoc.data().title;
      }
    }
    
    await db.collection('feedback').add({
      fromUserId: supervisorId,
      toUserId: studentId,
      type: type,
      projectId: projectId,
      projectTitle: projectTitle,
      rating: rating,
      message: message,
      suggestions: suggestions,
      isPrivate: isPrivate,
      createdAt: new Date().toISOString()
    });
    
    // Send notification to student
    await db.collection('notifications').add({
      userId: studentId,
      type: 'feedback_received',
      title: 'New Feedback Received',
      message: `You have received new feedback from your supervisor.`,
      feedbackId: '', // Will be set after getting the ID
      createdAt: new Date().toISOString(),
      read: false
    });
    
    if (typeof showNotification !== 'undefined') {
      showNotification('Feedback sent successfully!', 'success');
    }
    
    closeNewFeedbackModal();
    loadSupervisorFeedbackPage(); // Reload data
    
  } catch (error) {
    console.error('Error sending feedback:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error sending feedback', 'error');
    }
  }
});

// Feedback action functions
function viewFeedbackDetails(feedbackId, type) {
  const feedback = type === 'given' ? 
    supervisorFeedbackData.given.find(f => f.id === feedbackId) :
    supervisorFeedbackData.received.find(f => f.id === feedbackId);
  
  if (!feedback) return;
  
  const modal = document.getElementById('feedbackDetailsModal');
  const content = document.getElementById('feedbackDetailsContent');
  
  content.innerHTML = `
    <div class="feedback-details">
      <div class="details-section">
        <h4>Feedback Information</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <label>Type:</label>
            <p>${feedback.type ? feedback.type.charAt(0).toUpperCase() + feedback.type.slice(1) : 'General'}</p>
          </div>
          <div class="detail-item">
            <label>Date:</label>
            <p>${feedback.createdAt ? new Date(feedback.createdAt).toLocaleDateString() : 'N/A'}</p>
          </div>
          <div class="detail-item">
            <label>Rating:</label>
            <p>${generateStars(feedback.rating || 0)}</p>
          </div>
          <div class="detail-item">
            <label>Visibility:</label>
            <p>${feedback.isPrivate ? 'Private' : 'Public'}</p>
          </div>
        </div>
      </div>
      
      <div class="details-section">
        <h4>Message</h4>
        <p>${feedback.message}</p>
      </div>
      
      ${feedback.suggestions ? `
        <div class="details-section">
          <h4>Suggestions</h4>
          <p>${feedback.suggestions}</p>
        </div>
      ` : ''}
    </div>
  `;
  
  modal.style.display = 'block';
}

function editFeedback(feedbackId) {
  if (typeof showNotification !== 'undefined') {
    showNotification('Edit feedback feature coming soon!', 'info');
  }
}

async function deleteFeedback(feedbackId) {
  if (!confirm('Are you sure you want to delete this feedback?')) return;
  
  try {
    await db.collection('feedback').doc(feedbackId).delete();
    
    if (typeof showNotification !== 'undefined') {
      showNotification('Feedback deleted successfully', 'success');
    }
    
    loadSupervisorFeedbackPage();
    
  } catch (error) {
    console.error('Error deleting feedback:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error deleting feedback', 'error');
    }
  }
}

function respondToFeedback(feedbackId) {
  if (typeof showNotification !== 'undefined') {
    showNotification('Respond to feedback feature coming soon!', 'info');
  }
}

function handlePendingResponse(notificationId) {
  if (typeof showNotification !== 'undefined') {
    showNotification('Handle pending response feature coming soon!', 'info');
  }
}

async function dismissNotification(notificationId) {
  try {
    await db.collection('notifications').doc(notificationId).update({
      read: true
    });
    
    if (typeof showNotification !== 'undefined') {
      showNotification('Notification dismissed', 'info');
    }
    
    loadSupervisorFeedbackPage();
    
  } catch (error) {
    console.error('Error dismissing notification:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error dismissing notification', 'error');
    }
  }
}

function viewFeedbackAnalytics() {
  if (typeof showNotification !== 'undefined') {
    showNotification('Feedback analytics feature coming soon!', 'info');
  }
}

// Modal functions
function closeNewFeedbackModal() {
  document.getElementById('newFeedbackModal').style.display = 'none';
  document.getElementById('newFeedbackForm').reset();
  document.getElementById('feedbackRating').value = '0';
  updateStarDisplay(0);
}

function closeFeedbackDetailsModal() {
  document.getElementById('feedbackDetailsModal').style.display = 'none';
}

function openNewFeedbackModal() {
  document.getElementById('newFeedbackModal').style.display = 'block';
}

// Helper functions
function formatNotificationType(type) {
  const types = {
    'proposal_review_request': 'Proposal Review Request',
    'report_review_request': 'Report Review Request',
    'meeting_feedback_request': 'Meeting Feedback Request'
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
  const newFeedbackModal = document.getElementById('newFeedbackModal');
  const detailsModal = document.getElementById('feedbackDetailsModal');
  
  if (event.target === newFeedbackModal) {
    newFeedbackModal.style.display = 'none';
  }
  if (event.target === detailsModal) {
    detailsModal.style.display = 'none';
  }
}
