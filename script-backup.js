// Global variables
let currentUser = null;
let notifications = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Content Loaded - Initializing Dashboard...');
    
    // Update welcome message immediately with logged-in user's name
    const currentUserName = localStorage.getItem('displayName');
    const dynamicUserNameElement = document.getElementById('dynamicUserName');
    
    if (dynamicUserNameElement && currentUserName) {
        dynamicUserNameElement.textContent = currentUserName;
        console.log('✅ Updated username immediately to:', currentUserName);
    }
    
    initializeApp();
});

function initializeApp() {
    console.log('📋 Starting App Initialization...');
    
    // Check if user is logged in FIRST
    checkAuthStatus();
    
    // Initialize notifications
    loadNotifications();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize progress bars
    initializeProgressBars();
    
    // Load user data (this will trigger Firebase loading)
    console.log('🔄 Loading User Data...');
    loadUserData();
}

// Authentication check
function checkAuthStatus() {
    const role = localStorage.getItem('role');
    const displayName = localStorage.getItem('displayName');
    
    if (!role || !displayName) {
        // Redirect to login if not authenticated
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = {
        role: role,
        username: displayName
    };
}

// Load user data
function loadUserData() {
    // Load group data based on logged-in user
    loadGroupData();
}

// Load all dashboard data
async function loadAllDashboardData() {
    // Check if Firebase is properly initialized
    if (typeof db === 'undefined') {
        console.error('❌ Firebase database (db) is not defined');
        showNotification('Firebase not initialized. Please refresh the page.', 'error');
        return;
    }
    
    const groupId = localStorage.getItem('groupId');
    const currentUserRole = localStorage.getItem('role');
    
    console.log('🚀 Starting loadAllDashboardData');
    console.log('📋 Group ID:', groupId);
    console.log('👤 User Role:', currentUserRole);
    console.log('🔥 Firebase db available:', typeof db !== 'undefined');
    
    if (!groupId || currentUserRole !== 'student') {
        console.log('❌ Missing required data');
        console.log('- groupId:', groupId);
        console.log('- role:', currentUserRole);
        showNotification('Please log in as a student to access the dashboard', 'error');
        return;
    }
    
    try {
        showLoadingOverlay('Loading dashboard data...');
        console.log('🔄 Loading data for groupId:', groupId);
        
        // Test basic Firebase connection first
        console.log('🔍 Testing Firebase connection...');
        const testQuery = await db.collection('users').limit(1).get();
        console.log('✅ Firebase connection working');
        
        // Fetch group data with error handling
        console.log('📊 Fetching group data...');
        let groupData = {};
        try {
            const groupDoc = await db.collection('groups').doc(groupId).get();
            if (groupDoc.exists) {
                groupData = groupDoc.data();
                console.log('✅ Group data found:', groupData);
            } else {
                console.log('📝 Group not found, creating default...');
                groupData = await createDefaultGroup(groupId);
                console.log('✅ Default group created:', groupData);
            }
        } catch (groupError) {
            console.error('🔥 Error fetching group data:', groupError);
            groupData = { groupId: groupId }; // Use minimal data
        }
        
        // Fetch group members with error handling
        console.log('Fetching group members...');
        let members = [];
        try {
            const membersSnapshot = await db.collection('users')
                .where('groupId', '==', groupId)
                .where('role', '==', 'student')
                .get();
            
            if (membersSnapshot && !membersSnapshot.empty) {
                membersSnapshot.forEach(doc => {
                    if (doc && doc.exists) {
                        const memberData = doc.data();
                        if (memberData) {
                            console.log('Found member:', memberData.displayName || memberData.name);
                            members.push({
                                id: doc.id,
                                name: memberData.displayName || memberData.name || 'Unknown',
                                registrationNumber: memberData.loginId || memberData.registrationNumber || 'N/A',
                                email: memberData.email || 'N/A',
                                isGroupLeader: memberData.isGroupLeader || false,
                                uid: doc.id,
                                phone: memberData.phone || 'N/A',
                                isActive: memberData.isActive !== false
                            });
                        }
                    }
                });
                console.log(`Found ${members.length} group members`);
            } else {
                console.log('No group members found for groupId:', groupId);
            }
        } catch (membersError) {
            console.error('Error fetching members:', membersError);
            members = []; // Ensure members is always an array
        }
        
        // Fetch proposals with error handling
        console.log('Fetching proposals...');
        let proposals = [];
        try {
            const proposalsSnapshot = await db.collection('proposals')
                .where('groupId', '==', groupId)
                .get();
            
            if (proposalsSnapshot && !proposalsSnapshot.empty) {
                proposalsSnapshot.forEach(doc => {
                    if (doc && doc.exists) {
                        const proposalData = doc.data();
                        if (proposalData) {
                            proposals.push({
                                id: doc.id,
                                title: proposalData.title || 'Untitled Proposal',
                                status: proposalData.status || 'pending',
                                submittedDate: proposalData.submittedDate || proposalData.createdAt,
                                feedback: proposalData.feedback || 'No feedback yet',
                                lastUpdated: proposalData.lastUpdated || proposalData.updatedAt
                            });
                        }
                    }
                });
                console.log(`Found ${proposals.length} proposals`);
            } else {
                console.log('No proposals found for groupId:', groupId);
            }
        } catch (proposalsError) {
            console.error('Error fetching proposals:', proposalsError);
            proposals = []; // Ensure proposals is always an array
        }
        
        // Update UI with whatever data we have
        console.log('🎨 Updating UI...');
        updateWelcomeMessage(groupData);
        updateGroupMembers(members);
        updateProjectOverview(groupData);
        updateProposalStatus(groupData, proposals);
        
        // Update other sections with real Firebase data
        updateTaskAssignments(members);
        updateFileUploads(members);
        updateMeetingTable();
        updateSupervisorFeedback();
        updateAnnouncements();
        updateNotificationCount();
        
        hideLoadingOverlay();
        console.log('✅ Dashboard data loaded successfully!');
        showNotification('Dashboard loaded successfully!', 'success');
        
    } catch (error) {
        hideLoadingOverlay();
        console.error('🔥 Critical error in loadAllDashboardData:', error);
        console.error('Error details:', error.code, error.message);
        
        // Show user-friendly error message
        let errorMessage = 'Error loading dashboard data';
        
        if (error.message.includes('permission-denied')) {
            errorMessage = 'Permission denied. Please check your Firebase security rules.';
        } else if (error.message.includes('index')) {
            errorMessage = 'Database index required. Please check Firebase console.';
        } else if (error.message.includes('network')) {
            errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.message.includes('db is not defined') || error.message.includes('db is not found')) {
            errorMessage = 'Firebase not initialized. Please refresh the page.';
        } else {
            errorMessage = `Dashboard Error: ${error.message}`;
        }
        
        showNotification(errorMessage, 'error');
        
        // Show basic empty state
        updateWelcomeMessage({ groupId: groupId || 'Unknown' });
        updateGroupMembers([]);
        updateProjectOverview({ groupId: groupId || 'Unknown', projectTitle: 'No Project Data', supervisor: 'No Supervisor', timeline: 'N/A', progress: 0 });
        updateProposalStatus({}, []);
    }
}

// Load group data dynamically
async function loadGroupData() {
    await loadAllDashboardData();
}

// Create default group if it doesn't exist
async function createDefaultGroup(groupId) {
    try {
        const defaultGroupData = {
            groupId: groupId,
            groupName: `FYP Group ${groupId}`,
            projectTitle: 'AI-Based Healthcare System',
            supervisor: 'Dr. Ahmed Hassan',
            timeline: '6 Months',
            progress: 0,
            members: [],
            tasks: [],
            files: []
        };
        
        await firebase.firestore().collection('groups').doc(groupId).set(defaultGroupData);
        console.log('Created default group for:', groupId);
        
        return defaultGroupData;
    } catch (error) {
        console.error('Error creating default group:', error);
        return null;
    }
}

// Update welcome message to show logged-in user specifically with groupId
function updateWelcomeMessage(groupData) {
    const welcomeElements = document.querySelectorAll('.welcome-section h1');
    const dynamicUserNameElement = document.getElementById('dynamicUserName');
    const currentUserName = localStorage.getItem('displayName');
    const groupId = groupData.groupId || localStorage.getItem('groupId');
    
    console.log('👋 Updating welcome message for:', currentUserName);
    console.log('🔢 Group ID:', groupId);
    
    // Update dynamic span element immediately
    if (dynamicUserNameElement && currentUserName) {
        dynamicUserNameElement.textContent = `${currentUserName} (${groupId})`;
        console.log('✅ Updated username with groupId to:', `${currentUserName} (${groupId})`);
    }
    
    // Also update any h1 elements (fallback)
    welcomeElements.forEach(element => {
        element.innerHTML = `Welcome, <span style="color: #2563eb; font-weight: 600;">${currentUserName}</span> <span style="color: #64748b; font-size: 16px;">(${groupId})</span>!`;
    });
}

// Update group members section with real registered members
function updateGroupMembers(members) {
    console.log('Updating group members with data:', members);
    
    // Ensure members is always an array
    const membersArray = Array.isArray(members) ? members : [];
    
    // Try both ID and class selectors to find the members list
    const membersList = document.getElementById('membersList') || document.querySelector('.members-list');
    
    if (!membersList) {
        console.error('Members list element not found in DOM');
        return;
    }
    
    console.log('Found members list element, updating with', membersArray.length, 'members');
    
    // Clear existing content
    membersList.innerHTML = '';
    
    if (membersArray.length === 0) {
        membersList.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #6c757d;">
                <i class="fas fa-users" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                <p style="font-size: 16px; margin-bottom: 10px;">No group members found</p>
                <p style="font-size: 14px;">Registered students with the same Group ID will appear here</p>
            </div>
        `;
        return;
    }
    
    // Sort members: group leader first, then by name
    const sortedMembers = membersArray.sort((a, b) => {
        if (a.isGroupLeader && !b.isGroupLeader) return -1;
        if (!a.isGroupLeader && b.isGroupLeader) return 1;
        return (a.name || a.displayName || '').localeCompare(b.name || b.displayName || '');
    });
    
    // Create group header
    const groupHeader = document.createElement('div');
    groupHeader.className = 'group-header';
    groupHeader.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 15px;
        text-align: center;
    `;
    groupHeader.innerHTML = `
        <h4 style="margin: 0; font-size: 16px;">
            <i class="fas fa-users"></i> Group Members (${sortedMembers.length})
        </h4>
        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">
            Your FYP Team
        </p>
    `;
    membersList.appendChild(groupHeader);
    
    // Display each member
    sortedMembers.forEach((member, index) => {
        // Ensure member object exists and has required properties
        if (!member) return;
        
        console.log(`Processing member ${index + 1}:`, member);
        
        const memberDiv = document.createElement('div');
        memberDiv.className = `member ${member.isGroupLeader ? 'leader' : ''}`;
        memberDiv.style.cssText = `
            background: ${member.isGroupLeader ? '#f8f9fa' : 'white'};
            border: 2px solid ${member.isGroupLeader ? '#28a745' : '#e9ecef'};
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 10px;
            position: relative;
            transition: all 0.3s ease;
        `;
        
        const leaderBadge = member.isGroupLeader ? 
            `<span style="background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                <i class="fas fa-crown"></i> Group Leader
            </span>` : '';
        
        const statusBadge = member.isActive ? 
            `<span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">
                Active
            </span>` : 
            `<span style="background: #dc3545; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px;">
                Inactive
            </span>`;
        
        memberDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin-right: 12px;">
                            ${(member.name || member.displayName || 'Unknown').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight: 600; font-size: 16px; color: #333;">
                                ${member.name || member.displayName || 'Unknown'}
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                                ${leaderBadge}
                                ${statusBadge}
                            </div>
                        </div>
                    </div>
                    <div style="margin-left: 52px; color: #666; font-size: 14px;">
                        <div style="margin-bottom: 3px;">
                            <i class="fas fa-id-card" style="width: 16px;"></i>
                            <strong>ID:</strong> ${member.registrationNumber || member.loginId || 'N/A'}
                        </div>
                        <div style="margin-bottom: 3px;">
                            <i class="fas fa-envelope" style="width: 16px;"></i>
                            <strong>Email:</strong> ${member.email || 'N/A'}
                        </div>
                        ${member.phone && member.phone !== 'N/A' ? `
                        <div style="margin-bottom: 3px;">
                            <i class="fas fa-phone" style="width: 16px;"></i>
                            <strong>Phone:</strong> ${member.phone}
                        </div>
                        ` : ''}
                        <div style="margin-bottom: 3px;">
                            <i class="fas fa-user-tag" style="width: 16px;"></i>
                            <strong>UID:</strong> ${member.uid || member.id || 'N/A'}
                        </div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="color: #999; font-size: 12px; margin-bottom: 5px;">
                        Member #${index + 1}
                    </div>
                    ${member.isGroupLeader ? 
                        `<i class="fas fa-crown" style="color: #ffc107; font-size: 20px;"></i>` : 
                        `<i class="fas fa-user" style="color: #6c757d; font-size: 20px;"></i>`
                    }
                </div>
            </div>
        `;
        
        // Add hover effect
        memberDiv.addEventListener('mouseenter', () => {
            memberDiv.style.transform = 'translateY(-2px)';
            memberDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        });
        
        memberDiv.addEventListener('mouseleave', () => {
            memberDiv.style.transform = 'translateY(0)';
            memberDiv.style.boxShadow = 'none';
        });
        
        membersList.appendChild(memberDiv);
        console.log(`Added member ${member.name || member.displayName} to display`);
    });
    
    console.log('All group members displayed successfully');
}

// Update project overview with real Firebase data
function updateProjectOverview(groupData) {
    const projectInfo = document.querySelector('.project-info');
    if (!projectInfo) return;
    
    // Get real project data from Firebase
    const groupId = groupData.groupId || localStorage.getItem('groupId');
    
    // Fetch real project data from projects collection
    db.collection('projects').where('groupId', '==', groupId).get()
        .then(projectsSnapshot => {
            let projectData = null;
            let supervisorData = null;
            
            if (!projectsSnapshot.empty) {
                projectData = projectsSnapshot.docs[0].data();
                console.log('✅ Real project data found:', projectData);
                
                // Fetch supervisor data
                if (projectData.supervisorId) {
                    return db.collection('users').doc(projectData.supervisorId).get();
                }
            }
            return Promise.resolve(null);
        })
        .then(supervisorDoc => {
            if (supervisorDoc && supervisorDoc.exists) {
                supervisorData = supervisorDoc.data();
                console.log('✅ Real supervisor data found:', supervisorData);
            }
            
            // Calculate real progress based on project milestones
            const progress = calculateProjectProgress(projectData);
            
            // Update UI with real data
            projectInfo.innerHTML = `
                <div class="info-row">
                    <span class="label">Group ID:</span>
                    <span class="value">${groupId || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="label">Project:</span>
                    <span class="value">${projectData ? (projectData.title || projectData.projectTitle || 'Untitled Project') : 'No Project Assigned'}</span>
                </div>
                <div class="info-row">
                    <span class="label">Category:</span>
                    <span class="value">${projectData ? (projectData.category || projectData.domain || 'N/A') : 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="label">Supervisor:</span>
                    <span class="value">${supervisorData ? (supervisorData.displayName || supervisorData.name || 'Unknown') : 'No Supervisor Assigned'}</span>
                </div>
                <div class="info-row">
                    <span class="label">Timeline:</span>
                    <span class="value">${projectData ? (projectData.timeline || projectData.deadline || 'N/A') : 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="label">Group Progress:</span>
                    <div class="progress-bar">
                        <div class="progress" style="width: ${progress}%"></div>
                    </div>
                    <span class="progress-text">${progress}%</span>
                </div>
                <div class="info-row">
                    <span class="label">Last Updated:</span>
                    <span class="value">${projectData ? (new Date(projectData.lastUpdated || projectData.createdAt).toLocaleDateString()) : 'N/A'}</span>
                </div>
            `;
        })
        .catch(error => {
            console.error('🔥 Error fetching real project data:', error);
            
            // Fallback to group data if project fetch fails
            const progress = groupData.progress || 0;
            projectInfo.innerHTML = `
                <div class="info-row">
                    <span class="label">Group ID:</span>
                    <span class="value">${groupId || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="label">Project:</span>
                    <span class="value">Loading project data...</span>
                </div>
                <div class="info-row">
                    <span class="label">Category:</span>
                    <span class="value">N/A</span>
                </div>
                <div class="info-row">
                    <span class="label">Supervisor:</span>
                    <span class="value">No Supervisor Assigned</span>
                </div>
                <div class="info-row">
                    <span class="label">Timeline:</span>
                    <span class="value">N/A</span>
                </div>
                <div class="info-row">
                    <span class="label">Group Progress:</span>
                    <div class="progress-bar">
                        <div class="progress" style="width: ${progress}%"></div>
                    </div>
                    <span class="progress-text">${progress}%</span>
                </div>
            `;
        });
}

// Calculate project progress based on milestones and tasks
function calculateProjectProgress(projectData) {
    if (!projectData) return 0;
    
    let progress = 0;
    
    // Check if project has milestones
    if (projectData.milestones && Array.isArray(projectData.milestones)) {
        const totalMilestones = projectData.milestones.length;
        const completedMilestones = projectData.milestones.filter(m => m.status === 'completed').length;
        progress = Math.round((completedMilestones / totalMilestones) * 100);
    }
    // Check if project has tasks
    else if (projectData.tasks && Array.isArray(projectData.tasks)) {
        const totalTasks = projectData.tasks.length;
        const completedTasks = projectData.tasks.filter(t => t.status === 'completed').length;
        progress = Math.round((completedTasks / totalTasks) * 100);
    }
    // Use progress field if available
    else if (projectData.progress !== undefined) {
        progress = Math.min(100, Math.max(0, parseInt(projectData.progress) || 0));
    }
    
    return progress;
}

// Update proposal status with real Firebase data
function updateProposalStatus(groupData, proposals) {
    const proposalStatus = document.querySelector('.proposal-status');
    if (!proposalStatus) return;
    
    const groupId = groupData.groupId || localStorage.getItem('groupId');
    
    // Fetch real proposal data from Firebase
    db.collection('proposals').where('groupId', '==', groupId).get()
        .then(proposalsSnapshot => {
            let latestProposal = null;
            
            if (!proposalsSnapshot.empty) {
                // Get the most recent proposal
                latestProposal = proposalsSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .sort((a, b) => new Date(b.submittedDate || b.createdAt) - new Date(a.submittedDate || a.createdAt))[0];
                
                console.log('✅ Real proposal data found:', latestProposal);
            }
            
            // Update UI with real data
            proposalStatus.innerHTML = `
                <div class="status-item">
                    <span class="status-label">Status:</span>
                    <span class="status-value">
                        <span class="status ${latestProposal ? (latestProposal.status || 'pending') : 'pending'}">${latestProposal ? (latestProposal.status || 'Pending') : 'No Proposal Submitted'}</span>
                    </span>
                </div>
                <div class="status-item">
                    <span class="status-label">Submitted Proposal:</span>
                    <span class="status-value">${latestProposal ? (latestProposal.title || 'Untitled Proposal') : 'Not Submitted'}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Feedback:</span>
                    <span class="status-value">${latestProposal ? (latestProposal.feedback || latestProposal.supervisorFeedback || 'No feedback yet') : 'No feedback yet'}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Last Updated:</span>
                    <span class="status-value">${latestProposal ? (new Date(latestProposal.lastUpdated || latestProposal.submittedDate || latestProposal.createdAt).toLocaleDateString()) : 'N/A'}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Submission Date:</span>
                    <span class="status-value">${latestProposal ? (new Date(latestProposal.submittedDate || latestProposal.createdAt).toLocaleDateString()) : 'N/A'}</span>
                </div>
            `;
        })
        .catch(error => {
            console.error('🔥 Error fetching real proposal data:', error);
            
            // Fallback to group data if proposal fetch fails
            proposalStatus.innerHTML = `
                <div class="status-item">
                    <span class="status-label">Status:</span>
                    <span class="status-value">
                        <span class="status ${groupData.proposalStatus || 'pending'}">${groupData.proposalStatus || 'Pending'}</span>
                    </span>
                </div>
                <div class="status-item">
                    <span class="status-label">Submitted Proposal:</span>
                    <span class="status-value">${groupData.proposalTitle || 'Not Submitted'}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Feedback:</span>
                    <span class="status-value">${groupData.proposalFeedback || 'No feedback yet'}</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Last Updated:</span>
                    <span class="status-value">${groupData.proposalLastUpdated || 'N/A'}</span>
                </div>
            `;
        });
}

// Update supervisor feedback
function updateSupervisorFeedback(feedbacks) {
    const feedbackList = document.querySelector('.feedback-list');
    if (!feedbackList) return;
    
    feedbackList.innerHTML = '';
    
    if (!feedbacks || feedbacks.length === 0) {
        feedbackList.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No feedback available</p>';
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
                ${feedback.message || 'No message'}
            </div>
        `;
        
        feedbackList.appendChild(feedbackDiv);
    });
}

// Update announcements
function updateAnnouncements(announcements) {
    const announcementsDiv = document.querySelector('.announcements');
    if (!announcementsDiv) return;
    
    announcementsDiv.innerHTML = '';
    
    if (!announcements || announcements.length === 0) {
        announcementsDiv.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No announcements available</p>';
        return;
    }
    
    announcements.forEach(announcement => {
        const announcementDiv = document.createElement('div');
        announcementDiv.className = 'announcement-item';
        
        announcementDiv.innerHTML = `
            <div class="announcement-title">${announcement.title || 'Announcement'}</div>
            <div class="announcement-content">${announcement.content || 'No content'}</div>
            <div class="announcement-date">${new Date(announcement.timestamp).toLocaleDateString()}</div>
        `;
        
        announcementsDiv.appendChild(announcementDiv);
    });
}

// Update notification count
function updateNotificationCount(count) {
    const notificationBadge = document.getElementById('notificationCount');
    if (notificationBadge) {
        notificationBadge.textContent = count || 0;
    }
}

// Update meeting table
function updateMeetingTable(meetings) {
    const meetingTableDiv = document.querySelector('.meeting-table');
    if (!meetingTableDiv) return;
    
    // Create table structure
    meetingTableDiv.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                <!-- Meetings will be dynamically loaded here -->
            </tbody>
        </table>
    `;
    
    const meetingTableBody = meetingTableDiv.querySelector('tbody');
    if (!meetingTableBody) return;
    
    if (meetings.length === 0) {
        meetingTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #6c757d; padding: 20px;">No meetings scheduled</td></tr>';
        return;
    }
    
    meetings.forEach(meeting => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(meeting.date).toLocaleDateString()}</td>
            <td>${meeting.type || 'General'}</td>
            <td><span class="status ${meeting.status.replace(' ', '-')}">${meeting.status}</span></td>
        `;
        meetingTableBody.appendChild(row);
    });
}

// Update file uploads with real Firebase data
function updateFileUploads(members, files) {
    const fileTableDiv = document.querySelector('.file-table');
    if (!fileTableDiv) return;
    
    const groupId = localStorage.getItem('groupId');
    
    // Fetch real file data from Firebase
    db.collection('files').where('groupId', '==', groupId).get()
        .then(filesSnapshot => {
            let realFiles = [];
            
            if (!filesSnapshot.empty) {
                realFiles = filesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log('✅ Real file data found:', realFiles);
            }
            
            // Create table structure
            fileTableDiv.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>File</th>
                            <th>Uploaded By</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Size</th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Files will be dynamically loaded here -->
                    </tbody>
                </table>
            `;
            
            const fileTableBody = fileTableDiv.querySelector('tbody');
            if (!fileTableBody) return;
            
            if (realFiles.length === 0) {
                fileTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #6c757d; padding: 20px;">No files uploaded yet</td></tr>';
                return;
            }
            
            realFiles.forEach(file => {
                const uploadedBy = members.find(m => m.id === file.uploadedBy);
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><i class="fas fa-file-${getFileIcon(file.name)}"></i> ${file.name}</td>
                    <td>${uploadedBy ? (uploadedBy.name || uploadedBy.displayName || 'Unknown') : 'Unknown'}</td>
                    <td>${new Date(file.uploadDate || file.date).toLocaleDateString()}</td>
                    <td><span class="status ${file.status || 'pending'}">${file.status || 'Pending'}</span></td>
                    <td>${file.size ? formatFileSize(file.size) : 'N/A'}</td>
                `;
                fileTableBody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('🔥 Error fetching real file data:', error);
            
            // Fallback to empty data if file fetch fails
            fileTableDiv.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>File</th>
                            <th>Uploaded By</th>
                            <th>Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colspan="4" style="text-align: center; color: #6c757d; padding: 20px;">Error loading files</td></tr>
                    </tbody>
                </table>
            `;
        });
}

// Format file size for display
function formatFileSize(bytes) {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(2);
    return size + ' ' + sizes[i];
}

// Update task assignments with real Firebase data
function updateTaskAssignments(members, tasks) {
    const taskTableDiv = document.querySelector('.task-table');
    if (!taskTableDiv) return;
    
    const groupId = localStorage.getItem('groupId');
    
    // Fetch real task data from Firebase
    db.collection('tasks').where('groupId', '==', groupId).get()
        .then(tasksSnapshot => {
            let realTasks = [];
            
            if (!tasksSnapshot.empty) {
                realTasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log('✅ Real task data found:', realTasks);
            }
            
            // Create table structure
            taskTableDiv.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Task</th>
                            <th>Assigned To</th>
                            <th>Status</th>
                            <th>Due Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Tasks will be dynamically loaded here -->
                    </tbody>
                </table>
            `;
            
            const taskTableBody = taskTableDiv.querySelector('tbody');
            if (!taskTableBody) return;
            
            if (realTasks.length === 0) {
                taskTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #6c757d; padding: 20px;">No tasks assigned yet</td></tr>';
                return;
            }
            
            realTasks.forEach(task => {
                const assignedMember = members.find(m => m.id === task.assignedTo);
                const taskRow = document.createElement('tr');
                taskRow.innerHTML = `
                    <td>${task.title || 'Untitled Task'}</td>
                    <td>${assignedMember ? (assignedMember.name || assignedMember.displayName || 'Unknown') : 'Unassigned'}</td>
                    <td><span class="status ${task.status || 'pending'}">${task.status || 'Pending'}</span></td>
                    <td>${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</td>
                `;
                taskTableBody.appendChild(taskRow);
            });
        })
        .catch(error => {
            console.error('🔥 Error fetching real task data:', error);
            
            // Fallback to empty data if task fetch fails
            taskTableDiv.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Task</th>
                            <th>Assigned To</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colspan="3" style="text-align: center; color: #6c757d; padding: 20px;">Error loading tasks</td></tr>
                    </tbody>
                </table>
            `;
        });
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        'pdf': 'pdf',
        'doc': 'word',
        'docx': 'word',
        'ppt': 'powerpoint',
        'pptx': 'powerpoint'
    };
    return icons[ext] || 'alt';
}

// Initialize progress bars
function initializeProgressBars() {
    const progressBars = document.querySelectorAll('.progress');
    progressBars.forEach(bar => {
        const width = bar.style.width;
        bar.style.width = '0%';
        setTimeout(() => {
            bar.style.width = width;
        }, 100);
    });
}

// Show notifications
function showNotifications() {
    const notificationList = notifications.map(notification => `
        <div class="notification-item ${notification.read ? 'read' : 'unread'}">
            <div class="notification-type ${notification.type}">
                <i class="fas fa-${getNotificationIcon(notification.type)}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${formatTime(notification.id)}</div>
            </div>
        </div>
    `).join('');
    
    showNotificationModal(notificationList);
}

function getNotificationIcon(type) {
    const icons = {
        'info': 'info-circle',
        'warning': 'exclamation-triangle',
        'success': 'check-circle',
        'error': 'times-circle'
    };
    return icons[type] || 'info-circle';
}

function formatTime(id) {
    // Simulate time formatting
    const times = ['2 hours ago', '5 hours ago', '1 day ago'];
    return times[id - 1] || 'Just now';
}

function showNotificationModal(content) {
    const modalHtml = `
        <div id="notificationModal" class="modal" style="display: block;">
            <div class="modal-content notification-modal">
                <div class="modal-header">
                    <h3>Notifications</h3>
                    <span class="close" onclick="closeNotificationModal()">&times;</span>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeNotificationModal() {
    const modal = document.getElementById('notificationModal');
    if (modal) {
        modal.remove();
    }
}

// Handle file upload
function handleFileUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.doc,.docx,.ppt,.pptx,.txt';
    
    input.onchange = function(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            uploadFile(file);
        });
    };
    
    input.click();
}

function uploadFile(file) {
    // Simulate file upload
    showLoadingOverlay('Uploading ' + file.name + '...');
    
    setTimeout(() => {
        hideLoadingOverlay();
        showNotification('File uploaded successfully!', 'success');
        
        // Reload dashboard data to show new file
        loadAllDashboardData();
    }, 2000);
}

// Handle meeting request
function handleMeetingRequest() {
    showMeetingRequestForm();
}

function showMeetingRequestForm() {
    const formHtml = `
        <div id="meetingRequestModal" class="modal" style="display: block;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Request Meeting</h3>
                    <span class="close" onclick="closeMeetingRequestModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="meetingRequestForm">
                        <div class="form-group">
                            <label>Meeting Type</label>
                            <select name="type" required>
                                <option value="">Select meeting type</option>
                                <option value="progress">Progress Review</option>
                                <option value="technical">Technical Discussion</option>
                                <option value="emergency">Emergency Meeting</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Preferred Date</label>
                            <input type="date" name="date" required>
                        </div>
                        <div class="form-group">
                            <label>Preferred Time</label>
                            <input type="time" name="time" required>
                        </div>
                        <div class="form-group">
                            <label>Purpose/Agenda</label>
                            <textarea name="purpose" rows="4" placeholder="Describe the purpose of this meeting..." required></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary">Submit Request</button>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', formHtml);
    
    // Set minimum date to today
    const dateInput = document.querySelector('input[name="date"]');
    if (dateInput) {
        dateInput.min = new Date().toISOString().split('T')[0];
    }
}

function closeMeetingRequestModal() {
    const modal = document.getElementById('meetingRequestModal');
    if (modal) {
        modal.remove();
    }
}

// Show new task form
function showNewTaskForm() {
    showNotification('New task form feature coming soon!', 'info');
}

// Handle form submissions
function handleFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    if (form.id === 'meetingRequestForm') {
        submitMeetingRequest(formData);
    } else if (form.classList.contains('meeting-form')) {
        submitMeetingRequest(formData);
    }
}

function submitMeetingRequest(formData) {
    showLoadingOverlay('Submitting meeting request...');
    
    setTimeout(() => {
        hideLoadingOverlay();
        closeMeetingRequestModal();
        showNotification('Meeting request submitted successfully!', 'success');
        
        // Reload dashboard data
        loadAllDashboardData();
    }, 1500);
}

// Handle navigation
function handleNavigation(e) {
    e.preventDefault();
    const href = e.currentTarget.getAttribute('href');
    
    // Add transition effect
    document.body.style.opacity = '0.8';
    
    setTimeout(() => {
        window.location.href = href;
    }, 200);
}

// Handle logout
function handleLogout(e) {
    e.preventDefault();
    
    if (confirm('Are you sure you want to logout?')) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Add form submission listener
    document.addEventListener('submit', handleFormSubmit);
    
    // Add navigation listeners
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', handleNavigation);
    });
    
    // Add logout listener
    document.querySelectorAll('.nav-item.logout').forEach(item => {
        item.addEventListener('click', handleLogout);
    });
}

// Load notifications
function loadNotifications() {
    // Simulate loading notifications
    notifications = [
        {
            id: 1,
            type: 'info',
            message: 'New announcement from supervisor',
            read: false
        },
        {
            id: 2,
            type: 'success',
            message: 'Your proposal has been approved',
            read: false
        },
        {
            id: 3,
            type: 'warning',
            message: 'Meeting scheduled for tomorrow',
            read: true
        }
    ];
}

// Utility functions
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `toast-notification ${type}`;
    notification.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function showLoadingOverlay(message = 'Loading...') {
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <div class="loading-message">${message}</div>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.remove();
    }
}

// Add CSS for dynamic elements
const dynamicStyles = `
    .toast-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        padding: 15px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
        z-index: 10000;
        min-width: 300px;
        animation: slideIn 0.3s ease;
    }

    .toast-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .toast-close {
        background: none;
        border: none;
        cursor: pointer;
        color: #6c757d;
        padding: 5px;
    }

    .toast-notification.success {
        border-left: 4px solid #28a745;
    }

    .toast-notification.info {
        border-left: 4px solid #17a2b8;
    }

    .toast-notification.warning {
        border-left: 4px solid #ffc107;
    }

    .toast-notification.error {
        border-left: 4px solid #dc3545;
    }

    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }

    .loading-spinner {
        background: white;
        border-radius: 8px;
        padding: 30px;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }

    .spinner {
        border: 3px solid #f3f3f3;
        border-top: 3px solid #667eea;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 0 auto 15px;
    }

    .loading-message {
        color: #2c3e50;
        font-weight: 500;
    }

    .notification-modal {
        max-width: 400px;
    }

    .notification-item {
        display: flex;
        align-items: flex-start;
        gap: 15px;
        padding: 15px;
        border-bottom: 1px solid #e9ecef;
        cursor: pointer;
        transition: background 0.3s ease;
    }

    .notification-item:hover {
        background: #f8f9fa;
    }

    .notification-item.unread {
        background: #f8f9ff;
    }

    .notification-type {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 0.9rem;
    }

    .notification-type.info {
        background: #17a2b8;
    }

    .notification-type.success {
        background: #28a745;
    }

    .notification-type.warning {
        background: #ffc107;
    }

    .notification-type.error {
        background: #dc3545;
    }

    .notification-content {
        flex: 1;
    }

    .notification-message {
        color: #2c3e50;
        margin-bottom: 5px;
    }

    .notification-time {
        color: #7f8c8d;
        font-size: 0.85rem;
    }

    .modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    }

    .modal-content {
        background: white;
        border-radius: 8px;
        padding: 20px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }

    .modal-header h3 {
        margin: 0;
    }

    .close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #6c757d;
    }

    .form-group {
        margin-bottom: 15px;
    }

    .form-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: 600;
        color: #374151;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
        width: 100%;
        padding: 10px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
    }

    .form-group textarea {
        resize: vertical;
        min-height: 100px;
    }

    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;

// Add dynamic styles to the document
const styleSheet = document.createElement('style');
styleSheet.textContent = dynamicStyles;
document.head.appendChild(styleSheet);

// Export functions for use in HTML files
window.showNotificationModal = showNotificationModal;
window.closeNotificationModal = closeNotificationModal;
window.showMeetingRequestForm = showMeetingRequestForm;
window.closeMeetingRequestModal = closeMeetingRequestModal;
window.handleFileUpload = handleFileUpload;
window.handleMeetingRequest = handleMeetingRequest;
window.showNewTaskForm = showNewTaskForm;
window.showNotifications = showNotifications;
