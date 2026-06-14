// Admin Dashboard JavaScript with Firebase Integration
// FYP Management System - Admin Module

// Global variables
let currentAdmin = null;
let supervisorsList = [];
let proposalsList = [];
let groupsList = [];
let reportsList = [];
let feedbackList = [];

// Main dashboard load function
async function loadAdminDashboard() {
  console.log('🚀 Loading Admin Dashboard...');
  
  try {
    const uid = localStorage.getItem('uid');
    if (!uid) {
      console.error('No admin UID found');
      window.location.href = 'login.html';
      return;
    }
    
    // Load admin profile
    await loadAdminProfile(uid);
    
    // Load dashboard statistics
    await loadDashboardStats();
    
    // Load all data sections
    await Promise.allSettled([
      loadAllProposals(),
      loadAllSupervisors(),
      loadAllFeedback(),
      loadAllReports()
    ]);
    
    console.log('✅ Admin Dashboard loaded successfully');
    if (typeof NotificationService !== 'undefined') NotificationService.loadCount();

  } catch (error) {
    console.error('❌ Error loading admin dashboard:', error);
    showNotification('Error loading dashboard data', 'error');
  }
}

// Load admin profile
async function loadAdminProfile(uid) {
  try {
    const adminDoc = await db.collection('users').doc(uid).get();
    
    if (adminDoc.exists) {
      currentAdmin = adminDoc.data();
      console.log('👤 Admin loaded:', currentAdmin.displayName || currentAdmin.fullName);
      
      // Update UI
      const adminNameEl = document.getElementById('adminName');
      if (adminNameEl) {
        adminNameEl.textContent = currentAdmin.displayName || currentAdmin.fullName || 'Admin';
      }
    } else {
      console.error('Admin document not found');
      // Use localStorage fallback
      const displayName = localStorage.getItem('displayName');
      const adminNameEl = document.getElementById('adminName');
      if (adminNameEl && displayName) {
        adminNameEl.textContent = displayName;
      }
    }
  } catch (error) {
    console.error('Error loading admin profile:', error);
  }
}

// Load dashboard statistics
async function loadDashboardStats() {
  try {
    console.log('📊 Loading dashboard statistics...');
    
    // Count total students (users with role='student')
    const studentsSnapshot = await db.collection('users')
      .where('role', '==', 'student')
      .get();
    updateStatElement('totalStudents', studentsSnapshot.size);
    
    // Count total supervisors (users with role='supervisor')
    const supervisorsSnapshot = await db.collection('users')
      .where('role', '==', 'supervisor')
      .get();
    updateStatElement('totalSupervisors', supervisorsSnapshot.size);
    
    // Count pending proposals
    const proposalsSnapshot = await db.collection('proposals')
      .where('status', '==', 'pending')
      .get();
    updateStatElement('pendingProposals', proposalsSnapshot.size);
    
    // Count pending approvals (supervisors awaiting approval)
    const pendingApprovalsSnapshot = await db.collection('users')
      .where('role', '==', 'supervisor')
      .where('isActive', '==', false)
      .get();
    updateStatElement('pendingApprovals', pendingApprovalsSnapshot.size);
    
    console.log('✅ Dashboard stats loaded');
    
  } catch (error) {
    console.error('❌ Error loading dashboard stats:', error);
    // Silently fail - don't block dashboard loading
  }
}

// Helper to update stat element
function updateStatElement(elementId, value) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = value;
  }
}

