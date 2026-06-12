/**
 * Admin Feedback Page - Full Firebase Integration
 * View all supervisor feedback about student groups
 */

let allFeedback = [];
let allSupervisors = [];
let allGroups = [];
let currentAdmin = null;

// Load Admin Feedback Page
async function loadAdminFeedbackPage() {
  console.log('🚀 Loading Admin Feedback Page...');
  
  try {
    // Check authentication
    const user = auth.currentUser;
    if (!user) {
      console.log('No user logged in, redirecting to login...');
      window.location.href = 'login.html';
      return;
    }
    
    // Verify admin role
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      console.error('User is not an admin');
      alert('Access denied. Admin privileges required.');
      window.location.href = 'login.html';
      return;
    }
    
    currentAdmin = userDoc.data();
    console.log('✅ Admin verified:', currentAdmin.displayName);
    
    // Load all data in parallel
    await Promise.all([
      loadSupervisors(),
      loadGroups(),
      loadFeedback()
    ]);
    
    console.log('✅ Admin Feedback Page loaded successfully');
    if (typeof NotificationService !== 'undefined') NotificationService.loadCount();

  } catch (error) {
    console.error('❌ Error loading admin feedback page:', error);
    showError('Failed to load feedback data. Please try again.');
  }
}

// Load all supervisors
async function loadSupervisors() {
  try {
    console.log('👔 Loading supervisors...');
    
    const snapshot = await db.collection('supervisors').get();
    allSupervisors = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ Loaded ${allSupervisors.length} supervisors`);
    
    // Populate supervisor filter
    const supervisorFilter = document.getElementById('supervisorFilter');
    if (supervisorFilter) {
      while (supervisorFilter.options.length > 1) {
        supervisorFilter.remove(1);
      }
      
      allSupervisors.forEach(sup => {
        const option = document.createElement('option');
        option.value = sup.id;
        option.textContent = sup.fullName || sup.displayName || 'Unknown';
        supervisorFilter.appendChild(option);
      });
    }
    
  } catch (error) {
    console.error('❌ Error loading supervisors:', error);
  }
}

// Load all groups
async function loadGroups() {
  try {
    console.log('👥 Loading groups...');
    
    const snapshot = await db.collection('groups').get();
    allGroups = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ Loaded ${allGroups.length} groups`);
    
  } catch (error) {
    console.error('❌ Error loading groups:', error);
  }
}

