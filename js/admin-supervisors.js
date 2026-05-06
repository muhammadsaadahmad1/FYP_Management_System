/**
 * Admin Supervisors Page - Full Firebase Integration
 * Manage all supervisors and approve pending registrations
 */

let allSupervisors = [];
let allGroups = [];
let currentAdmin = null;

// Load Admin Supervisors Page
async function loadAdminSupervisorsPage() {
  console.log('🚀 Loading Admin Supervisors Page...');
  
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
    
    // Load all data
    await Promise.all([
      loadGroups(),
      loadSupervisors()
    ]);
    
    console.log('✅ Admin Supervisors Page loaded successfully');
    
  } catch (error) {
    console.error('❌ Error loading admin supervisors page:', error);
    showError('Failed to load supervisors data. Please try again.');
  }
}

// Load all groups for assignment counts
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
    
    const container = document.getElementById('supervisorsContainer');
    if (container) {
      container.innerHTML = `
        <div class="loading-spinner">
          <i class="fas fa-spinner"></i>
          <p>Loading supervisors...</p>
        </div>
      `;
    }
    
    // Get supervisors from Firestore
    const snapshot = await db.collection('supervisors')
      .orderBy('registeredAt', 'desc')
      .get();
    
    allSupervisors = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ Loaded ${allSupervisors.length} supervisors`);
    
    // Update stats
    updateSupervisorStats();
    
    // Populate department filter
    populateDepartmentFilter();
    
    // Render supervisors
    renderSupervisors();
    
    // Update pending badge
    updatePendingBadge();
    
  } catch (error) {
    console.error('❌ Error loading supervisors:', error);
    
    const container = document.getElementById('supervisorsContainer');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-circle"></i>
          <h3>Error Loading Supervisors</h3>
          <p>${error.message}</p>
          <button onclick="loadSupervisors()" class="btn btn-primary" style="margin-top: 15px;">
            <i class="fas fa-sync"></i> Retry
          </button>
        </div>
      `;
    }
  }
}

// Update supervisor statistics
function updateSupervisorStats() {
  const total = allSupervisors.length;
  const active = allSupervisors.filter(s => s.isActive && s.status !== 'pending_approval').length;
  const pending = allSupervisors.filter(s => s.status === 'pending_approval' || !s.isActive).length;
  
  // Get unique departments
  const departments = [...new Set(allSupervisors.map(s => s.department).filter(Boolean))];
  
  document.getElementById('totalCount').textContent = total;
  document.getElementById('activeCount').textContent = active;
  document.getElementById('pendingCount').textContent = pending;
  document.getElementById('deptCount').textContent = departments.length;
}

// Populate department filter dropdown
function populateDepartmentFilter() {
  const deptFilter = document.getElementById('deptFilter');
  if (!deptFilter) return;
  
  // Get unique departments
  const departments = [...new Set(allSupervisors.map(s => s.department).filter(Boolean))];
  
  // Clear existing options except first
  while (deptFilter.options.length > 1) {
    deptFilter.remove(1);
  }
  
  // Add department options
  departments.forEach(dept => {
    const option = document.createElement('option');
    option.value = dept;
    option.textContent = dept;
    deptFilter.appendChild(option);
  });
}

// Update pending badge
function updatePendingBadge() {
  const pendingCount = allSupervisors.filter(s => s.status === 'pending_approval' || !s.isActive).length;
  const badge = document.getElementById('pendingBadge');
  if (badge) {
    badge.textContent = pendingCount;
    badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }
}