// Load all proposals
async function loadAllProposals() {
  try {
    console.log('📋 Loading all proposals...');
    
    const proposalsSnapshot = await db.collection('proposals')
      .orderBy('submittedDate', 'desc')
      .get();
    
    proposalsList = proposalsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ Loaded ${proposalsList.length} proposals`);
    renderProposalsTable();
    
  } catch (error) {
    console.error('❌ Error loading proposals:', error);
    // Show error in table
    const tableBody = document.getElementById('proposalTable');
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #dc2626; padding: 20px;">Error loading proposals. Check console.</td></tr>';
    }
  }
}

// Render proposals table
async function renderProposalsTable() {
  const tableBody = document.getElementById('proposalTable');
  if (!tableBody) return;
  
  if (proposalsList.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">No proposals submitted yet</td></tr>';
    return;
  }
  
  // Load supervisors for dropdown
  await loadSupervisorsList();
  
  let html = '';
  for (const proposal of proposalsList) {
    // Get group info
    let groupName = proposal.groupName || proposal.groupId || 'Unknown Group';
    
    // Get supervisor name if assigned
    let supervisorName = proposal.supervisorName || 'Not Assigned';
    if (proposal.supervisorId && !proposal.supervisorName) {
      try {
        const supervisorDoc = await db.collection('users').doc(proposal.supervisorId).get();
        if (supervisorDoc.exists) {
          supervisorName = supervisorDoc.data().displayName || supervisorDoc.data().fullName || 'Unknown';
        }
      } catch (e) {
        console.warn('Could not load supervisor name:', e);
      }
    }
    
    const statusClass = proposal.status === 'approved' ? 'assigned' : 
                       proposal.status === 'rejected' ? 'rejected' : 'pending';
    
    html += `
      <tr>
        <td>${groupName}</td>
        <td>${proposal.title || 'Untitled'}</td>
        <td>
          <select id="supervisor-select-${proposal.id}" onchange="handleSupervisorChange('${proposal.id}')">
            <option value="">${supervisorName}</option>
            ${supervisorsList.map(s => `<option value="${s.id}">${s.displayName || s.fullName}</option>`).join('')}
          </select>
        </td>
        <td>
          ${proposal.status === 'pending' ? 
            `<button class="assign" onclick="assignProposal('${proposal.id}')">Assign</button>` : 
            `<span class="status ${statusClass}">${proposal.status}</span>`
          }
        </td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="viewProposal('${proposal.id}')">View</button>
        </td>
      </tr>
    `;
  }
  
  tableBody.innerHTML = html;
}

// Load supervisors list for dropdown
async function loadSupervisorsList() {
  if (supervisorsList.length > 0) return; // Already loaded
  
  try {
    const snapshot = await db.collection('users')
      .where('role', '==', 'supervisor')
      .where('isActive', '==', true)
      .get();
    
    supervisorsList = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ Loaded ${supervisorsList.length} supervisors`);
  } catch (error) {
    console.error('Error loading supervisors list:', error);
  }
}