// Load all feedback
async function loadFeedback() {
  try {
    console.log('💬 Loading feedback...');
    
    const container = document.getElementById('feedbackContainer');
    if (container) {
      container.innerHTML = `
        <div class="loading-spinner">
          <i class="fas fa-spinner"></i>
          <p>Loading feedback...</p>
        </div>
      `;
    }
    
    const snapshot = await db.collection('feedback').get();
    const reportsSnap = await db.collection('reports').get();

    const fromFeedback = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Include report reviews saved before feedback collection sync
    const fromReports = reportsSnap.docs
      .map((doc) => ({ id: 'report-' + doc.id, ...doc.data(), source: 'report' }))
      .filter((r) => r.feedback || r.remarks)
      .map((r) => ({
        id: r.id,
        type: 'report',
        decision: r.status,
        message: r.feedback || r.remarks,
        feedback: r.feedback || r.remarks,
        content: r.feedback || r.remarks,
        grade: r.grade,
        groupId: r.groupId,
        groupName: r.groupName,
        supervisorId: r.supervisorId,
        supervisorName: r.supervisorName || r.reviewedByName,
        reportId: r.id.replace('report-', ''),
        reportTitle: r.title,
        createdAt: r.reviewedDate || r.reviewedAt || r.submittedDate,
        timestamp: r.reviewedDate || r.reviewedAt
      }));

    const seenReportIds = new Set(fromFeedback.filter((f) => f.reportId).map((f) => f.reportId));
    const mergedReports = fromReports.filter((r) => !seenReportIds.has(r.reportId));

    allFeedback = [...fromFeedback, ...mergedReports]
      .sort((a, b) => new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0));
    
    console.log(`✅ Loaded ${allFeedback.length} feedback entries`);
    
    // Update stats
    updateFeedbackStats();
    
    // Render feedback
    renderFeedback();
    
  } catch (error) {
    console.error('❌ Error loading feedback:', error);
    
    const container = document.getElementById('feedbackContainer');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-circle"></i>
          <h3>Error Loading Feedback</h3>
          <p>${error.message}</p>
          <button onclick="loadFeedback()" class="btn btn-primary" style="margin-top: 15px;">
            <i class="fas fa-sync"></i> Retry
          </button>
        </div>
      `;
    }
  }
}

// Update feedback statistics
function updateFeedbackStats() {
  const total = allFeedback.length;
  
  // Count unique supervisors who gave feedback
  const uniqueSupervisors = [...new Set(allFeedback.map(f => f.supervisorId).filter(Boolean))];
  
  // Count unique groups who received feedback
  const uniqueGroups = [...new Set(allFeedback.map(f => f.groupId).filter(Boolean))];
  
  // Calculate average rating
  const ratings = allFeedback.filter(f => f.rating).map(f => f.rating);
  const avgRating = ratings.length > 0 ? 
    (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 
    '-';
  
  document.getElementById('totalCount').textContent = total;
  document.getElementById('supervisorCount').textContent = uniqueSupervisors.length;
  document.getElementById('groupCount').textContent = uniqueGroups.length;
  document.getElementById('avgRating').textContent = avgRating;
}

// Render feedback list
function renderFeedback() {
  const container = document.getElementById('feedbackContainer');
  
  if (allFeedback.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-comments"></i>
        <h3>No Feedback Found</h3>
        <p>No supervisor feedback has been submitted yet.</p>
      </div>
    `;
    return;
  }
  
  let html = '<div class="feedback-list">';
  
  allFeedback.forEach(feedback => {
    // Find supervisor info
    const supervisor = allSupervisors.find(s => s.id === (feedback.supervisorId || feedback.fromUserId)) || {};
    const supervisorName = supervisor.fullName || supervisor.displayName || 'Unknown Supervisor';
    const supervisorInitials = supervisorName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    
    // Find group info
    const group = allGroups.find(g => g.id === feedback.groupId) || {};
    const groupName = group.groupId || group.name || feedback.groupId || 'Unknown Group';
    
    // Format date
    const feedbackDate = feedback.createdAt ? 
      new Date(feedback.createdAt.toDate ? feedback.createdAt.toDate() : feedback.createdAt).toLocaleString() : 
      'Unknown';
    
    // Feedback type
    const type = feedback.type || 'general';
    const typeClass = `type-${type}`;
    const typeText = type.charAt(0).toUpperCase() + type.slice(1);
    
    // Rating stars
    const rating = feedback.rating || 0;
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      starsHtml += `<i class="fas fa-star ${i <= rating ? '' : 'empty'}"></i>`;
    }
    
    // Truncate content
    const content = feedback.content || feedback.message || feedback.feedback || 'No content';
    const truncatedContent = content.length > 200 ? content.substring(0, 200) + '...' : content;
    
    html += `
      <div class="feedback-card" data-feedback-id="${feedback.id}">
        <div class="feedback-header">
          <div class="feedback-meta">
            <div class="supervisor-info">
              <div class="supervisor-avatar">${supervisorInitials}</div>
              <div class="supervisor-details">
                <h4>${supervisorName}</h4>
                <p>${supervisor.department || 'No Department'}</p>
              </div>
            </div>
            <span class="feedback-type-badge ${typeClass}">${typeText}</span>
          </div>
          <div class="feedback-date">
            <i class="far fa-clock"></i> ${feedbackDate}
          </div>
        </div>
        
        <div class="feedback-content">
          ${truncatedContent}
        </div>
        
        <div class="feedback-footer">
          <div class="group-info">
            <i class="fas fa-users"></i>
            <span>Group: ${groupName}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 15px;">
            <div class="rating">${starsHtml}</div>
            <div class="feedback-actions">
              <button class="action-btn btn-view" onclick="viewFeedback('${feedback.id}')">
                <i class="fas fa-eye"></i> View Full
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// Filter feedback
function filterFeedback() {
  const searchTerm = document.getElementById('feedbackSearchInput').value.toLowerCase();
  const supervisorFilter = document.getElementById('supervisorFilter').value;
  const typeFilter = document.getElementById('typeFilter').value;
  
  const cards = document.querySelectorAll('.feedback-card');
  
  cards.forEach(card => {
    const feedbackId = card.getAttribute('data-feedback-id');
    const feedback = allFeedback.find(f => f.id === feedbackId);
    
    if (!feedback) return;
    
    // Search filter
    const supervisor = allSupervisors.find(s => s.id === (feedback.supervisorId || feedback.fromUserId)) || {};
    const group = allGroups.find(g => g.id === feedback.groupId) || {};
    const content = feedback.content || feedback.message || feedback.feedback || '';
    
    const searchText = `
      ${supervisor.fullName || ''} 
      ${supervisor.displayName || ''} 
      ${group.groupId || ''} 
      ${group.name || ''} 
      ${content}
    `.toLowerCase();
    
    const matchesSearch = searchText.includes(searchTerm);
    
    // Supervisor filter
    const matchesSupervisor = supervisorFilter === 'all' || feedback.supervisorId === supervisorFilter;
    
    // Type filter
    const matchesType = typeFilter === 'all' || (feedback.type || 'general') === typeFilter;
    
    card.style.display = matchesSearch && matchesSupervisor && matchesType ? '' : 'none';
  });
}

// View feedback details
function viewFeedback(feedbackId) {
  const feedback = allFeedback.find(f => f.id === feedbackId);
  if (!feedback) return;
  
  const supervisor = allSupervisors.find(s => s.id === feedback.supervisorId) || {};
  const group = allGroups.find(g => g.id === feedback.groupId) || {};
  
  // Rating stars
  const rating = feedback.rating || 0;
  let starsHtml = '';
  for (let i = 1; i <= 5; i++) {
    starsHtml += `<i class="fas fa-star ${i <= rating ? '' : 'empty'}"></i>`;
  }
  
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
    <div class="feedback-detail">
      <h4>Supervisor Information</h4>
      <p>
        <strong>Name:</strong> ${supervisor.fullName || supervisor.displayName || 'Unknown'}<br>
        <strong>Email:</strong> ${supervisor.email || 'N/A'}<br>
        <strong>Department:</strong> ${supervisor.department || 'N/A'}
      </p>
      
      <h4>Group Information</h4>
      <p>
        <strong>Group:</strong> ${group.groupId || group.name || feedback.groupId || 'Unknown'}<br>
        <strong>Members:</strong> ${group.members ? group.members.map(m => m.name || m.email).join(', ') : 'N/A'}
      </p>
      
      <h4>Feedback Details</h4>
      <p>
        <strong>Type:</strong> <span class="feedback-type-badge type-${feedback.type || 'general'}">${(feedback.type || 'general').charAt(0).toUpperCase() + (feedback.type || 'general').slice(1)}</span><br>
        <strong>Rating:</strong> <span class="rating">${starsHtml}</span><br>
        <strong>Date:</strong> ${feedback.createdAt ? new Date(feedback.createdAt.toDate ? feedback.createdAt.toDate() : feedback.createdAt).toLocaleString() : 'Unknown'}
      </p>
      
      <h4>Content</h4>
      <p style="background: #f9fafb; padding: 15px; border-radius: 8px; line-height: 1.8;">
        ${feedback.content || feedback.message || feedback.feedback || 'No content provided.'}
      </p>
      
      ${feedback.attachmentUrl ? `
        <h4>Attachment</h4>
        <p>
          <a href="${feedback.attachmentUrl}" target="_blank" class="btn btn-secondary">
            <i class="fas fa-paperclip"></i> View Attachment
          </a>
        </p>
      ` : ''}
    </div>
  `;
  
  document.getElementById('feedbackModal').classList.add('active');
}

