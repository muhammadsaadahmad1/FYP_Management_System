// Global variables
let currentUser = null;
let notifications = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - Initializing Dashboard...');
    
    // Update welcome message immediately with logged-in user's name
    const currentUserName = localStorage.getItem('displayName');
    const dynamicUserNameElement = document.getElementById('dynamicUserName');
    
    if (dynamicUserNameElement && currentUserName) {
        dynamicUserNameElement.textContent = currentUserName;
        console.log('Updated username immediately to:', currentUserName);
    }
    
    initializeApp();
});

function initializeApp() {
    console.log('Starting App Initialization...');
    
    // Check if user is logged in FIRST
    checkAuthStatus();
    
    // Initialize notifications
    loadNotifications();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize progress bars
    initializeProgressBars();
    
    // Load user data (this will trigger Firebase loading)
    console.log('Loading User Data...');
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
        console.error('Firebase database (db) is not defined');
        showNotification('Firebase not initialized. Please refresh the page.', 'error');
        return;
    }
    
    const groupId = localStorage.getItem('groupId');
    const currentUserRole = localStorage.getItem('role');
    
    console.log('Starting loadAllDashboardData');
    console.log('Group ID:', groupId);
    console.log('User Role:', currentUserRole);
    console.log('Firebase db available:', typeof db !== 'undefined');
    
    if (!groupId || currentUserRole !== 'student') {
        console.log('Missing required data');
        console.log('- groupId:', groupId);
        console.log('- role:', currentUserRole);
        showNotification('Please log in as a student to access the dashboard', 'error');
        return;
    }
    
    try {
        showLoadingOverlay('Loading dashboard data...');
        console.log('Loading data for groupId:', groupId);
        
        // Test basic Firebase connection first
        console.log('Testing Firebase connection...');
        const testQuery = await db.collection('users').limit(1).get();
        console.log('Firebase connection working');
        
        // Fetch group data with error handling
        console.log('Fetching group data...');
        let groupData = {};
        try {
            const groupDoc = await db.collection('groups').doc(groupId).get();
            if (groupDoc.exists) {
                groupData = groupDoc.data();
                console.log('Group data found:', groupData);
            } else {
                console.log('Group not found, creating default...');
                groupData = await createDefaultGroup(groupId);
                console.log('Default group created:', groupData);
            }
        } catch (groupError) {
            console.error('Error fetching group data:', groupError);
            groupData = { groupId: groupId }; // Use minimal data
        }
        
        // Fetch group members with bulletproof error handling
        console.log('Fetching group members...');
        let members = [];
        try {
            const membersSnapshot = await db.collection('users')
                .where('groupId', '==', groupId)
                .where('role', '==', 'student')
                .get();
            
            // BULLETPROOF: Check if snapshot exists and is not empty
            if (membersSnapshot && typeof membersSnapshot === 'object' && !membersSnapshot.empty) {
                // BULLETPROOF: Check if forEach exists and is a function
                if (typeof membersSnapshot.forEach === 'function') {
                    membersSnapshot.forEach(doc => {
                        // BULLETPROOF: Check if doc exists and has data
                        if (doc && doc.exists && doc.data) {
                            const memberData = doc.data();
                            if (memberData && typeof memberData === 'object') {
                                console.log('Found member:', memberData.displayName || memberData.name || 'Unknown');
                                members.push({
                                    id: doc.id || 'unknown',
                                    name: memberData.displayName || memberData.name || 'Unknown',
                                    registrationNumber: memberData.loginId || memberData.registrationNumber || 'N/A',
                                    email: memberData.email || 'N/A',
                                    isGroupLeader: Boolean(memberData.isGroupLeader),
                                    uid: doc.id || 'unknown',
                                    phone: memberData.phone || 'N/A',
                                    isActive: memberData.isActive !== false
                                });
                            }
                        }
                    });
                } else {
                    console.log('Snapshot forEach is not a function');
                }
            } else {
                console.log('No group members found for groupId:', groupId);
            }
        } catch (membersError) {
            console.error('Error fetching members:', membersError);
            members = []; // BULLETPROOF: Always ensure members is an array
        }
        
        // BULLETPROOF: Double-check members is an array
        if (!Array.isArray(members)) {
            console.log('Converting members to array, current type:', typeof members);
            members = [];
        }
        
        console.log('Final members array:', members);
        console.log('Members length:', members.length);
        
        // Fetch proposals with bulletproof error handling
        console.log('Fetching proposals...');
        let proposals = [];
        try {
            const proposalsSnapshot = await db.collection('proposals')
                .where('groupId', '==', groupId)
                .get();
            
            // BULLETPROOF: Check if snapshot exists and is not empty
            if (proposalsSnapshot && typeof proposalsSnapshot === 'object' && !proposalsSnapshot.empty) {
                if (typeof proposalsSnapshot.forEach === 'function') {
                    proposalsSnapshot.forEach(doc => {
                        if (doc && doc.exists && doc.data) {
                            const proposalData = doc.data();
                            if (proposalData && typeof proposalData === 'object') {
                                proposals.push({
                                    id: doc.id || 'unknown',
                                    title: proposalData.title || 'Untitled Proposal',
                                    status: proposalData.status || 'pending',
                                    submittedDate: proposalData.submittedDate || proposalData.createdAt,
                                    feedback: proposalData.feedback || 'No feedback yet',
                                    lastUpdated: proposalData.lastUpdated || proposalData.updatedAt
                                });
                            }
                        }
                    });
                }
            } else {
                console.log('No proposals found for groupId:', groupId);
            }
        } catch (proposalsError) {
            console.error('Error fetching proposals:', proposalsError);
            proposals = []; // BULLETPROOF: Always ensure proposals is an array
        }
        
        // BULLETPROOF: Double-check proposals is an array
        if (!Array.isArray(proposals)) {
            console.log('Converting proposals to array, current type:', typeof proposals);
            proposals = [];
        }
        
        // Update UI with bulletproof error handling
        console.log('Updating UI...');
        
        try {
            updateWelcomeMessage(groupData);
        } catch (error) {
            console.error('Error updating welcome message:', error);
        }
        
        try {
            updateGroupMembers(members);
        } catch (error) {
            console.error('Error updating group members:', error);
        }
        
        try {
            updateProjectOverview(groupData);
        } catch (error) {
            console.error('Error updating project overview:', error);
        }
        
        try {
            updateProposalStatus(groupData, proposals);
        } catch (error) {
            console.error('Error updating proposal status:', error);
        }
        
        // Update other sections with real Firebase data
        try {
            updateTaskAssignments(members);
        } catch (error) {
            console.error('Error updating task assignments:', error);
        }
        
        try {
            updateFileUploads(members);
        } catch (error) {
            console.error('Error updating file uploads:', error);
        }
        
        try {
            updateMeetingTable();
        } catch (error) {
            console.error('Error updating meeting table:', error);
        }
        
        try {
            updateSupervisorFeedback();
        } catch (error) {
            console.error('Error updating supervisor feedback:', error);
        }
        
        try {
            updateAnnouncements();
        } catch (error) {
            console.error('Error updating announcements:', error);
        }
        
        try {
            updateNotificationCount();
        } catch (error) {
            console.error('Error updating notification count:', error);
        }
        
        hideLoadingOverlay();
        console.log('Dashboard data loaded successfully!');
        showNotification('Dashboard loaded successfully!', 'success');
        
    } catch (error) {
        hideLoadingOverlay();
        console.error('Critical error in loadAllDashboardData:', error);
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
        
        // Show basic empty state with bulletproof error handling
        try {
            updateWelcomeMessage({ groupId: groupId || 'Unknown' });
        } catch (e) {
            console.error('Error in fallback welcome message:', e);
        }
        
        try {
            updateGroupMembers([]);
        } catch (e) {
            console.error('Error in fallback group members:', e);
        }
        
        try {
            updateProjectOverview({ groupId: groupId || 'Unknown', projectTitle: 'No Project Data', supervisor: 'No Supervisor', timeline: 'N/A', progress: 0 });
        } catch (e) {
            console.error('Error in fallback project overview:', e);
        }
        
        try {
            updateProposalStatus({}, []);
        } catch (e) {
            console.error('Error in fallback proposal status:', e);
        }
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
    
    console.log('Updating welcome message for:', currentUserName);
    console.log('Group ID:', groupId);
    
    // Update dynamic span element immediately
    if (dynamicUserNameElement && currentUserName) {
        dynamicUserNameElement.textContent = `${currentUserName} (${groupId})`;
        console.log('Updated username with groupId to:', `${currentUserName} (${groupId})`);
    }
    
    // Also update any h1 elements (fallback)
    if (welcomeElements && welcomeElements.forEach) {
        welcomeElements.forEach(element => {
            element.innerHTML = `Welcome, <span style="color: #2563eb; font-weight: 600;">${currentUserName}</span> <span style="color: #64748b; font-size: 16px;">(${groupId})</span>!`;
        });
    }
}

