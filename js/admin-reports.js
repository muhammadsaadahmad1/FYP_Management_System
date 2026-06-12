/**
 * Admin Reports Page - Full Firebase Integration
 * View and manage all student project reports
 */

let allReports = [];
let allGroups = [];
let allSupervisors = [];
let currentAdmin = null;

// Load Admin Reports Page
async function loadAdminReportsPage() {
  console.log('🚀 Loading Admin Reports Page...');
  
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
      loadGroups(),
      loadSupervisors(),
      loadReports()
    ]);
    
    console.log('✅ Admin Reports Page loaded successfully');
    if (typeof NotificationService !== 'undefined') NotificationService.loadCount();

  } catch (error) {
    console.error('❌ Error loading admin reports page:', error);
    showError('Failed to load reports data. Please try again.');
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
    
  } catch (error) {
    console.error('❌ Error loading supervisors:', error);
  }
}

// Load all reports
async function loadReports() {
  try {
    console.log('📄 Loading reports...');
    
    const container = document.getElementById('reportsTableContainer');
    if (container) {
      container.innerHTML = `
        <div class="loading-spinner">
          <i class="fas fa-spinner"></i>
          <p>Loading reports...</p>
        </div>
      `;
    }
    
    // No orderBy to avoid composite index requirement; sort client-side
    const snapshot = await db.collection('reports').get();

    allReports = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => new Date(b.submittedDate || b.submittedAt || 0) - new Date(a.submittedDate || a.submittedAt || 0));
    
    console.log(`✅ Loaded ${allReports.length} reports`);
    
    // Update stats
    updateReportStats();
    
    // Render reports table
    renderReportsTable();
    
  } catch (error) {
    console.error('❌ Error loading reports:', error);
    
    const container = document.getElementById('reportsTableContainer');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-circle"></i>
          <h3>Error Loading Reports</h3>
          <p>${error.message}</p>
          <button onclick="loadReports()" class="btn btn-primary" style="margin-top: 15px;">
            <i class="fas fa-sync"></i> Retry
          </button>
        </div>
      `;
    }
  }
}

// Update report statistics
function updateReportStats() {
  const total = allReports.length;
  const pending = allReports.filter(r => r.status === 'submitted' || !r.status || r.status === 'pending').length;
  const reviewed = allReports.filter(r => r.status === 'reviewed').length;
  
  // Count unique groups
  const uniqueGroups = [...new Set(allReports.map(r => r.groupId).filter(Boolean))];
  
  document.getElementById('totalCount').textContent = total;
  document.getElementById('pendingCount').textContent = pending;
  document.getElementById('reviewedCount').textContent = reviewed;
  document.getElementById('groupCount').textContent = uniqueGroups.length;
}

// Render reports table
function renderReportsTable() {
  const container = document.getElementById('reportsTableContainer');
  
  if (allReports.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-file-pdf"></i>
        <h3>No Reports Found</h3>
        <p>No student reports have been submitted yet.</p>
      </div>
    `;
    return;
  }
  
  let html = `
    <table class="reports-table">
      <thead>
        <tr>
          <th>Group</th>
          <th>Report Title</th>
          <th>Type</th>
          <th>Supervisor</th>
          <th>Status</th>
          <th>Progress</th>
          <th>Submitted</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  allReports.forEach(report => {
    // Find group info
    const group = allGroups.find(g => g.id === report.groupId) || {};
    const groupName = group.groupId || group.name || report.groupId || 'Unknown Group';
    
    // Find supervisor info
    const supervisor = allSupervisors.find(s => s.id === (report.supervisorId || group.supervisorId)) || {};
    const supervisorName = supervisor.fullName || supervisor.displayName || 'Not Assigned';
    
    // Report type
    const type = report.type || 'other';
    const typeClass = `type-${type}`;
    const typeText = type.charAt(0).toUpperCase() + type.slice(1);
    
    // Status
    const status = report.status || 'submitted';
    const statusClass = `status-${status}`;
    const statusText = status === 'submitted' ? 'Submitted' : 
                       status.charAt(0).toUpperCase() + status.slice(1);
    
    // Progress
    const progress = report.progress || report.completionPercentage || 0;
    
    // Format date
    const submittedDate = report.submittedAt ? 
      new Date(report.submittedAt.toDate ? report.submittedAt.toDate() : report.submittedAt).toLocaleDateString() : 
      'Unknown';
    
    html += `
      <tr data-report-id="${report.id}">
        <td>${groupName}</td>
        <td>${report.title || 'Untitled Report'}</td>
        <td><span class="report-type-badge ${typeClass}">${typeText}</span></td>
        <td>${supervisorName}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="progress-bar" style="width: 60px;">
              <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <span style="font-size: 12px; color: #6b7280;">${progress}%</span>
          </div>
        </td>
        <td>${submittedDate}</td>
        <td>
          <button class="action-btn btn-view" onclick="viewReport('${report.id}')">
            <i class="fas fa-eye"></i>
          </button>
          ${report.fileUrl || report.documentUrl ? `
            <button class="action-btn btn-download" onclick="downloadReport('${report.id}')">
              <i class="fas fa-download"></i>
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

// Filter reports
function filterReports() {
  const searchTerm = document.getElementById('reportSearchInput').value.toLowerCase();
  const typeFilter = document.getElementById('typeFilter').value;
  const statusFilter = document.getElementById('statusFilter').value;
  
  const rows = document.querySelectorAll('.reports-table tbody tr');
  
  rows.forEach(row => {
    const reportId = row.getAttribute('data-report-id');
    const report = allReports.find(r => r.id === reportId);
    
    if (!report) return;
    
    // Search filter
    const group = allGroups.find(g => g.id === report.groupId) || {};
    const searchText = `
      ${report.title || ''} 
      ${report.description || ''} 
      ${group.groupId || ''} 
      ${group.name || ''}
    `.toLowerCase();
    
    const matchesSearch = searchText.includes(searchTerm);
    
    // Type filter
    const matchesType = typeFilter === 'all' || (report.type || 'other') === typeFilter;
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || (report.status || 'submitted') === statusFilter;
    
    row.style.display = matchesSearch && matchesType && matchesStatus ? '' : 'none';
  });
}

// View report details
function viewReport(reportId) {
  const report = allReports.find(r => r.id === reportId);
  if (!report) return;
  
  const group = allGroups.find(g => g.id === report.groupId) || {};
  const supervisor = allSupervisors.find(s => s.id === (report.supervisorId || group.supervisorId)) || {};
  
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
    <div class="report-detail">
      <h4>Report Information</h4>
      <p>
        <strong>Title:</strong> ${report.title || 'Untitled'}<br>
        <strong>Type:</strong> <span class="report-type-badge type-${report.type || 'other'}">${(report.type || 'Other').charAt(0).toUpperCase() + (report.type || 'other').slice(1)}</span><br>
        <strong>Status:</strong> <span class="status-badge status-${report.status || 'submitted'}">${(report.status || 'Submitted').charAt(0).toUpperCase() + (report.status || 'submitted').slice(1)}</span>
      </p>
      
      <h4>Group Information</h4>
      <p>
        <strong>Group:</strong> ${group.groupId || group.name || report.groupId || 'Unknown'}<br>
        <strong>Supervisor:</strong> ${supervisor.fullName || supervisor.displayName || 'Not Assigned'}<br>
        <strong>Members:</strong> ${group.members ? group.members.map(m => m.name || m.email).join(', ') : 'N/A'}
      </p>
      
      <h4>Progress</h4>
      <div style="margin-bottom: 15px;">
        <div class="progress-bar" style="margin-bottom: 8px;">
          <div class="progress-fill" style="width: ${report.progress || report.completionPercentage || 0}%"></div>
        </div>
        <p style="font-size: 14px; color: #6b7280;">
          ${report.progress || report.completionPercentage || 0}% Complete
        </p>
      </div>
      
      <h4>Summary / Content</h4>
      <p style="background: #f9fafb; padding: 15px; border-radius: 8px; line-height: 1.8; white-space: pre-wrap;">
        ${report.summary || report.description || report.content || 'No summary provided.'}
      </p>
      
      <h4>Submission Details</h4>
      <p>
        <strong>Submitted:</strong> ${report.submittedDate || report.submittedAt ? new Date(report.submittedDate || report.submittedAt).toLocaleString() : 'Unknown'}<br>
        ${report.reviewedDate || report.reviewedAt ? `<strong>Reviewed:</strong> ${new Date(report.reviewedDate || report.reviewedAt).toLocaleString()}<br>` : ''}
        ${report.reviewedByName || report.reviewedBy ? `<strong>Reviewed By:</strong> ${report.reviewedByName || report.reviewedBy}<br>` : ''}
        ${report.grade ? `<strong>Grade:</strong> ${report.grade}<br>` : ''}
      </p>
      
      ${report.downloadURL || report.fileLink || report.fileUrl || report.documentUrl ? `
        <h4>Document</h4>
        <p>
          <a href="${report.downloadURL || report.fileLink || report.fileUrl || report.documentUrl}" target="_blank" class="btn btn-primary" style="margin-right: 10px;">
            <i class="fas fa-external-link-alt"></i> Open File
          </a>
        </p>
      ` : ''}
      
      ${report.feedback || report.remarks ? `
        <h4>Supervisor Feedback</h4>
        <p style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; white-space: pre-wrap;">
          ${report.feedback || report.remarks}
        </p>
      ` : '<p style="color:#6b7280;">No supervisor feedback yet.</p>'}
    </div>
  `;
  
  document.getElementById('reportModal').classList.add('active');
}