// Close feedback modal
function closeFeedbackModal() {
  document.getElementById('feedbackModal').classList.remove('active');
}

// Export feedback to CSV
function exportFeedback() {
  if (allFeedback.length === 0) {
    alert('No feedback to export');
    return;
  }
  
  let csv = 'Feedback ID,Supervisor,Group,Type,Rating,Date,Content\n';
  
  allFeedback.forEach(fb => {
    const supervisor = allSupervisors.find(s => s.id === fb.supervisorId) || {};
    const group = allGroups.find(g => g.id === fb.groupId) || {};
    const content = (fb.content || fb.message || fb.feedback || '').replace(/"/g, '""');
    
    csv += `${fb.id},"${supervisor.fullName || supervisor.displayName || 'Unknown'}","${group.groupId || group.name || 'Unknown'}","${fb.type || 'general'}",${fb.rating || 0},"${fb.createdAt ? new Date(fb.createdAt.toDate ? fb.createdAt.toDate() : fb.createdAt).toLocaleString() : 'N/A'}","${content}"\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `feedback_export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
  
  console.log('✅ Feedback exported');
}

// Show error message
function showError(message) {
  const container = document.getElementById('feedbackContainer');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i>
        <h3>Error</h3>
        <p>${message}</p>
        <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 15px;">
          <i class="fas fa-sync"></i> Reload Page
        </button>
      </div>
    `;
  }
}

// Logout function
function logout() {
  auth.signOut().then(() => {
    localStorage.clear();
    window.location.href = 'login.html';
  }).catch(error => {
    console.error('Logout error:', error);
  });
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('feedbackModal');
  if (event.target === modal) {
    closeFeedbackModal();
  }
}

console.log('✅ Admin Feedback JS loaded');
