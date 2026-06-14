/**
 * Admin Proposals Page - Full Firebase Integration
 * Manage all proposals and assign to supervisors
 */

let allProposals = [];
let allSupervisors = [];
let allGroups = [];
let currentAdmin = null;

// Load Admin Proposals Page
async function loadAdminProposalsPage() {
  console.log('🚀 Loading Admin Proposals Page...');
  
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
    
    await Promise.all([
      loadSupervisors(),
      loadGroups(),
      loadProposals()
    ]);

    await ProposalWorkflow.checkAndNotifyOverdueProposals();
    
    console.log('✅ Admin Proposals Page loaded successfully');
    
  } catch (error) {
    console.error('❌ Error loading admin proposals page:', error);
    showError('Failed to load proposals data. Please try again.');
  }
}

// Load all supervisors for assignment
async function loadSupervisors() {
  try {
    console.log('👔 Loading supervisors...');
    
    const snapshot = await db.collection('supervisors')
      .where('isActive', '==', true)
      .get();
    
    allSupervisors = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ Loaded ${allSupervisors.length} supervisors`);
    
    // Populate supervisor filter dropdown
    const supervisorFilter = document.getElementById('supervisorFilter');
    if (supervisorFilter) {
      // Clear existing options except first two
      while (supervisorFilter.options.length > 2) {
        supervisorFilter.remove(2);
      }
      
      // Add supervisor options
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

// Load all proposals
async function loadProposals() {
  try {
    console.log('📋 Loading proposals...');
    
    const container = document.getElementById('proposalsTableContainer');
    if (container) {
      container.innerHTML = `
        <div class="loading-spinner">
          <i class="fas fa-spinner"></i>
          <p>Loading proposals...</p>
        </div>
      `;
    }
    
    const snapshot = await db.collection('proposals').get();

    allProposals = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));

    allProposals.sort((a, b) => {
      const dateA = new Date(ProposalWorkflow.getSubmittedDate(a) || 0).getTime();
      const dateB = new Date(ProposalWorkflow.getSubmittedDate(b) || 0).getTime();
      return dateB - dateA;
    });
    
    console.log(`✅ Loaded ${allProposals.length} proposals`);
    
    if (typeof ProposalPdfStore !== 'undefined') {
      ProposalPdfStore.registerLookup(allProposals);
    }
    
    // Update stats
    updateProposalStats();
    
    // Render proposals table
    renderProposalsTable();
    
  } catch (error) {
    console.error('❌ Error loading proposals:', error);
    
    const container = document.getElementById('proposalsTableContainer');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-circle"></i>
          <h3>Error Loading Proposals</h3>
          <p>${error.message}</p>
          <button onclick="loadProposals()" class="btn btn-primary" style="margin-top: 15px;">
            <i class="fas fa-sync"></i> Retry
          </button>
        </div>
      `;
    }
  }
}

// Update proposal statistics
function updateProposalStats() {
  const pending = allProposals.filter(p => p.assignmentStatus === 'pending_supervisor').length;
  const assigned = allProposals.filter(p =>
    p.assignmentStatus === 'admin_assigned' || p.status === 'assigned' || p.assignmentStatus === 'accepted'
  ).length;
  const approved = allProposals.filter(p => p.status === 'approved').length;
  const total = allProposals.length;
  
  document.getElementById('pendingCount').textContent = pending;
  document.getElementById('assignedCount').textContent = assigned;
  document.getElementById('approvedCount').textContent = approved;
  document.getElementById('totalCount').textContent = total;
}