// Close report modal
function closeReportModal() {
  document.getElementById('reportModal').classList.remove('active');
}

// Download report
function downloadReport(reportId) {
  const report = allReports.find(r => r.id === reportId);
  if (!report || (!report.fileUrl && !report.documentUrl)) {
    alert('No document available for download');
    return;
  }
  
  const url = report.fileUrl || report.documentUrl;
  const a = document.createElement('a');
  a.href = url;
  a.download = report.title || 'report';
  a.target = '_blank';
  a.click();
}

// Export reports to CSV
function exportReports() {
  if (allReports.length === 0) {
    alert('No reports to export');
    return;
  }
  
  let csv = 'Report ID,Group,Title,Type,Supervisor,Status,Progress,Submitted Date\n';
  
  allReports.forEach(report => {
    const group = allGroups.find(g => g.id === report.groupId) || {};
    const supervisor = allSupervisors.find(s => s.id === (report.supervisorId || group.supervisorId)) || {};
    
    csv += `${report.id},"${group.groupId || group.name || 'Unknown'}","${report.title || 'Untitled'}","${report.type || 'other'}","${supervisor.fullName || supervisor.displayName || 'N/A'}","${report.status || 'submitted'}",${report.progress || report.completionPercentage || 0},"${report.submittedAt ? new Date(report.submittedAt.toDate ? report.submittedAt.toDate() : report.submittedAt).toLocaleString() : 'N/A'}"\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reports_export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
  
  console.log('✅ Reports exported');
}

// Show error message
function showError(message) {
  const container = document.getElementById('reportsTableContainer');
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
  const modal = document.getElementById('reportModal');
  if (event.target === modal) {
    closeReportModal();
  }
}

console.log('✅ Admin Reports JS loaded');
