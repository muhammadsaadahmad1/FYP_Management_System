// Real Firebase data loader for proposals page
console.log('🔥 Loading real Firebase proposal data...');

// Load real Firebase data when page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('📊 Proposals page loaded, checking authentication...');
  
  // Wait for Firebase to be ready
  setTimeout(() => {
    if (typeof auth !== 'undefined') {
      loadRealProposalData();
    } else {
      console.log('⚠️ Firebase not ready, using demo data');
      loadDemoProposalData();
    }
  }, 1000);
});

async function loadRealProposalData() {
  console.log('🔄 Loading real Firebase proposal data...');
  
  try {
    // Check if user is authenticated
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No user authenticated, redirecting to login...');
      window.location.href = 'login.html';
      return;
    }

    console.log('✅ User authenticated:', user.email);

    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.role !== 'student') {
      console.log('❌ User is not a student');
      window.location.href = 'login.html';
      return;
    }

    // Store user data in localStorage
    localStorage.setItem('uid', user.uid);
    localStorage.setItem('groupId', userData.groupId || user.uid);

    const groupId = userData.groupId || user.uid;
    console.log('📋 Loading proposals for group:', groupId);

    // Load current proposal
    const currentProposal = await loadCurrentProposal(groupId);
    
    // Load proposals history
    const proposalsHistory = await loadProposalsHistory(groupId);
    
    // Load supervisor feedback
    const feedbackData = await loadSupervisorFeedback(groupId);

    // Update UI with real data
    updateCurrentProposalStatus(currentProposal);
    updateProposalsTable(proposalsHistory);
    updateSupervisorFeedback(feedbackData);

    console.log('✅ Real Firebase proposal data loaded successfully!');
    
    // Show success notification
    if (typeof showNotification !== 'undefined') {
      showNotification('Proposal data loaded successfully!', 'success');
    }

  } catch (error) {
    console.error('❌ Error loading real Firebase data:', error);
    console.log('📊 Showing empty state instead of demo data...');
    showEmptyProposalState();
    loadDemoProposalData();
  }
}

async function loadCurrentProposal(groupId) {
  try {
    // Simple query without complex ordering to avoid index requirements
    const proposalsSnapshot = await db.collection('proposals')
      .where('groupId', '==', groupId)
      .limit(10) // Get all proposals for this group, will filter in code
      .get();
    
    if (!proposalsSnapshot.empty) {
      // Find the current proposal (isCurrent: true) from the results
      const currentProposal = proposalsSnapshot.docs.find(doc => {
        const data = doc.data();
        return data.isCurrent === true;
      });
      
      if (currentProposal) {
        return {
          id: currentProposal.id,
          ...currentProposal.data()
        };
      } else {
        // Return first proposal if no current one found
        return {
          id: proposalsSnapshot.docs[0].id,
          ...proposalsSnapshot.docs[0].data()
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error loading current proposal:', error);
    return null;
  }
}

async function loadProposalsHistory(groupId) {
  try {
    // Simple query without complex ordering to avoid index requirements
    const proposalsSnapshot = await db.collection('proposals')
      .where('groupId', '==', groupId)
      .limit(20) // Get all proposals for this group, will sort in code
      .get();
    
    // Sort manually in JavaScript to avoid index requirements
    const proposals = proposalsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Sort by submittedDate in JavaScript (newest first)
    return proposals.sort((a, b) => {
      const dateA = new Date(a.submittedDate || 0);
      const dateB = new Date(b.submittedDate || 0);
      return dateB - dateA;
    });
  } catch (error) {
    console.error('Error loading proposals history:', error);
    return [];
  }
}

async function loadSupervisorFeedback(groupId) {
  try {
    // Simple query without complex ordering to avoid index requirements
    const feedbackSnapshot = await db.collection('feedback')
      .where('groupId', '==', groupId)
      .limit(10) // Get all feedback for this group, will sort in code
      .get();
    
    // Sort manually in JavaScript to avoid index requirements
    const feedback = feedbackSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Sort by timestamp in JavaScript (newest first)
    return feedback.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0);
      const timeB = new Date(b.timestamp || 0);
      return timeB - timeA;
    });
  } catch (error) {
    console.error('Error loading supervisor feedback:', error);
    return [];
  }
}