// Render proposals table
function renderProposalsTable() {
  const container = document.getElementById('proposalsTableContainer');
  
  if (allProposals.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-file-alt"></i>
        <h3>No Proposals Found</h3>
        <p>No project proposals have been submitted yet.</p>
      </div>
    `;
    return;
  }
  
  let html = `
    <table class="proposals-table">
      <thead>
        <tr>
          <th>Group</th>
          <th>Project Title</th>
          <th>Category</th>
          <th>Supervisor</th>
          <th>Status</th>
          <th>Submitted</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  allProposals.forEach(proposal => {
    const group = allGroups.find(g => g.id === proposal.groupId) || {};
    const groupName = group.groupId || group.name || proposal.groupId || 'Unknown Group';

    const supervisorId = proposal.requestedSupervisorId || proposal.supervisorId;
    const supervisor = allSupervisors.find(s => s.id === supervisorId) || {};
    const supervisorName = proposal.requestedSupervisorName || proposal.supervisorName ||
      supervisor.fullName || supervisor.displayName || 'Not Assigned';

    const overdue = ProposalWorkflow.isOverdue(proposal);
    let status = proposal.assignmentStatus || proposal.status || 'pending';
    let statusClass = `status-${proposal.status || 'pending'}`;
    let statusText = status.replace(/_/g, ' ');

    if (overdue) {
      statusText = 'Overdue — No Response';
      statusClass = 'status-pending';
    } else if (status === 'pending_supervisor') {
      statusText = 'Awaiting Supervisor';
    } else if (status === 'accepted') {
      statusText = 'Accepted';
      statusClass = 'status-approved';
    } else if (status === 'admin_assigned') {
      statusText = 'Admin Assigned';
      statusClass = 'status-assigned';
    }

    const submittedRaw = ProposalWorkflow.getSubmittedDate(proposal);
    const submittedDate = submittedRaw ?
      new Date(submittedRaw).toLocaleDateString() :
      'Unknown';

    html += `
      <tr data-proposal-id="${proposal.id}">
        <td>${groupName}</td>
        <td>${proposal.title || proposal.projectTitle || 'Untitled'}</td>
        <td>${proposal.category || proposal.projectType || 'N/A'}</td>
        <td>${supervisorName}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>${submittedDate}</td>
        <td>
          <button class="action-btn btn-view" onclick="viewProposal('${proposal.id}')">
            <i class="fas fa-eye"></i> View
          </button>
          ${typeof ProposalPdfStore !== 'undefined' && ProposalPdfStore.hasProposalPdf(proposal) ? `
          <button class="action-btn btn-view" onclick="viewProposalPdf('${proposal.id}')">
            <i class="fas fa-file-pdf"></i> View Proposal
          </button>` : ''}
          ${overdue ? `
            <button class="action-btn btn-approve" onclick="adminPermanentlyAssignProposal('${proposal.id}', '${proposal.groupId}')">
              <i class="fas fa-gavel"></i> Force Assign
            </button>
          ` : (!proposal.supervisorId && proposal.assignmentStatus !== 'pending_supervisor') ? `
            <button class="action-btn btn-assign" onclick="showAssignModal('${proposal.id}')">
              <i class="fas fa-user-tie"></i> Assign
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

// Filter proposals
function filterProposals() {
  const searchTerm = document.getElementById('proposalSearchInput').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  const supervisorFilter = document.getElementById('supervisorFilter').value;
  
  const rows = document.querySelectorAll('.proposals-table tbody tr');
  
  rows.forEach(row => {
    const proposalId = row.getAttribute('data-proposal-id');
    const proposal = allProposals.find(p => p.id === proposalId);
    
    if (!proposal) return;
    
    // Search filter
    const group = allGroups.find(g => g.id === proposal.groupId) || {};
    const searchText = `
      ${proposal.title || ''} 
      ${proposal.projectTitle || ''} 
      ${proposal.description || ''} 
      ${group.groupId || ''} 
      ${group.name || ''}
    `.toLowerCase();
    
    const matchesSearch = searchText.includes(searchTerm);
    
    // Status filter
    let status = proposal.status || 'pending';
    if (proposal.supervisorId && status === 'pending') {
      status = 'assigned';
    }
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    
    // Supervisor filter
    let matchesSupervisor = true;
    if (supervisorFilter === 'unassigned') {
      matchesSupervisor = !proposal.supervisorId;
    } else if (supervisorFilter !== 'all') {
      matchesSupervisor = proposal.supervisorId === supervisorFilter;
    }
    
    row.style.display = matchesSearch && matchesStatus && matchesSupervisor ? '' : 'none';
  });
}

// View proposal details
function viewProposal(proposalId) {
  const proposal = allProposals.find(p => p.id === proposalId);
  if (!proposal) return;
  
  const group = allGroups.find(g => g.id === proposal.groupId) || {};
  const supervisor = allSupervisors.find(s => s.id === proposal.supervisorId) || {};
  
  const overdue = ProposalWorkflow.isOverdue(proposal);
  const requestedName = proposal.requestedSupervisorName || supervisor.fullName || supervisor.displayName || 'N/A';
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = `
    <div class="proposal-detail">
      <h4>Project Title</h4>
      <p>${proposal.title || proposal.projectTitle || 'Untitled'}</p>

      <h4>Abstract</h4>
      <p>${ProposalWorkflow.getDescription(proposal) || 'No description provided.'}</p>

      <h4>Group Information</h4>
      <p>
        <strong>Group ID:</strong> ${group.groupId || group.name || proposal.groupId || 'N/A'}<br>
        <strong>Members:</strong> ${group.members ? group.members.map(m => m.fullName || m.name || m.email).join(', ') : 'N/A'}
      </p>

      <h4>Requested Supervisor</h4>
      <p>${requestedName}</p>

      <h4>Assignment Status</h4>
      <p>${proposal.assignmentStatus || proposal.status || 'pending'}${overdue ? ' (OVERDUE — 7+ days)' : ''}</p>
      ${proposal.responseDeadline ? `<p><strong>Supervisor deadline:</strong> ${new Date(proposal.responseDeadline).toLocaleString()}</p>` : ''}
      ${proposal.rejectionReport || proposal.reviewComment ? `<p><strong>Review comment:</strong> ${proposal.rejectionReport || proposal.reviewComment}</p>` : ''}

      ${typeof ProposalPdfStore !== 'undefined' && ProposalPdfStore.hasProposalPdf(proposal) ? `
        <div style="margin-top:16px;">
          <button type="button" class="action-btn btn-view" onclick="viewProposalPdf('${proposal.id}')">
            <i class="fas fa-file-pdf"></i> View Proposal PDF
          </button>
        </div>
      ` : ''}

      ${overdue ? `
        <div class="assign-section">
          <h4>Permanent Assignment (Admin Authority)</h4>
          <p>Supervisor did not respond within 7 days. You may permanently assign this project to ${requestedName}.</p>
          <button class="btn-approve action-btn" onclick="adminPermanentlyAssignProposal('${proposal.id}', '${proposal.groupId}')">
            <i class="fas fa-gavel"></i> Permanently Assign to ${requestedName}
          </button>
        </div>
      ` : (!proposal.supervisorId && proposal.assignmentStatus !== 'pending_supervisor') ? `
        <div class="assign-section">
          <h4>Assign Supervisor</h4>
          <div class="assign-controls">
            <select id="assignSupervisorSelect">
              <option value="">Select Supervisor</option>
              ${allSupervisors.map(s => `
                <option value="${s.id}">${s.fullName || s.displayName} (${s.department || 'N/A'})</option>
              `).join('')}
            </select>
            <button onclick="assignSupervisor('${proposal.id}', '${proposal.groupId}')">
              <i class="fas fa-check"></i> Assign
            </button>
          </div>
        </div>
      ` : ''}
    </div>
  `;
  
  document.getElementById('proposalModal').classList.add('active');
}

// Close proposal modal
function closeProposalModal() {
  document.getElementById('proposalModal').classList.remove('active');
}

function viewProposalPdf(proposalId) {
  const normalizedId = String(proposalId || '').trim();
  ProposalPdfStore.viewProposalById(normalizedId).catch((error) => {
    alert(error.message || 'Unable to open proposal PDF.');
  });
}

// Show assign modal (simplified version)
function showAssignModal(proposalId) {
  viewProposal(proposalId);
}

// Permanently assign after 7-day supervisor timeout
async function adminPermanentlyAssignProposal(proposalId, groupId) {
  if (!confirm('Permanently assign this group and proposal to the requested supervisor?')) return;

  try {
    await ProposalWorkflow.adminPermanentlyAssign({
      proposalId,
      groupId,
      adminUid: currentAdmin.uid
    });

    alert('Project permanently assigned to supervisor.');
    closeProposalModal();
    await loadProposals();
  } catch (error) {
    console.error('❌ Error force-assigning supervisor:', error);
    alert('Error: ' + error.message);
  }
}

// Assign supervisor to proposal
async function assignSupervisor(proposalId, groupId) {
  const supervisorSelect = document.getElementById('assignSupervisorSelect');
  const supervisorId = supervisorSelect.value;
  
  if (!supervisorId) {
    alert('Please select a supervisor');
    return;
  }
  
  try {
    console.log(`📝 Assigning supervisor ${supervisorId} to proposal ${proposalId}`);
    
    const supervisor = allSupervisors.find(s => s.id === supervisorId);
    
    // Update proposal
    await db.collection('proposals').doc(proposalId).update({
      supervisorId: supervisorId,
      supervisorName: supervisor.fullName || supervisor.displayName,
      status: 'assigned',
      assignedAt: firebase.firestore.FieldValue.serverTimestamp(),
      assignedBy: currentAdmin.uid
    });
    
    // Update group with supervisor
    if (groupId) {
      await db.collection('groups').doc(groupId).update({
        supervisorId: supervisorId,
        supervisorName: supervisor.fullName || supervisor.displayName,
        assignedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // Create notification for supervisor
    await db.collection('notifications').add({
      userId: supervisorId,
      type: 'proposal_assigned',
      title: 'New Proposal Assigned',
      message: `You have been assigned to review a new project proposal.`,
      proposalId: proposalId,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Supervisor assigned successfully');
    alert('Supervisor assigned successfully!');
    
    // Close modal and reload
    closeProposalModal();
    await loadProposals();
    
  } catch (error) {
    console.error('❌ Error assigning supervisor:', error);
    alert('Error assigning supervisor: ' + error.message);
  }
}

// Export proposals to CSV
function exportProposals() {
  if (allProposals.length === 0) {
    alert('No proposals to export');
    return;
  }
  
  let csv = 'Proposal ID,Group,Title,Category,Supervisor,Status,Submitted Date\n';
  
  allProposals.forEach(proposal => {
    const group = allGroups.find(g => g.id === proposal.groupId) || {};
    const supervisor = allSupervisors.find(s => s.id === proposal.supervisorId) || {};
    
    csv += `${proposal.id},"${group.groupId || group.name || 'N/A'}","${proposal.title || proposal.projectTitle || 'Untitled'}","${proposal.category || proposal.projectType || 'N/A'}","${supervisor.fullName || supervisor.displayName || 'Not Assigned'}","${proposal.status || 'pending'}","${proposal.submittedAt ? new Date(proposal.submittedAt.toDate ? proposal.submittedAt.toDate() : proposal.submittedAt).toLocaleDateString() : 'N/A'}"\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `proposals_export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
  
  console.log('✅ Proposals exported');
}

// Show notifications (placeholder)
function showNotifications() {
  alert('Notifications feature coming soon!');
}

// Show error message
function showError(message) {
  const container = document.getElementById('proposalsTableContainer');
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
  const modal = document.getElementById('proposalModal');
  if (event.target === modal) {
    closeProposalModal();
  }
}

console.log('✅ Admin Proposals JS loaded');