// Render supervisors grid
function renderSupervisors() {
  const container = document.getElementById('supervisorsContainer');
  
  if (allSupervisors.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users"></i>
        <h3>No Supervisors Found</h3>
        <p>No supervisors have been registered yet.</p>
      </div>
    `;
    return;
  }
  
  let html = '<div class="supervisors-grid">';
  
  allSupervisors.forEach(supervisor => {
    // Count assigned groups
    const assignedGroups = allGroups.filter(g => g.supervisorId === supervisor.id);
    const groupCount = assignedGroups.length;
    
    // Determine status
    let status = supervisor.status || 'pending';
    if (supervisor.isActive && status !== 'pending_approval') {
      status = 'active';
    } else if (!supervisor.isActive) {
      status = 'inactive';
    }
    
    const statusClass = `status-${status}`;
    const statusText = status === 'pending_approval' ? 'Pending Approval' : 
                       status.charAt(0).toUpperCase() + status.slice(1);
    
    // Format name initials for avatar
    const name = supervisor.fullName || supervisor.displayName || 'Unknown';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    
    // Format date
    const registeredDate = supervisor.registeredAt ? 
      new Date(supervisor.registeredAt).toLocaleDateString() : 
      'Unknown';
    
    html += `
      <div class="supervisor-card" data-supervisor-id="${supervisor.id}">
        <div class="supervisor-header">
          <div class="supervisor-avatar">${initials}</div>
          <div class="supervisor-info">
            <h3>${name}</h3>
            <p>${supervisor.email || 'No email'}</p>
            <span class="status-badge ${statusClass}">${statusText}</span>
          </div>
        </div>
        
        <div class="supervisor-details">
          <div class="detail-row">
            <span class="detail-label">Department</span>
            <span class="detail-value">${supervisor.department || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Designation</span>
            <span class="detail-value">${supervisor.designation || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Employee ID</span>
            <span class="detail-value">${supervisor.employeeId || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Assigned Groups</span>
            <span class="detail-value">${groupCount}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Registered</span>
            <span class="detail-value">${registeredDate}</span>
          </div>
        </div>
        
        <div class="supervisor-actions">
          <button class="action-btn btn-view" onclick="viewSupervisor('${supervisor.id}')">
            <i class="fas fa-eye"></i> View
          </button>
          ${status === 'pending_approval' ? `
            <button class="action-btn btn-approve" onclick="approveSupervisor('${supervisor.id}')">
              <i class="fas fa-check"></i> Approve
            </button>
            <button class="action-btn btn-reject" onclick="rejectSupervisor('${supervisor.id}')">
              <i class="fas fa-times"></i> Reject
            </button>
          ` : status === 'active' ? `
            <button class="action-btn btn-deactivate" onclick="deactivateSupervisor('${supervisor.id}')">
              <i class="fas fa-ban"></i> Deactivate
            </button>
          ` : `
            <button class="action-btn btn-approve" onclick="activateSupervisor('${supervisor.id}')">
              <i class="fas fa-check"></i> Activate
            </button>
          `}
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// Filter supervisors
function filterSupervisors() {
  const searchTerm = document.getElementById('supervisorSearchInput').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  const deptFilter = document.getElementById('deptFilter').value;
  
  const cards = document.querySelectorAll('.supervisor-card');
  
  cards.forEach(card => {
    const supervisorId = card.getAttribute('data-supervisor-id');
    const supervisor = allSupervisors.find(s => s.id === supervisorId);
    
    if (!supervisor) return;
    
    // Search filter
    const searchText = `
      ${supervisor.fullName || ''} 
      ${supervisor.displayName || ''} 
      ${supervisor.email || ''} 
      ${supervisor.department || ''} 
      ${supervisor.employeeId || ''}
    `.toLowerCase();
    
    const matchesSearch = searchText.includes(searchTerm);
    
    // Status filter
    let status = supervisor.status || 'pending';
    if (supervisor.isActive && status !== 'pending_approval') {
      status = 'active';
    } else if (!supervisor.isActive) {
      status = 'inactive';
    }
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    
    // Department filter
    const matchesDept = deptFilter === 'all' || supervisor.department === deptFilter;
    
    card.style.display = matchesSearch && matchesStatus && matchesDept ? '' : 'none';
  });
}

// View supervisor details
function viewSupervisor(supervisorId) {
  const supervisor = allSupervisors.find(s => s.id === supervisorId);
  if (!supervisor) return;
  
  // Get assigned groups
  const assignedGroups = allGroups.filter(g => g.supervisorId === supervisorId);
  
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
    <div class="supervisor-detail">
      <h4>Personal Information</h4>
      <p>
        <strong>Name:</strong> ${supervisor.fullName || supervisor.displayName || 'N/A'}<br>
        <strong>Email:</strong> ${supervisor.email || 'N/A'}<br>
        <strong>Phone:</strong> ${supervisor.phone || 'N/A'}<br>
        <strong>Employee ID:</strong> ${supervisor.employeeId || 'N/A'}
      </p>
      
      <h4>Professional Information</h4>
      <p>
        <strong>Department:</strong> ${supervisor.department || 'N/A'}<br>
        <strong>Designation:</strong> ${supervisor.designation || 'N/A'}<br>
        <strong>Expertise:</strong> ${supervisor.expertise || 'N/A'}
      </p>
      
      <h4>Status</h4>
      <p>
        <span class="status-badge status-${supervisor.isActive ? 'active' : 'inactive'}">
          ${supervisor.isActive ? 'Active' : 'Inactive'}
        </span>
        ${supervisor.status === 'pending_approval' ? '<span class="pending-approval-badge">Pending Approval</span>' : ''}
      </p>
      
      <h4>Assigned Groups (${assignedGroups.length})</h4>
      ${assignedGroups.length > 0 ? `
        <ul style="padding-left: 20px; color: #6b7280;">
          ${assignedGroups.map(g => `
            <li>${g.groupId || g.name || 'Unknown Group'} - ${g.projectTitle || 'No project'}</li>
          `).join('')}
        </ul>
      ` : '<p style="color: #6b7280;">No groups assigned yet.</p>'}
      
      <h4>Registration Details</h4>
      <p>
        <strong>Registered:</strong> ${supervisor.registeredAt ? new Date(supervisor.registeredAt).toLocaleString() : 'N/A'}<br>
        <strong>Email Verified:</strong> ${supervisor.emailVerified ? 'Yes' : 'No'}
      </p>
      
      ${supervisor.status === 'pending_approval' || !supervisor.isActive ? `
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <h4>Actions</h4>
          <button onclick="approveSupervisor('${supervisor.id}')" class="action-btn btn-approve" style="margin-right: 10px;">
            <i class="fas fa-check"></i> Approve Supervisor
          </button>
          <button onclick="rejectSupervisor('${supervisor.id}')" class="action-btn btn-reject">
            <i class="fas fa-times"></i> Reject
          </button>
        </div>
      ` : ''}
    </div>
  `;
  
  document.getElementById('supervisorModal').classList.add('active');
}

// Close supervisor modal
function closeSupervisorModal() {
  document.getElementById('supervisorModal').classList.remove('active');
}

// Approve supervisor
async function approveSupervisor(supervisorId) {
  try {
    console.log(`✅ Approving supervisor ${supervisorId}`);
    
    const updateData = {
      isActive: true,
      status: 'approved',
      approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      approvedBy: currentAdmin.uid,
      approvedByName: currentAdmin.displayName
    };
    
    // Update in supervisors collection
    await db.collection('supervisors').doc(supervisorId).update(updateData);
    
    // Update in users collection
    await db.collection('users').doc(supervisorId).update(updateData);
    
    // Create notification for supervisor
    await db.collection('notifications').add({
      userId: supervisorId,
      type: 'account_approved',
      title: 'Account Approved',
      message: 'Your supervisor account has been approved by the administrator. You can now login and access the dashboard.',
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Supervisor approved successfully');
    alert('Supervisor approved successfully!');
    
    // Close modal and reload
    closeSupervisorModal();
    await loadSupervisors();
    
  } catch (error) {
    console.error('❌ Error approving supervisor:', error);
    alert('Error approving supervisor: ' + error.message);
  }
}

// Reject supervisor
async function rejectSupervisor(supervisorId) {
  if (!confirm('Are you sure you want to reject this supervisor? Their account will be deactivated.')) {
    return;
  }
  
  try {
    console.log(`❌ Rejecting supervisor ${supervisorId}`);
    
    const updateData = {
      isActive: false,
      status: 'rejected',
      rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
      rejectedBy: currentAdmin.uid,
      rejectedByName: currentAdmin.displayName
    };
    
    // Update in supervisors collection
    await db.collection('supervisors').doc(supervisorId).update(updateData);
    
    // Update in users collection
    await db.collection('users').doc(supervisorId).update(updateData);
    
    // Create notification for supervisor
    await db.collection('notifications').add({
      userId: supervisorId,
      type: 'account_rejected',
      title: 'Account Not Approved',
      message: 'Your supervisor account registration was not approved. Please contact the administrator for more information.',
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Supervisor rejected');
    alert('Supervisor rejected.');
    
    // Close modal and reload
    closeSupervisorModal();
    await loadSupervisors();
    
  } catch (error) {
    console.error('❌ Error rejecting supervisor:', error);
    alert('Error rejecting supervisor: ' + error.message);
  }
}

// Deactivate supervisor
async function deactivateSupervisor(supervisorId) {
  if (!confirm('Are you sure you want to deactivate this supervisor? They will lose access to the dashboard.')) {
    return;
  }
  
  try {
    console.log(`🔒 Deactivating supervisor ${supervisorId}`);
    
    await db.collection('supervisors').doc(supervisorId).update({
      isActive: false,
      status: 'inactive',
      deactivatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      deactivatedBy: currentAdmin.uid
    });
    
    await db.collection('users').doc(supervisorId).update({
      isActive: false
    });
    
    console.log('✅ Supervisor deactivated');
    alert('Supervisor deactivated successfully.');
    
    closeSupervisorModal();
    await loadSupervisors();
    
  } catch (error) {
    console.error('❌ Error deactivating supervisor:', error);
    alert('Error deactivating supervisor: ' + error.message);
  }
}

// Activate supervisor
async function activateSupervisor(supervisorId) {
  try {
    console.log(`🔓 Activating supervisor ${supervisorId}`);
    
    await db.collection('supervisors').doc(supervisorId).update({
      isActive: true,
      status: 'approved',
      activatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      activatedBy: currentAdmin.uid
    });
    
    await db.collection('users').doc(supervisorId).update({
      isActive: true
    });
    
    console.log('✅ Supervisor activated');
    alert('Supervisor activated successfully.');
    
    closeSupervisorModal();
    await loadSupervisors();
    
  } catch (error) {
    console.error('❌ Error activating supervisor:', error);
    alert('Error activating supervisor: ' + error.message);
  }
}

// Show pending approvals (filter to show only pending)
function showPendingApprovals() {
  document.getElementById('statusFilter').value = 'pending';
  filterSupervisors();
}

// Export supervisors to CSV
function exportSupervisors() {
  if (allSupervisors.length === 0) {
    alert('No supervisors to export');
    return;
  }
  
  let csv = 'Supervisor ID,Name,Email,Department,Designation,Employee ID,Status,Registered Date,Groups Assigned\n';
  
  allSupervisors.forEach(sup => {
    const groupCount = allGroups.filter(g => g.supervisorId === sup.id).length;
    const status = sup.isActive ? (sup.status === 'pending_approval' ? 'Pending' : 'Active') : 'Inactive';
    
    csv += `${sup.id},"${sup.fullName || sup.displayName || 'N/A'}","${sup.email || 'N/A'}","${sup.department || 'N/A'}","${sup.designation || 'N/A'}","${sup.employeeId || 'N/A'}","${status}","${sup.registeredAt || 'N/A'}",${groupCount}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `supervisors_export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
  
  console.log('✅ Supervisors exported');
}

// Show error message
function showError(message) {
  const container = document.getElementById('supervisorsContainer');
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
  const modal = document.getElementById('supervisorModal');
  if (event.target === modal) {
    closeSupervisorModal();
  }
}

console.log('✅ Admin Supervisors JS loaded');