// Load all supervisors
async function loadAllSupervisors() {
  try {
    console.log('👔 Loading all supervisors...');
    
    const container = document.getElementById('supervisorList');
    if (!container) return;
    
    const snapshot = await db.collection('users')
      .where('role', '==', 'supervisor')
      .get();
    
    if (snapshot.empty) {
      container.innerHTML = '<p style="text-align: center; padding: 20px;">No supervisors registered yet</p>';
      return;
    }
    
    let html = '<div class="supervisors-grid">';
    
    for (const doc of snapshot.docs) {
      const supervisor = doc.data();
      
      // Count assigned groups for this supervisor
      const groupsSnapshot = await db.collection('groups')
        .where('supervisorId', '==', doc.id)
        .get();
      
      const statusClass = supervisor.isActive ? 'assigned' : 'pending';
      const statusText = supervisor.isActive ? 'Active' : 'Pending Approval';
      
      html += `
        <div class="card supervisor-card">
          <h3>${supervisor.displayName || supervisor.fullName || 'Unknown'}</h3>
          <p><strong>Department:</strong> ${supervisor.department || 'N/A'}</p>
          <p><strong>Designation:</strong> ${supervisor.designation || 'N/A'}</p>
          <p><strong>Email:</strong> ${supervisor.email}</p>
          <p><strong>Assigned Groups:</strong> ${groupsSnapshot.size}</p>
          <p><strong>Status:</strong> <span class="status ${statusClass}">${statusText}</span></p>
          ${!supervisor.isActive ? 
            `<button class="btn btn-primary" onclick="approveSupervisor('${doc.id}')">Approve</button>` : 
            ''}
        </div>
      `;
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    console.log(`✅ Loaded ${snapshot.size} supervisors`);
    
  } catch (error) {
    console.error('❌ Error loading supervisors:', error);
    const container = document.getElementById('supervisorList');
    if (container) {
      container.innerHTML = '<p style="text-align: center; color: #dc2626; padding: 20px;">Error loading supervisors</p>';
    }
  }
}

// Load all feedback
async function loadAllFeedback() {
  try {
    console.log('💬 Loading all feedback...');
    
    const container = document.getElementById('feedbackList');
    if (!container) return;
    
    const snapshot = await db.collection('feedback').get();

    const entries = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0))
      .slice(0, 50);

    if (!entries.length) {
      container.innerHTML = '<p style="text-align: center; padding: 20px;">No feedback submitted yet</p>';
      return;
    }

    let html = '';

    for (const feedback of entries) {
      let supervisorName = feedback.supervisorName || 'Unknown Supervisor';
      const supId = feedback.supervisorId || feedback.fromUserId;
      try {
        if (supId && supervisorName === 'Unknown Supervisor') {
          const supervisorDoc = await db.collection('users').doc(supId).get();
          if (supervisorDoc.exists) {
            supervisorName = supervisorDoc.data().displayName || supervisorDoc.data().fullName;
          }
        }
      } catch (e) {
        console.warn('Could not load supervisor name for feedback:', e);
      }

      const groupName = feedback.groupName || feedback.groupId || 'Unknown Group';
      const dateStr = feedback.createdAt || feedback.timestamp;
      const body = feedback.message || feedback.feedback || feedback.content || 'No message';

      html += `
        <div class="card feedback-card">
          <div class="feedback-header">
            <h4>${supervisorName}</h4>
            <span class="feedback-date">${dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A'}</span>
          </div>
          <p><strong>Group:</strong> ${groupName}</p>
          <p><strong>Type:</strong> ${feedback.type || 'general'}${feedback.decision ? ' — ' + feedback.decision : ''}</p>
          <p>${body}</p>
        </div>
      `;
    }

    container.innerHTML = html;
    console.log(`✅ Loaded ${entries.length} feedback entries`);
    
  } catch (error) {
    console.error('❌ Error loading feedback:', error);
    const container = document.getElementById('feedbackList');
    if (container) {
      container.innerHTML = '<p style="text-align: center; color: #dc2626; padding: 20px;">Error loading feedback</p>';
    }
  }
}

// Load all reports
async function loadAllReports() {
  try {
    console.log('📄 Loading all reports...');
    
    const container = document.getElementById('reportList');
    if (!container) return;
    
    const snapshot = await db.collection('reports').get();

    const reports = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => new Date(b.submittedDate || b.submittedAt || 0) - new Date(a.submittedDate || a.submittedAt || 0))
      .slice(0, 50);

    if (!reports.length) {
      container.innerHTML = '<p style="text-align: center; padding: 20px;">No reports submitted yet</p>';
      return;
    }

    if (typeof ReportFileStore !== 'undefined') {
      ReportFileStore.registerReportLookup(reports);
    }

    let html = '';

    for (const report of reports) {
      const hasFile = typeof ReportFileStore !== 'undefined' && ReportFileStore.hasStoredFile(report);
      html += `
        <div class="card report-card">
          <h4>${report.title || 'Untitled Report'}</h4>
          <p><strong>Group:</strong> ${report.groupName || report.groupId || 'Unknown'}</p>
          <p><strong>Type:</strong> ${report.type || 'N/A'}</p>
          <p><strong>Submitted:</strong> ${report.submittedDate ? new Date(report.submittedDate).toLocaleDateString() : 'N/A'}</p>
          <p><strong>Status:</strong> <span class="status ${report.status || 'pending'}">${report.status || 'Pending'}</span></p>
          ${report.feedback || report.remarks ? `<p><strong>Supervisor Feedback:</strong> ${(report.feedback || report.remarks).substring(0, 120)}</p>` : ''}
          ${report.grade ? `<p><strong>Grade:</strong> ${report.grade}</p>` : ''}
          ${hasFile ? `
            <button type="button" class="btn btn-sm btn-primary" style="margin-right:8px;"
              onclick="ReportFileStore.openReportFile(window.__reportFileLookup && window.__reportFileLookup['${report.id}'])">
              Open PDF
            </button>
            <button type="button" class="btn btn-sm btn-secondary"
              onclick="ReportFileStore.downloadReportFile(window.__reportFileLookup && window.__reportFileLookup['${report.id}'])">
              Download
            </button>` : ''}
        </div>
      `;
    }
    
    container.innerHTML = html;
    console.log(`✅ Loaded ${snapshot.size} reports`);
    
  } catch (error) {
    console.error('❌ Error loading reports:', error);
    const container = document.getElementById('reportList');
    if (container) {
      container.innerHTML = '<p style="text-align: center; color: #dc2626; padding: 20px;">Error loading reports</p>';
    }
  }
}