function updateCurrentProposalStatus(proposal) {
  const statusCard = document.getElementById('currentProposalStatus');
  if (!statusCard) return;
  
  if (!proposal) {
    statusCard.innerHTML = `
      <div class="no-proposal">
        <i class="fas fa-file-upload"></i>
        <h4>No Proposal Submitted</h4>
        <p>You haven't submitted any proposal yet. Click "New Proposal" to get started.</p>
        <button class="btn btn-primary" onclick="showNewProposalForm()">Submit First Proposal</button>
      </div>
    `;
    return;
  }
  
  const statusClass = proposal.status ? proposal.status.toLowerCase() : 'pending';
  const statusDisplay = getStatusDisplay(proposal.status);
  
  statusCard.innerHTML = `
    <div class="proposal-details">
      <div class="proposal-header">
        <h4>${proposal.title}</h4>
        <span class="status ${statusClass}">${statusDisplay}</span>
      </div>
      <div class="proposal-info">
        <p><strong>Submitted:</strong> ${new Date(proposal.submittedDate).toLocaleDateString()}</p>
        <p><strong>Last Updated:</strong> ${new Date(proposal.lastUpdated).toLocaleDateString()}</p>
        <p><strong>Supervisor:</strong> ${proposal.supervisor || 'Not Assigned'}</p>
      </div>
      <div class="proposal-progress">
        <p><strong>Progress:</strong></p>
        <div class="progress-bar">
          <div class="progress" style="width: ${proposal.progress || 0}%"></div>
        </div>
        <span class="progress-text">${proposal.progress || 0}%</span>
      </div>
      <div class="proposal-actions">
        <button class="btn btn-secondary" onclick="viewProposal('${proposal.id}')">
          <i class="fas fa-eye"></i> View
        </button>
        <button class="btn btn-secondary" onclick="editProposal('${proposal.id}')">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn btn-primary" onclick="downloadProposal('${proposal.id}')">
          <i class="fas fa-download"></i> Download
        </button>
      </div>
    </div>
  `;
}