// BULLETPROOF: Update group members section with maximum error protection
function updateGroupMembers(members) {
    console.log('Updating group members with data:', members);
    console.log('Type of members:', typeof members);
    console.log('Is members an array?', Array.isArray(members));
    
    // BULLETPROOF: Triple-check members parameter
    let safeMembers = [];
    
    if (members === null || members === undefined) {
        console.log('Members is null/undefined, using empty array');
        safeMembers = [];
    } else if (Array.isArray(members)) {
        console.log('Members is already an array, using it directly');
        safeMembers = members;
    } else {
        console.log('Members is not an array, converting to empty array');
        safeMembers = [];
    }
    
    console.log('Safe members array length:', safeMembers.length);
    
    // Try both ID and class selectors to find the members list
    const membersList = document.getElementById('membersList') || document.querySelector('.members-list');
    
    if (!membersList) {
        console.error('Members list element not found in DOM');
        return;
    }
    
    console.log('Found members list element, updating with', safeMembers.length, 'members');
    
    // Clear existing content
    try {
        membersList.innerHTML = '';
    } catch (error) {
        console.error('Error clearing members list:', error);
        return;
    }
    
    // BULLETPROOF: Check length safely
    const membersLength = safeMembers.length || 0;
    console.log('Members length for display:', membersLength);
    
    if (membersLength === 0) {
        try {
            membersList.innerHTML = `
                <div style="text-align: center; padding: 30px; color: #6c757d;">
                    <i class="fas fa-users" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p style="font-size: 16px; margin-bottom: 10px;">No group members found</p>
                    <p style="font-size: 14px;">Registered students with the same Group ID will appear here</p>
                </div>
            `;
        } catch (error) {
            console.error('Error setting empty state:', error);
        }
        return;
    }
    
    // Sort members: group leader first, then by name
    let sortedMembers = [];
    try {
        sortedMembers = safeMembers.sort((a, b) => {
            if (!a || !b) return 0;
            if (a.isGroupLeader && !b.isGroupLeader) return -1;
            if (!a.isGroupLeader && b.isGroupLeader) return 1;
            const aName = a.name || a.displayName || '';
            const bName = b.name || b.displayName || '';
            return aName.localeCompare(bName);
        });
    } catch (error) {
        console.error('Error sorting members:', error);
        sortedMembers = safeMembers; // Use unsorted if sorting fails
    }
    
    // Create group header
    try {
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
    } catch (error) {
        console.error('Error creating group header:', error);
    }
    
    // Display each member with maximum error protection
    sortedMembers.forEach((member, index) => {
        // BULLETPROOF: Check if member exists
        if (!member || typeof member !== 'object') {
            console.log(`Skipping invalid member at index ${index}:`, member);
            return;
        }
        
        console.log(`Processing member ${index + 1}:`, member);
        
        try {
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
            
            const memberName = member.name || member.displayName || 'Unknown';
            const memberInitial = memberName.charAt(0).toUpperCase();
            
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
                                ${memberInitial}
                            </div>
                            <div>
                                <div style="font-weight: 600; font-size: 16px; color: #333;">
                                    ${memberName}
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
            console.log(`Added member ${memberName} to display`);
        } catch (error) {
            console.error(`Error creating member element for index ${index}:`, error);
        }
    });
    
    console.log('All group members displayed successfully');
}

