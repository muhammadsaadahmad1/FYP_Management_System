// Simple demo data loader for proposals page
console.log('🎭 Loading demo proposal data...');

// Load demo data when page loads
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(loadDemoProposalData, 1000);
});

function loadDemoProposalData() {
  console.log('📊 Loading demo proposal data...');
  
  // Demo proposal data
  const demoProposalData = {
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
      id: '1',
      title: 'Smart Attendance System Using Facial Recognition',
      submittedDate: new Date('2024-01-15').toISOString(),
      status: 'under_review',
      isCurrent: true
    },
    {
      id: '2', 
      title: 'Initial Project Proposal',
      submittedDate: new Date('2024-01-10').toISOString(),
      status: 'rejected',
      isCurrent: false
    }
  ];
  
  // Demo feedback data
  const demoFeedbackData = [
    {
      id: '1',
      supervisor: 'Dr. Ahmed Khan',
      message: 'Good progress on the literature review. Please focus more on recent papers in facial recognition.',
      rating: 4,
      timestamp: new Date('2024-01-14').toISOString()
    },
    {
      id: '2',
      supervisor: 'Dr. Ahmed Khan', 
      message: 'Database design looks comprehensive. Consider adding backup and recovery mechanisms.',
      rating: 3,
      timestamp: new Date('2024-01-18').toISOString()
    }
  ];
  
  // Update current proposal status
  updateCurrentProposalStatus(demoProposalData);
  
  // Update proposals table
  updateProposalsTable(demoProposalsHistory);
  
  // Update supervisor feedback
  updateSupervisorFeedback(demoFeedbackData);
  
  console.log('✅ Demo proposal data loaded successfully!');
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

// Placeholder functions for buttons
function showNewProposalForm() {
  alert('New proposal form would open here');
}

function viewProposal(proposalId) {
  alert('Viewing proposal: ' + proposalId);
}

function editProposal(proposalId) {
  alert('Editing proposal: ' + proposalId);
}

function downloadProposal(proposalId) {
  alert('Downloading proposal: ' + proposalId);
}

function viewFeedback(proposalId) {
  alert('Viewing feedback for proposal: ' + proposalId);
}

function downloadTemplate() {
  alert('Downloading proposal template...');
}