// Action: Assign proposal to supervisor
async function assignProposal(proposalId) {
  const select = document.getElementById(`supervisor-select-${proposalId}`);
  if (!select || !select.value) {
    showNotification('Please select a supervisor first', 'error');
    return;
  }
  
  try {
    showLoadingOverlay('Assigning proposal...');
    
    const supervisorId = select.value;
    
    // Get supervisor info
    const supervisorDoc = await db.collection('users').doc(supervisorId).get();
    const supervisorName = supervisorDoc.exists ? 
      (supervisorDoc.data().displayName || supervisorDoc.data().fullName) : 'Unknown';
    
    // Update proposal
    await db.collection('proposals').doc(proposalId).update({
      supervisorId: supervisorId,
      supervisorName: supervisorName,
      status: 'assigned',
      assignedAt: new Date().toISOString(),
      assignedBy: localStorage.getItem('uid')
    });
    
    // Also update the group with supervisor
    const proposalDoc = await db.collection('proposals').doc(proposalId).get();
    const proposal = proposalDoc.data();
    if (proposal.groupId) {
      await db.collection('groups').doc(proposal.groupId).update({
        supervisorId: supervisorId,
        supervisorName: supervisorName,
        updatedAt: new Date().toISOString()
      });
    }
    
    hideLoadingOverlay();
    showNotification('Proposal assigned successfully!', 'success');
    
    // Reload proposals
    await loadAllProposals();
    await loadDashboardStats();
    
  } catch (error) {
    hideLoadingOverlay();
    console.error('Error assigning proposal:', error);
    showNotification('Error assigning proposal. Please try again.', 'error');
  }
}

// Action: Approve supervisor
async function approveSupervisor(supervisorId) {
  try {
    showLoadingOverlay('Approving supervisor...');
    
    await db.collection('users').doc(supervisorId).update({
      isActive: true,
      approvedAt: new Date().toISOString(),
      approvedBy: localStorage.getItem('uid')
    });
    
    hideLoadingOverlay();
    showNotification('Supervisor approved successfully!', 'success');
    
    // Reload supervisors and stats
    await loadAllSupervisors();
    await loadDashboardStats();
    
  } catch (error) {
    hideLoadingOverlay();
    console.error('Error approving supervisor:', error);
    showNotification('Error approving supervisor. Please try again.', 'error');
  }
}

// Action: View proposal details
async function viewProposal(proposalId) {
  try {
    const proposalDoc = await db.collection('proposals').doc(proposalId).get();
    if (!proposalDoc.exists) {
      showNotification('Proposal not found', 'error');
      return;
    }
    
    const proposal = proposalDoc.data();
    
    // Create modal content
    const modalContent = `
      <h2>${proposal.title || 'Untitled Proposal'}</h2>
      <p><strong>Group:</strong> ${proposal.groupName || proposal.groupId || 'Unknown'}</p>
      <p><strong>Category:</strong> ${proposal.category || 'N/A'}</p>
      <p><strong>Status:</strong> ${proposal.status || 'pending'}</p>
      <p><strong>Submitted:</strong> ${proposal.submittedDate ? new Date(proposal.submittedDate).toLocaleString() : 'N/A'}</p>
      <hr>
      <h3>Description</h3>
      <p>${proposal.description || proposal.abstract || 'No description provided'}</p>
      <h3>Objectives</h3>
      <p>${proposal.objectives || 'N/A'}</p>
      <h3>Methodology</h3>
      <p>${proposal.methodology || 'N/A'}</p>
      ${proposal.downloadURL ? `<a href="${proposal.downloadURL}" target="_blank" class="btn btn-primary">View Attachment</a>` : ''}
    `;
    
    showModal(modalContent);
    
  } catch (error) {
    console.error('Error viewing proposal:', error);
    showNotification('Error loading proposal details', 'error');
  }
}

