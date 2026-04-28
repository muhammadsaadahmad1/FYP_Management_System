// Firebase Authentication Check for Supervisor Proposals Page
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

    console.log('Supervisor role confirmed, loading proposals data...');
    
    localStorage.setItem('uid', user.uid);
    localStorage.setItem('displayName', userData.displayName || user.email);
    localStorage.setItem('role', userData.role);
    
    loadSupervisorProposalsPage();
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

// Global variable to store proposals data
let supervisorProposalsData = [];

// Load all proposals page data
async function loadSupervisorProposalsPage() {
  console.log('Loading supervisor proposals page data...');
  
  try {
    const supervisorId = localStorage.getItem('uid');
    
    if (!supervisorId) {
      console.log('Missing supervisorId');
      if (typeof showNotification !== 'undefined') {
        showNotification('Missing user information. Please log in again.', 'error');
      }
      return;
    }
    
    // Load proposals data
    const proposalsData = await loadAllSupervisorProposals(supervisorId);
    supervisorProposalsData = proposalsData;
    
    // Update stats
    updateProposalsStats(proposalsData);
    
    // Display proposals
    displayProposalsList(proposalsData);
    
    console.log('Supervisor proposals page loaded successfully');
    
  } catch (error) {
    console.error('Error loading supervisor proposals page:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error loading proposals data.', 'error');
    }
  }
}

// Load all supervisor proposals with details
async function loadAllSupervisorProposals(supervisorId) {
  try {
    const proposalsSnapshot = await db.collection('proposals')
      .where('supervisorId', '==', supervisorId)
      .orderBy('submittedDate', 'desc')
      .get();
    
    const proposals = [];
    
    for (const proposalDoc of proposalsSnapshot.docs) {
      const proposalData = proposalDoc.data();
      
      // Get group information
      const groupDoc = await db.collection('groups').doc(proposalData.groupId).get();
      const groupData = groupDoc.exists ? groupDoc.data() : null;
      
      // Get student information
      let studentNames = [];
      if (groupData && groupData.members) {
        for (const memberId of groupData.members) {
          // Validate memberId is a string before using it
          if (typeof memberId === 'string' && memberId.trim() !== '') {
            try {
              const memberDoc = await db.collection('users').doc(memberId).get();
              if (memberDoc.exists) {
                studentNames.push(memberDoc.data().displayName);
              }
            } catch (memberError) {
              console.error('Error loading member:', memberId, memberError);
            }
          } else {
            console.warn('Invalid memberId found:', memberId);
          }
        }
      }
      
      proposals.push({
        id: proposalDoc.id,
        title: proposalData.title || 'Untitled Proposal',
        description: proposalData.description || '',
        category: proposalData.category || 'other',
        status: proposalData.status || 'pending',
        submittedDate: proposalData.submittedDate || null,
        reviewedDate: proposalData.reviewedDate || null,
        feedback: proposalData.feedback || '',
        groupId: proposalData.groupId,
        groupName: groupData ? groupData.groupName : 'Unknown Group',
        studentNames: studentNames,
        supervisorId: proposalData.supervisorId,
        attachments: proposalData.attachments || []
      });
    }
    
    return proposals;
  } catch (error) {
    console.error('Error loading supervisor proposals:', error);
    return [];
  }
}

// Update statistics cards
function updateProposalsStats(proposalsData) {
  const pendingCount = proposalsData.filter(p => p.status === 'pending').length;
  const underReviewCount = proposalsData.filter(p => p.status === 'under_review').length;
  const approvedCount = proposalsData.filter(p => p.status === 'approved').length;
  const rejectedCount = proposalsData.filter(p => p.status === 'rejected').length;
  
  document.getElementById('pendingCount').textContent = pendingCount;
  document.getElementById('underReviewCount').textContent = underReviewCount;
  document.getElementById('approvedCount').textContent = approvedCount;
  document.getElementById('rejectedCount').textContent = rejectedCount;
}

