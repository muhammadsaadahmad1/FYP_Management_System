// Focused proposal data loader for dashboard only
console.log('📋 Dashboard proposal loader initialized');

// Load proposal data when page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('🔍 Checking for dashboard proposal section...');
  
  // Only run if we're on the dashboard and the proposal section exists
  const proposalStatusElement = document.getElementById('proposalStatus');
  if (proposalStatusElement) {
    console.log('✅ Dashboard proposal section found, loading data...');
    
    // Wait for Firebase to be ready, then load proposal data
    setTimeout(() => {
      loadDashboardProposalData();
    }, 1500);
  } else {
    console.log('ℹ️ Not on dashboard page or proposal section not found');
  }
});

async function loadDashboardProposalData() {
  console.log('🔄 Loading dashboard proposal data from Firebase...');
  
  try {
    // Check if Firebase is ready
    if (typeof auth === 'undefined' || typeof db === 'undefined') {
      console.log('⚠️ Firebase not ready, waiting...');
      setTimeout(() => loadDashboardProposalData(), 2000);
      return;
    }

    // Check if user is authenticated
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No user authenticated');
      return;
    }

    console.log('✅ User authenticated:', user.email);

    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.role !== 'student') {
      console.log('❌ User is not a student');
      return;
    }

    const groupId = userData.groupId || user.uid;
    console.log('📋 Loading current proposal for group:', groupId);

    // Load current proposal only
    const currentProposal = await loadCurrentProposalForDashboard(groupId);

    // Update only the proposal status section
    updateDashboardProposalStatus(currentProposal);

    console.log('✅ Dashboard proposal data loaded successfully!');

  } catch (error) {
    console.error('❌ Error loading dashboard proposal data:', error);
    console.log('📊 Showing empty proposal state');
    updateDashboardProposalStatus(null);
  }
}

async function loadCurrentProposalForDashboard(groupId) {
  try {
    console.log('🔍 Querying proposals for groupId:', groupId);
    
    // First, let's check what's in the proposals collection
    const allProposalsSnapshot = await db.collection('proposals')
      .limit(5) // Just get first 5 proposals to see structure
      .get();
    
    console.log('📊 Total proposals in database:', allProposalsSnapshot.size);
    
    if (!allProposalsSnapshot.empty) {
      console.log('🔍 Sample proposals structure:');
      allProposalsSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`Proposal ${index + 1}:`, {
          id: doc.id,
          title: data.title,
          groupId: data.groupId,
          isCurrent: data.isCurrent,
          status: data.status
        });
      });
    }
    
    // Now query for specific group
    const proposalsSnapshot = await db.collection('proposals')
      .where('groupId', '==', groupId)
      .limit(10) // Get all proposals for this group, will filter in code
      .get();
    
    console.log('📊 Found', proposalsSnapshot.size, 'proposals for group:', groupId);
    
    if (!proposalsSnapshot.empty) {
      console.log('🔍 Checking each proposal for isCurrent:');
      // Find the current proposal (isCurrent: true) from the results
      const currentProposal = proposalsSnapshot.docs.find(doc => {
        const data = doc.data();
        console.log('🔍 Checking proposal:', data.title, 'groupId:', data.groupId, 'isCurrent:', data.isCurrent);
        return data.isCurrent === true;
      });
      
      if (currentProposal) {
        const proposalData = {
          id: currentProposal.id,
          ...currentProposal.data()
        };
        console.log('✅ Current proposal found:', proposalData.title);
        console.log('📊 Full proposal data:', proposalData);
        return proposalData;
      } else {
        console.log('⚠️ No current proposal (isCurrent: true) found, using first proposal');
        const proposalData = {
          id: proposalsSnapshot.docs[0].id,
          ...proposalsSnapshot.docs[0].data()
        };
        console.log('✅ Using first proposal:', proposalData.title);
        console.log('📊 Full proposal data:', proposalData);
        return proposalData;
      }
    }
    
    console.log('❌ No proposals found for groupId:', groupId);
    console.log('💡 Suggestions:');
    console.log('1. Check if proposals exist in Firebase Console');
    console.log('2. Verify groupId matches:', groupId);
    console.log('3. Check if proposals have isCurrent: true');
    
    return null;
  } catch (error) {
    console.error('Error loading current proposal for dashboard:', error);
    return null;
  }
}

function updateDashboardProposalStatus(proposalData) {
  const proposalStatusElement = document.getElementById('proposalStatus');
  if (!proposalStatusElement) {
    console.log('❌ Proposal status element not found');
    return;
  }
  
  if (!proposalData) {
    console.log('📊 Showing "No Proposal Submitted" state');
    proposalStatusElement.innerHTML = `
      <div class="no-proposal-status">
        <i class="fas fa-file-alt"></i>
        <h4>No Proposal Submitted</h4>
        <p>You haven't submitted any proposal yet.</p>
        <button class="btn btn-primary" onclick="window.location.href='proposals.html'">Submit Proposal</button>
      </div>
    `;
    return;
  }
  
  const statusClass = proposalData.status ? proposalData.status.toLowerCase() : 'pending';
  const statusDisplay = getStatusDisplay(proposalData.status);
  
  console.log('🎨 Updating proposal UI with data:', proposalData.title, 'status:', statusDisplay);
  
  proposalStatusElement.innerHTML = `
    <div class="proposal-status-details">
      <div class="status-header">
        <h4>${proposalData.title || 'Untitled Proposal'}</h4>
        <span class="status-badge ${statusClass}">${statusDisplay}</span>
      </div>
      <div class="status-info">
        <p><strong>Submitted:</strong> ${new Date(proposalData.submittedDate).toLocaleDateString()}</p>
        <p><strong>Last Updated:</strong> ${new Date(proposalData.lastUpdated).toLocaleDateString()}</p>
        ${proposalData.supervisor ? `<p><strong>Supervisor:</strong> ${proposalData.supervisor}</p>` : ''}
      </div>
      <div class="status-progress">
        <p><strong>Review Progress:</strong></p>
        <div class="progress-bar">
          <div class="progress" style="width: ${proposalData.progress || 0}%"></div>
        </div>
        <span class="progress-text">${proposalData.progress || 0}%</span>
      </div>
      <div class="status-actions">
        <button class="btn btn-secondary" onclick="window.location.href='proposals.html'">
          <i class="fas fa-eye"></i> View Details
        </button>
      </div>
    </div>
  `;
  
  console.log('✅ Dashboard proposal status updated successfully');
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