// Action: Handle approve pending button
function handleApprovePending() {
  // Redirect to supervisors page with pending filter
  window.location.href = 'admin-supervisors.html?filter=pending';
}

// Action: Handle view analytics button
function handleViewAnalytics() {
  const stats = {
    students: document.getElementById('totalStudents')?.textContent || '0',
    supervisors: document.getElementById('totalSupervisors')?.textContent || '0',
    proposals: document.getElementById('pendingProposals')?.textContent || '0',
    approvals: document.getElementById('pendingApprovals')?.textContent || '0'
  };
  
  const content = `
    <h2>System Analytics</h2>
    <div class="analytics-grid">
      <div class="stat-card">
        <h3>Total Students</h3>
        <p class="stat-number">${stats.students}</p>
      </div>
      <div class="stat-card">
        <h3>Total Supervisors</h3>
        <p class="stat-number">${stats.supervisors}</p>
      </div>
      <div class="stat-card">
        <h3>Pending Proposals</h3>
        <p class="stat-number">${stats.proposals}</p>
      </div>
      <div class="stat-card">
        <h3>Pending Approvals</h3>
        <p class="stat-number">${stats.approvals}</p>
      </div>
    </div>
    <p style="margin-top: 20px; color: #6b7280;">Detailed analytics coming soon...</p>
  `;
  
  showModal(content);
}

// UI Helper: Show section
function showSection(id, btn) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  
  const section = document.getElementById(id);
  if (section) {
    section.classList.add("active");
  }
  
  if (btn) {
    btn.classList.add("active");
  }
}

// UI Helper: Show modal
function showModal(content) {
  // Create modal if not exists
  let modal = document.getElementById('adminModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'adminModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="modal-close" onclick="closeModal()">&times;</span>
        <div class="modal-body"></div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); }
      .modal.active { display: flex; align-items: center; justify-content: center; }
      .modal-content { background: white; padding: 20px; border-radius: 10px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; position: relative; }
      .modal-close { position: absolute; right: 15px; top: 10px; font-size: 24px; cursor: pointer; }
      .analytics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
      .stat-card { background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; }
      .stat-number { font-size: 24px; font-weight: bold; color: #2563eb; }
    `;
    document.head.appendChild(style);
  }
  
  modal.querySelector('.modal-body').innerHTML = content;
  modal.classList.add('active');
}

// UI Helper: Close modal
function closeModal() {
  const modal = document.getElementById('adminModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// UI Helper: Show notification
function showNotification(message, type = 'info') {
  if (typeof window.showNotification === 'function' && window.showNotification !== showNotification) {
    window.showNotification(message, type);
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
    alert(message);
  }
}

// UI Helper: Show loading overlay
function showLoadingOverlay(message = 'Loading...') {
  if (typeof window.showLoadingOverlay === 'function') {
    window.showLoadingOverlay(message);
  } else {
    console.log(`Loading: ${message}`);
  }
}

// UI Helper: Hide loading overlay
function hideLoadingOverlay() {
  if (typeof window.hideLoadingOverlay === 'function') {
    window.hideLoadingOverlay();
  }
}

function logout() {
  firebaseLogout('login.html');
}

// Close modal on outside click
window.onclick = function(event) {
  const modal = document.getElementById('adminModal');
  if (event.target === modal) {
    closeModal();
  }
}

console.log('✅ Admin.js loaded successfully');