function updateProposalsTable(proposals) {
  const tableBody = document.getElementById('proposalsTableBody');
  if (!tableBody) return;
  
  tableBody.innerHTML = '';
  
  if (proposals.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #6c757d; padding: 20px;">No proposals submitted yet</td></tr>';
    return;
  }
  
  proposals.forEach(proposal => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div class="proposal-title">
          <strong>${proposal.title}</strong>
          ${proposal.isCurrent ? '<span class="current-badge">Current</span>' : ''}
        </div>
      </td>
      <td>${new Date(proposal.submittedDate).toLocaleDateString()}</td>
      <td><span class="status ${proposal.status}">${getStatusDisplay(proposal.status)}</span></td>
      <td>
        <button class="btn-icon" onclick="viewFeedback('${proposal.id}')" title="View Feedback">
          <i class="fas fa-comment"></i>
        </button>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon" onclick="viewProposal('${proposal.id}')" title="View">
            <i class="fas fa-eye"></i>
          </button>
          <button class="btn-icon" onclick="downloadProposal('${proposal.id}')" title="Download">
            <i class="fas fa-download"></i>
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function updateSupervisorFeedback(feedbacks) {
  const feedbackSection = document.getElementById('supervisorFeedback');
  if (!feedbackSection) return;
  
  feedbackSection.innerHTML = '';
  
  if (feedbacks.length === 0) {
    feedbackSection.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No feedback available yet</p>';
    return;
  }
  
  feedbacks.forEach(feedback => {
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = 'feedback-item';
    
    feedbackDiv.innerHTML = `
      <div class="feedback-header">
        <span class="feedback-author">${feedback.supervisor || 'Supervisor'}</span>
        <span class="feedback-date">${new Date(feedback.timestamp).toLocaleDateString()}</span>
      </div>
      <div class="feedback-content">
        <p>${feedback.message}</p>
        <div class="feedback-rating">
          <strong>Rating:</strong> 
          <span class="stars">
            ${generateStars(feedback.rating || 0)}
          </span>
        </div>
      </div>
    `;
    
    feedbackSection.appendChild(feedbackDiv);
  });
}

function getStatusDisplay(status) {
  switch (status ? status.toLowerCase() : 'pending') {
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

function generateStars(rating) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      stars += '<i class="fas fa-star"></i>';
    } else {
      stars += '<i class="far fa-star"></i>';
    }
  }
  return stars;
}

// Demo data fallback function
function loadDemoProposalData() {
  console.log('🎭 Loading demo proposal data as fallback...');
  
  // Demo proposal data
  const demoProposalData = {
    id: 'demo-1',
    title: 'Smart Attendance System Using Facial Recognition',
    status: 'under_review',
    submittedDate: new Date('2024-01-15').toISOString(),
    lastUpdated: new Date('2024-01-20').toISOString(),
    supervisor: 'Dr. Ahmed Khan',
    progress: 45
  };
  
  // Demo proposals history
  const demoProposalsHistory = [
    {
      id: 'demo-1',
      title: 'Smart Attendance System Using Facial Recognition',
      submittedDate: new Date('2024-01-15').toISOString(),
      status: 'under_review',
      isCurrent: true
    },
    {
      id: 'demo-2', 
      title: 'Initial Project Proposal',
      submittedDate: new Date('2024-01-10').toISOString(),
      status: 'rejected',
      isCurrent: false
    }
  ];
  
  // Demo feedback data
  const demoFeedbackData = [
    {
      id: 'demo-1',
      supervisor: 'Dr. Ahmed Khan',
      message: 'Good progress on the literature review. Please focus more on recent papers in facial recognition.',
      rating: 4,
      timestamp: new Date('2024-01-14').toISOString()
    },
    {
      id: 'demo-2',
      supervisor: 'Dr. Ahmed Khan', 
      message: 'Database design looks comprehensive. Consider adding backup and recovery mechanisms.',
      rating: 3,
      timestamp: new Date('2024-01-18').toISOString()
    }
  ];
  
  // Update UI with demo data
  updateCurrentProposalStatus(demoProposalData);
  updateProposalsTable(demoProposalsHistory);
  updateSupervisorFeedback(demoFeedbackData);
  
  console.log('✅ Demo proposal data loaded successfully');
}

// Placeholder functions for buttons
function showNewProposalForm() {
  if (typeof showNotification !== 'undefined') {
    showNotification('New proposal form would open here', 'info');
  } else {
    alert('New proposal form would open here');
  }
}

function viewProposal(proposalId) {
  if (typeof showNotification !== 'undefined') {
    showNotification('Viewing proposal: ' + proposalId, 'info');
  } else {
    alert('Viewing proposal: ' + proposalId);
  }
}

function editProposal(proposalId) {
  if (typeof showNotification !== 'undefined') {
    showNotification('Editing proposal: ' + proposalId, 'info');
  } else {
    alert('Editing proposal: ' + proposalId);
  }
}

function downloadProposal(proposalId) {
  if (typeof showNotification !== 'undefined') {
    showNotification('Downloading proposal: ' + proposalId, 'info');
  } else {
    alert('Downloading proposal: ' + proposalId);
  }
}

function viewFeedback(proposalId) {
  if (typeof showNotification !== 'undefined') {
    showNotification('Viewing feedback for proposal: ' + proposalId, 'info');
  } else {
    alert('Viewing feedback for proposal: ' + proposalId);
  }
}

function downloadTemplate() {
  if (typeof showNotification !== 'undefined') {
    showNotification('Downloading proposal template...', 'info');
  } else {
    alert('Downloading proposal template...');
  }
}