// Display proposals list
function displayProposalsList(proposalsData) {
  const container = document.getElementById('proposalsListContainer');
  if (!container) return;
  
  if (proposalsData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-file-alt" style="font-size: 48px; color: #cbd5e1; margin-bottom: 20px;"></i>
        <h4>No Proposals Found</h4>
        <p style="color: #6b7280;">No proposals have been submitted yet.</p>
      </div>
    `;
    return;
  }
  
  const proposalsHtml = proposalsData.map(proposal => `
    <div class="proposal-card" data-proposal-id="${proposal.id}" data-status="${proposal.status}" data-category="${proposal.category}">
      <div class="proposal-card-header">
        <div class="proposal-info">
          <h4>${proposal.title}</h4>
          <span class="proposal-id">ID: ${proposal.id}</span>
        </div>
        <span class="status-badge ${proposal.status}">${formatStatus(proposal.status)}</span>
      </div>
      
      <div class="proposal-card-body">
        <div class="proposal-detail">
          <i class="fas fa-users"></i>
          <div>
            <label>Group</label>
            <p>${proposal.groupName}</p>
          </div>
        </div>
        
        <div class="proposal-detail">
          <i class="fas fa-user-graduate"></i>
          <div>
            <label>Students</label>
            <p>${proposal.studentNames.join(', ') || 'N/A'}</p>
          </div>
        </div>
        
        <div class="proposal-detail">
          <i class="fas fa-tag"></i>
          <div>
            <label>Category</label>
            <p>${formatCategory(proposal.category)}</p>
          </div>
        </div>
        
        <div class="proposal-detail">
          <i class="fas fa-calendar"></i>
          <div>
            <label>Submitted</label>
            <p>${proposal.submittedDate ? new Date(proposal.submittedDate).toLocaleDateString() : 'N/A'}</p>
          </div>
        </div>
      </div>
      
      <div class="proposal-description">
        <p>${proposal.description.substring(0, 150)}${proposal.description.length > 150 ? '...' : ''}</p>
      </div>
      
      <div class="proposal-card-actions">
        <button class="btn btn-primary" onclick="reviewProposal('${proposal.id}')">
          <i class="fas fa-eye"></i> Review
        </button>
        <button class="btn btn-secondary" onclick="downloadProposal('${proposal.id}')">
          <i class="fas fa-download"></i> Download
        </button>
        <button class="btn btn-info" onclick="viewProposalHistory('${proposal.id}')">
          <i class="fas fa-history"></i> History
        </button>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = proposalsHtml;
}

// Filter proposals based on search and filters
function filterProposals() {
  const searchInput = document.getElementById('proposalSearchInput').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  const categoryFilter = document.getElementById('categoryFilter').value;
  
  const filteredProposals = supervisorProposalsData.filter(proposal => {
    const matchesSearch = 
      proposal.title.toLowerCase().includes(searchInput) ||
      proposal.groupName.toLowerCase().includes(searchInput) ||
      proposal.studentNames.some(name => name.toLowerCase().includes(searchInput));
    
    const matchesStatus = statusFilter === 'all' || proposal.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || proposal.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });
  
  displayProposalsList(filteredProposals);
}

// Sort proposals
function sortProposals() {
  const sortBy = document.getElementById('sortBy').value;
  let sortedProposals = [...supervisorProposalsData];
  
  switch(sortBy) {
    case 'date_desc':
      sortedProposals.sort((a, b) => new Date(b.submittedDate || 0) - new Date(a.submittedDate || 0));
      break;
    case 'date_asc':
      sortedProposals.sort((a, b) => new Date(a.submittedDate || 0) - new Date(b.submittedDate || 0));
      break;
    case 'title_asc':
      sortedProposals.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'title_desc':
      sortedProposals.sort((a, b) => b.title.localeCompare(a.title));
      break;
  }
  
  displayProposalsList(sortedProposals);
}

// Review proposal
async function reviewProposal(proposalId) {
  try {
    const proposal = supervisorProposalsData.find(p => p.id === proposalId);
    if (!proposal) {
      if (typeof showNotification !== 'undefined') {
        showNotification('Proposal not found', 'error');
      }
      return;
    }
    
    const modal = document.getElementById('proposalReviewModal');
    const content = document.getElementById('proposalReviewContent');
    
    content.innerHTML = `
      <div class="proposal-review">
        <div class="review-section">
          <h4>Proposal Details</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <label>Title:</label>
              <p>${proposal.title}</p>
            </div>
            <div class="detail-item">
              <label>Group:</label>
              <p>${proposal.groupName}</p>
            </div>
            <div class="detail-item">
              <label>Students:</label>
              <p>${proposal.studentNames.join(', ')}</p>
            </div>
            <div class="detail-item">
              <label>Category:</label>
              <p>${formatCategory(proposal.category)}</p>
            </div>
            <div class="detail-item">
              <label>Submitted:</label>
              <p>${proposal.submittedDate ? new Date(proposal.submittedDate).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div class="detail-item">
              <label>Status:</label>
              <span class="status-badge ${proposal.status}">${formatStatus(proposal.status)}</span>
            </div>
          </div>
        </div>
        
        <div class="review-section">
          <h4>Description</h4>
          <p>${proposal.description}</p>
        </div>
        
        ${proposal.attachments && proposal.attachments.length > 0 ? `
          <div class="review-section">
            <h4>Attachments</h4>
            <div class="attachments-list">
              ${proposal.attachments.map(att => `
                <div class="attachment-item">
                  <i class="fas fa-file"></i>
                  <span>${att.name}</span>
                  <button class="btn btn-sm btn-secondary" onclick="downloadAttachment('${att.url}')">
                    <i class="fas fa-download"></i>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <div class="review-section">
          <h4>Review Action</h4>
          <form id="reviewForm">
            <div class="form-group">
              <label for="reviewDecision">Decision:</label>
              <select id="reviewDecision" required>
                <option value="">Select Decision</option>
                <option value="approved">Approve</option>
                <option value="rejected">Reject</option>
                <option value="under_review">Request Changes</option>
              </select>
            </div>
            <div class="form-group">
              <label for="reviewFeedback">Feedback:</label>
              <textarea id="reviewFeedback" rows="4" placeholder="Provide detailed feedback..."></textarea>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" onclick="closeProposalReviewModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">Submit Review</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    // Add form submit handler
    document.getElementById('reviewForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitProposalReview(proposalId);
    });
    
    modal.style.display = 'block';
    
  } catch (error) {
    console.error('Error reviewing proposal:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error loading proposal for review', 'error');
    }
  }
}

// Submit proposal review
async function submitProposalReview(proposalId) {
  try {
    const decision = document.getElementById('reviewDecision').value;
    const feedback = document.getElementById('reviewFeedback').value;
    
    if (!decision) {
      if (typeof showNotification !== 'undefined') {
        showNotification('Please select a decision', 'error');
      }
      return;
    }
    
    const supervisorId = localStorage.getItem('uid');
    
    await db.collection('proposals').doc(proposalId).update({
      status: decision,
      feedback: feedback,
      reviewedDate: new Date().toISOString(),
      reviewedBy: supervisorId
    });
    
    // Send notification to students
    const proposal = supervisorProposalsData.find(p => p.id === proposalId);
    if (proposal && proposal.groupId) {
      const groupDoc = await db.collection('groups').doc(proposal.groupId).get();
      if (groupDoc.exists) {
        const groupData = groupDoc.data();
        if (groupData.members) {
          for (const memberId of groupData.members) {
            // Validate memberId is a string before using it
            if (typeof memberId === 'string' && memberId.trim() !== '') {
              try {
                await db.collection('notifications').add({
                  userId: memberId,
                  type: 'proposal_review',
                  title: `Proposal ${decision}`,
                  message: `Your proposal "${proposal.title}" has been ${decision}.`,
                  proposalId: proposalId,
                  createdAt: new Date().toISOString(),
                  read: false
                });
              } catch (notificationError) {
                console.error('Error sending notification to member:', memberId, notificationError);
              }
            } else {
              console.warn('Invalid memberId found when sending notification:', memberId);
            }
          }
        }
      }
    }
    
    if (typeof showNotification !== 'undefined') {
      showNotification(`Proposal ${decision} successfully!`, 'success');
    }
    
    closeProposalReviewModal();
    loadSupervisorProposalsPage(); // Reload data
    
  } catch (error) {
    console.error('Error submitting review:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error submitting review', 'error');
    }
  }
}

// Download proposal
function downloadProposal(proposalId) {
  const proposal = supervisorProposalsData.find(p => p.id === proposalId);
  if (!proposal) return;
  
  // Create a simple text file with proposal details
  const content = `
PROPOSAL DETAILS
================
Title: ${proposal.title}
Group: ${proposal.groupName}
Students: ${proposal.studentNames.join(', ')}
Category: ${formatCategory(proposal.category)}
Submitted: ${proposal.submittedDate ? new Date(proposal.submittedDate).toLocaleDateString() : 'N/A'}
Status: ${formatStatus(proposal.status)}

DESCRIPTION
-----------
${proposal.description}

${proposal.feedback ? `FEEDBACK
--------
${proposal.feedback}` : ''}
  `.trim();
  
  const blob = new Blob([content], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `proposal_${proposal.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// View proposal history
function viewProposalHistory(proposalId) {
  if (typeof showNotification !== 'undefined') {
    showNotification('Proposal history feature coming soon!', 'info');
  }
}

// Modal functions
function closeProposalReviewModal() {
  document.getElementById('proposalReviewModal').style.display = 'none';
}

function openNewProposalModal() {
  document.getElementById('createProposalModal').style.display = 'block';
}

function closeCreateProposalModal() {
  document.getElementById('createProposalModal').style.display = 'none';
  document.getElementById('createProposalForm').reset();
}

// Create proposal template
document.getElementById('createProposalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  try {
    const title = document.getElementById('templateTitle').value;
    const description = document.getElementById('templateDescription').value;
    const category = document.getElementById('templateCategory').value;
    const supervisorId = localStorage.getItem('uid');
    
    await db.collection('proposal_templates').add({
      title: title,
      description: description,
      category: category,
      supervisorId: supervisorId,
      createdAt: new Date().toISOString()
    });
    
    if (typeof showNotification !== 'undefined') {
      showNotification('Proposal template created successfully!', 'success');
    }
    
    closeCreateProposalModal();
    
  } catch (error) {
    console.error('Error creating proposal template:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error creating proposal template', 'error');
    }
  }
});

// Export proposals
function exportProposals() {
  if (typeof showNotification !== 'undefined') {
    showNotification('Export feature coming soon!', 'info');
  }
}

// Helper functions
function formatStatus(status) {
  if (!status) return 'Pending';
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatCategory(category) {
  const categories = {
    'ai': 'AI & Machine Learning',
    'web': 'Web Development',
    'mobile': 'Mobile Development',
    'data': 'Data Science',
    'security': 'Cybersecurity',
    'other': 'Other'
  };
  return categories[category] || category;
}

function showNotifications() {
  if (typeof showNotification !== 'undefined') {
    showNotification('Notification center coming soon!', 'info');
  }
}

// Close modals when clicking outside
window.onclick = function(event) {
  const reviewModal = document.getElementById('proposalReviewModal');
  const createModal = document.getElementById('createProposalModal');
  
  if (event.target === reviewModal) {
    reviewModal.style.display = 'none';
  }
  if (event.target === createModal) {
    createModal.style.display = 'none';
  }
}