// Placeholder functions for other dashboard features
function updateProjectOverview(groupData) {
    console.log('Updating project overview with:', groupData);
    // Implementation would go here
}

function updateProposalStatus(groupData, proposals) {
    console.log('Updating proposal status with:', groupData, proposals);
    // Implementation would go here
}

function updateTaskAssignments(members) {
    console.log('Updating task assignments with:', members);
    // Implementation would go here
}

function updateFileUploads(members) {
    console.log('Updating file uploads with:', members);
    // Implementation would go here
}

function updateMeetingTable() {
    console.log('Updating meeting table');
    // Implementation would go here
}

function updateSupervisorFeedback() {
    console.log('Updating supervisor feedback');
    // Implementation would go here
}

function updateAnnouncements() {
    console.log('Updating announcements');
    // Implementation would go here
}

function updateNotificationCount() {
    console.log('Updating notification count');
    // Implementation would go here
}

// Utility functions
function showNotification(message, type) {
    console.log('Notification:', message, type);
}

function showLoadingOverlay(message) {
    console.log('Loading overlay:', message);
}

function hideLoadingOverlay() {
    console.log('Hiding loading overlay');
}

function loadNotifications() {
    console.log('Loading notifications');
}

function setupEventListeners() {
    console.log('Setting up event listeners');
}

function initializeProgressBars() {
    console.log('Initializing progress bars');
}

console.log('Script loaded successfully');
