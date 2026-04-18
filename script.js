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
    console.log('=== Starting Dashboard Data Loading ===');
    
    // Check if Firebase is properly initialized
    const db = window.firebaseServices ? window.firebaseServices.db : firebase.firestore();
    if (!db) {
        console.error('Firebase database (db) is not defined');
        showNotification('Firebase not initialized. Please refresh the page.', 'error');
        return;
    }
    
    console.log('Firebase database initialized successfully');
    console.log('Firebase services available:', !!window.firebaseServices);
    console.log('Firestore available:', typeof firebase.firestore !== 'undefined');
    
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
            console.log('loadAllDashboardData: About to call updateMeetingTable');
            updateMeetingTable();
            console.log('loadAllDashboardData: updateMeetingTable completed');
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
    const taskTableDiv = document.querySelector('.task-table');
    if (!taskTableDiv) return;
    
    const groupId = localStorage.getItem('groupId');
    const db = window.firebaseServices ? window.firebaseServices.db : firebase.firestore();
    
    console.log('updateTaskAssignments: Fetching tasks for groupId:', groupId);
    
    db.collection('tasks').where('groupId', '==', groupId).get()
        .then(tasksSnapshot => {
            let tasks = [];
            if (!tasksSnapshot.empty) {
                tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            
            if (tasks.length === 0) {
                taskTableDiv.innerHTML = `
                    <div style="text-align: center; padding: 30px; color: #6c757d;">
                        <i class="fas fa-tasks" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                        <p style="font-size: 16px; margin-bottom: 10px;">No tasks assigned</p>
                        <p style="font-size: 14px;">Tasks will appear here when assigned by supervisor</p>
                    </div>
                `;
                return;
            }
            
            const tableHTML = `
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6;">Task Title</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6;">Assigned To</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6;">Status</th>
                            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6;">Due Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tasks.map(task => `
                            <tr style="border-bottom: 1px solid #dee2e6;">
                                <td style="padding: 12px;">
                                    <strong>${task.title || 'Untitled Task'}</strong>
                                    <div style="font-size: 12px; color: #6c757d; margin-top: 4px;">
                                        ${task.description || 'No description'}
                                    </div>
                                </td>
                                <td style="padding: 12px;">${task.assignedTo || 'Unassigned'}</td>
                                <td style="padding: 12px;">
                                    <span style="background: ${getStatusColor(task.status)}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                        ${task.status || 'Pending'}
                                    </span>
                                </td>
                                <td style="padding: 12px;">${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            
            taskTableDiv.innerHTML = tableHTML;
        })
        .catch(error => {
            console.error('Error loading tasks:', error);
            taskTableDiv.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 20px;">Error loading tasks</p>';
        });
}

// BULLETPROOF: Update files section with maximum error protection and retry
function updateFileUploads(members) {
    console.log('=== BULLETPROOF updateFileUploads Starting ===');
    
    const fileTableDiv = document.querySelector('.file-table');
    if (!fileTableDiv) {
        console.error('updateFileUploads: file-table element not found');
        return;
    }
    
    const groupId = localStorage.getItem('groupId');
    if (!groupId) {
        console.error('updateFileUploads: No groupId found');
        fileTableDiv.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 20px;">No group ID found</p>';
        return;
    }
    
    // BULLETPROOF: Retry mechanism for Firebase connection
    const loadFilesWithRetry = async (retryCount = 3) => {
        for (let attempt = 1; attempt <= retryCount; attempt++) {
            try {
                console.log(`updateFileUploads: Attempt ${attempt}/${retryCount}`);
                
                // BULLETPROOF: Get Firebase connection with fallback
                const db = window.firebaseServices ? window.firebaseServices.db : firebase.firestore();
                if (!db) {
                    throw new Error('Firebase database not available');
                }
                
                console.log('updateFileUploads: Firebase available, fetching files for groupId:', groupId);
                
                const filesSnapshot = await db.collection('files')
                    .where('groupId', '==', groupId)
                    .orderBy('uploadDate', 'desc')
                    .limit(5)
                    .get();
                
                console.log('updateFileUploads: Found', filesSnapshot.docs.length, 'file documents');
                
                let files = [];
                if (!filesSnapshot.empty) {
                    files = filesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    console.log('updateFileUploads: Processed files:', files);
                }
                
                // BULLETPROOF: Always show something
                if (files.length === 0) {
                    console.log('updateFileUploads: No files found, showing empty state');
                    fileTableDiv.innerHTML = `
                        <div style="text-align: center; padding: 30px; color: #6c757d;">
                            <i class="fas fa-file-upload" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                            <p style="font-size: 16px; margin-bottom: 10px;">No files uploaded</p>
                            <p style="font-size: 14px;">Upload project files using the Upload Report button</p>
                        </div>
                    `;
                } else {
                    displayFiles(files, fileTableDiv);
                }
                
                console.log('updateFileUploads: SUCCESS');
                return; // Success, exit retry loop
                
            } catch (error) {
                console.error(`updateFileUploads: Attempt ${attempt} failed:`, error);
                
                if (attempt === retryCount) {
                    // Final attempt failed, show error
                    console.error('updateFileUploads: All retry attempts failed');
                    fileTableDiv.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 20px;">Error loading files</p>';
                } else {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }
    };
    
    // Start the retry process
    loadFilesWithRetry();
}

// Helper function to display files
function displayFiles(files, fileTableDiv) {
    try {
            
        const tableHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6;">File Name</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6;">Uploaded By</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6;">Date</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6;">Size</th>
                    </tr>
                </thead>
                <tbody>
                    ${files.map(file => `
                        <tr style="border-bottom: 1px solid #dee2e6;">
                            <td style="padding: 12px;">
                                <i class="fas fa-file-${getFileIcon(file.name)}" style="margin-right: 8px; color: #6c757d;"></i>
                                ${file.name}
                            </td>
                            <td style="padding: 12px;">${file.uploadedBy || 'Unknown'}</td>
                            <td style="padding: 12px;">${new Date(file.uploadDate).toLocaleDateString()}</td>
                            <td style="padding: 12px;">${formatFileSize(file.size || 0)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        fileTableDiv.innerHTML = tableHTML;
        console.log('updateFileUploads: Files displayed successfully');
    } catch (error) {
        console.error('updateFileUploads: Error displaying files:', error);
        fileTableDiv.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 20px;">Error displaying files</p>';
    }
}

// BULLETPROOF: Update meetings section with maximum error protection and retry
function updateMeetingTable() {
    console.log('=== BULLETPROOF updateMeetingTable Starting ===');
    
    const meetingTableDiv = document.getElementById('meetingTable');
    if (!meetingTableDiv) {
        console.error('updateMeetingTable: meetingTable element not found');
        return;
    }
    
    const groupId = localStorage.getItem('groupId');
    if (!groupId) {
        console.error('updateMeetingTable: No groupId found');
        meetingTableDiv.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 20px;">No group ID found</p>';
        return;
    }
    
    // BULLETPROOF: Retry mechanism for Firebase connection
    const loadMeetingsWithRetry = async (retryCount = 3) => {
        for (let attempt = 1; attempt <= retryCount; attempt++) {
            try {
                console.log(`updateMeetingTable: Attempt ${attempt}/${retryCount}`);
                
                // BULLETPROOF: Get Firebase connection with fallback
                const db = window.firebaseServices ? window.firebaseServices.db : firebase.firestore();
                if (!db) {
                    throw new Error('Firebase database not available');
                }
                
                console.log('updateMeetingTable: Firebase available, fetching meetings for groupId:', groupId);
                
                const meetingsSnapshot = await db.collection('meetings')
                    .where('groupId', '==', groupId)
                    .orderBy('date', 'desc')
                    .limit(5)
                    .get();
                
                console.log('updateMeetingTable: Found', meetingsSnapshot.docs.length, 'meeting documents');
                
                let meetings = [];
                if (!meetingsSnapshot.empty) {
                    meetings = meetingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    console.log('updateMeetingTable: Processed meetings:', meetings);
                }
                
                // BULLETPROOF: Always show something
                if (meetings.length === 0) {
                    console.log('updateMeetingTable: No meetings found, showing empty state');
                    meetingTableDiv.innerHTML = `
                        <div style="text-align: center; padding: 30px; color: #6c757d;">
                            <i class="fas fa-calendar" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                            <p style="font-size: 16px; margin-bottom: 10px;">No meetings scheduled</p>
                            <p style="font-size: 14px;">Request meetings using the Request Meeting button</p>
                        </div>
                    `;
                } else {
                    displayMeetings(meetings, meetingTableDiv);
                }
                
                console.log('updateMeetingTable: SUCCESS');
                return; // Success, exit retry loop
                
            } catch (error) {
                console.error(`updateMeetingTable: Attempt ${attempt} failed:`, error);
                
                if (attempt === retryCount) {
                    // Final attempt failed, show error
                    console.error('updateMeetingTable: All retry attempts failed');
                    meetingTableDiv.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 20px;">Error loading meetings</p>';
                } else {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }
    };
    
    // Start the retry process
    loadMeetingsWithRetry();
}

// Helper function to display meetings
function displayMeetings(meetings, meetingTableDiv) {
    try {
        console.log('updateMeetingTable: Displaying', meetings.length, 'meetings');
        
        const tableHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6;">Date</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6;">Type</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6;">Status</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6;">Location</th>
                    </tr>
                </thead>
                <tbody>
                    ${meetings.map(meeting => `
                        <tr style="border-bottom: 1px solid #dee2e6;">
                            <td style="padding: 12px;">${new Date(meeting.date).toLocaleDateString()}</td>
                            <td style="padding: 12px;">${meeting.type || 'General Meeting'}</td>
                            <td style="padding: 12px;">
                                <span style="background: ${getStatusColor(meeting.status)}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                    ${meeting.status || 'Scheduled'}
                                </span>
                            </td>
                            <td style="padding: 12px;">${meeting.location || 'Online'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        meetingTableDiv.innerHTML = tableHTML;
        console.log('updateMeetingTable: Meetings displayed successfully');
    } catch (error) {
        console.error('updateMeetingTable: Error displaying meetings:', error);
        meetingTableDiv.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 20px;">Error displaying meetings</p>';
    }
}

// BULLETPROOF: Update feedback section with maximum error protection and retry
function updateSupervisorFeedback() {
    console.log('=== BULLETPROOF updateSupervisorFeedback Starting ===');
    
    const feedbackDiv = document.querySelector('.feedback-list');
    if (!feedbackDiv) {
        console.error('updateSupervisorFeedback: feedback-list element not found');
        return;
    }
    
    const groupId = localStorage.getItem('groupId');
    if (!groupId) {
        console.error('updateSupervisorFeedback: No groupId found');
        feedbackDiv.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 20px;">No group ID found</p>';
        return;
    }
    
    // BULLETPROOF: Retry mechanism for Firebase connection
    const loadFeedbackWithRetry = async (retryCount = 3) => {
        for (let attempt = 1; attempt <= retryCount; attempt++) {
            try {
                console.log(`updateSupervisorFeedback: Attempt ${attempt}/${retryCount}`);
                
                // BULLETPROOF: Get Firebase connection with fallback
                const db = window.firebaseServices ? window.firebaseServices.db : firebase.firestore();
                if (!db) {
                    throw new Error('Firebase database not available');
                }
                
                console.log('updateSupervisorFeedback: Firebase available, fetching feedback for groupId:', groupId);
                
                const feedbackSnapshot = await db.collection('feedback')
                    .where('groupId', '==', groupId)
                    .orderBy('timestamp', 'desc')
                    .limit(3)
                    .get();
                
                console.log('updateSupervisorFeedback: Found', feedbackSnapshot.docs.length, 'feedback documents');
                
                let feedbacks = [];
                if (!feedbackSnapshot.empty) {
                    feedbacks = feedbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    console.log('updateSupervisorFeedback: Processed feedbacks:', feedbacks);
                }
                
                // BULLETPROOF: Always show something
                if (feedbacks.length === 0) {
                    console.log('updateSupervisorFeedback: No feedback found, showing empty state');
                    feedbackDiv.innerHTML = `
                        <div style="text-align: center; padding: 30px; color: #6c757d;">
                            <i class="fas fa-comments" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                            <p style="font-size: 16px; margin-bottom: 10px;">No feedback yet</p>
                            <p style="font-size: 14px;">Supervisor feedback will appear here</p>
                        </div>
                    `;
                } else {
                    displayFeedback(feedbacks, feedbackDiv);
                }
                
                console.log('updateSupervisorFeedback: SUCCESS');
                return; // Success, exit retry loop
                
            } catch (error) {
                console.error(`updateSupervisorFeedback: Attempt ${attempt} failed:`, error);
                
                if (attempt === retryCount) {
                    // Final attempt failed, show error
                    console.error('updateSupervisorFeedback: All retry attempts failed');
                    feedbackDiv.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 20px;">Error loading feedback</p>';
                } else {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }
    };
    
    // Start the retry process
    loadFeedbackWithRetry();
}

// Helper function to display feedback
function displayFeedback(feedbacks, feedbackDiv) {
    try {
        feedbackDiv.innerHTML = feedbacks.map(feedback => `
            <div style="background: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin-bottom: 15px; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="color: #007bff;">${feedback.supervisor || 'Supervisor'}</strong>
                    <span style="font-size: 12px; color: #6c757d;">${new Date(feedback.timestamp).toLocaleDateString()}</span>
                </div>
                <p style="margin: 0; color: #333;">${feedback.message || 'No message'}</p>
                ${feedback.type ? `<div style="margin-top: 8px;"><span style="background: #e9ecef; color: #495057; padding: 2px 6px; border-radius: 3px; font-size: 11px;">${feedback.type}</span></div>` : ''}
            </div>
        `).join('');
        
        console.log('updateSupervisorFeedback: Feedback displayed successfully');
    } catch (error) {
        console.error('updateSupervisorFeedback: Error displaying feedback:', error);
        feedbackDiv.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 20px;">Error displaying feedback</p>';
    }
}

function updateAnnouncements() {
    const announcementsDiv = document.querySelector('.announcements');
    if (!announcementsDiv) return;
    
    const db = window.firebaseServices ? window.firebaseServices.db : firebase.firestore();
    
    console.log('updateAnnouncements: Fetching announcements');
    
    db.collection('announcements').orderBy('date', 'desc').limit(5).get()
        .then(announcementsSnapshot => {
            console.log('updateAnnouncements: Found', announcementsSnapshot.docs.length, 'announcement documents');
            let announcements = [];
            if (!announcementsSnapshot.empty) {
                announcements = announcementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log('updateAnnouncements: Processed announcements:', announcements);
            }
            
            if (announcements.length === 0) {
                console.log('updateAnnouncements: No announcements found, showing empty state');
                announcementsDiv.innerHTML = `
                    <div style="text-align: center; padding: 30px; color: #6c757d;">
                        <i class="fas fa-bullhorn" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                        <p style="font-size: 16px; margin-bottom: 10px;">No announcements</p>
                        <p style="font-size: 14px;">Important announcements will appear here</p>
                    </div>
                `;
                return;
            }
            
            announcementsDiv.innerHTML = announcements.map(announcement => `
                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 15px; border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="color: #856404;">${announcement.title || 'Announcement'}</strong>
                        <span style="font-size: 12px; color: #856404;">${new Date(announcement.date).toLocaleDateString()}</span>
                    </div>
                    <p style="margin: 0; color: #856404;">${announcement.message || 'No message'}</p>
                    ${announcement.priority ? `<div style="margin-top: 8px;"><span style="background: #ffc107; color: #000; padding: 2px 6px; border-radius: 3px; font-size: 11px;">${announcement.priority}</span></div>` : ''}
                </div>
            `).join('');
        })
        .catch(error => {
            console.error('Error loading announcements:', error);
            announcementsDiv.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 20px;">Error loading announcements</p>';
        });
}

function updateNotificationCount() {
    console.log('Updating notification count');
    // Implementation would go here
}

// Utility functions
function showNotification(message, type) {
    console.log('Notification:', message, type);
    
    // Create notification element if it doesn't exist
    let notificationDiv = document.getElementById('notification');
    if (!notificationDiv) {
        notificationDiv = document.createElement('div');
        notificationDiv.id = 'notification';
        notificationDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 9999;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(notificationDiv);
    }
    
    // Set notification style based on type
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    notificationDiv.style.background = colors[type] || colors.info;
    notificationDiv.textContent = message;
    notificationDiv.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        notificationDiv.style.display = 'none';
    }, 3000);
}

function getStatusColor(status) {
    const colors = {
        'completed': '#10b981',
        'in-progress': '#3b82f6',
        'pending': '#f59e0b',
        'overdue': '#ef4444',
        'cancelled': '#6b7280',
        'scheduled': '#10b981',
        'approved': '#10b981',
        'rejected': '#ef4444'
    };
    return colors[status] || '#6b7280';
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        'pdf': 'pdf',
        'doc': 'word',
        'docx': 'word',
        'ppt': 'powerpoint',
        'pptx': 'powerpoint',
        'txt': 'alt',
        'zip': 'archive',
        'rar': 'archive',
        'jpg': 'image',
        'jpeg': 'image',
        'png': 'image',
        'gif': 'image'
    };
    return icons[ext] || 'alt';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Action Handlers
function handleFileUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.doc,.docx,.ppt,.pptx,.txt,.zip,.rar';
    
    input.onchange = function(e) {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            uploadFiles(files);
        }
    };
    
    input.click();
}

async function uploadFiles(files) {
    const groupId = localStorage.getItem('groupId');
    const userId = localStorage.getItem('uid');
    
    if (!groupId || !userId) {
        showNotification('Authentication error. Please login again.', 'error');
        return;
    }
    
    for (const file of files) {
        try {
            showLoadingOverlay(`Uploading ${file.name}...`);
            
            // Upload file to Firebase Storage
            const storageRef = firebase.storage().ref();
            const fileRef = storageRef.child(`groups/${groupId}/${file.name}`);
            
            await fileRef.put(file);
            const downloadURL = await fileRef.getDownloadURL();
            
            // Save file metadata to Firestore
            const fileData = {
                name: file.name,
                size: file.size,
                type: file.type,
                downloadURL: downloadURL,
                groupId: groupId,
                uploadedBy: userId,
                uploadDate: new Date().toISOString()
            };
            
            await firebase.firestore().collection('files').add(fileData);
            
            showNotification(`${file.name} uploaded successfully!`, 'success');
            
        } catch (error) {
            console.error('Error uploading file:', error);
            showNotification(`Error uploading ${file.name}: ${error.message}`, 'error');
        }
    }
    
    hideLoadingOverlay();
    // Refresh files display
    updateFileUploads();
}

function handleMeetingRequest() {
    const formHtml = `
        <div id="meetingRequestModal" class="modal" style="display: block;">
            <div class="modal-content" style="max-width: 500px; margin: 50px auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0;">Request Meeting</h3>
                    <span onclick="closeMeetingModal()" style="cursor: pointer; font-size: 24px; color: #6c757d;">&times;</span>
                </div>
                <div class="modal-body">
                    <form id="meetingRequestForm">
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Meeting Type *</label>
                            <select name="type" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                <option value="">Select meeting type</option>
                                <option value="progress">Progress Review</option>
                                <option value="technical">Technical Discussion</option>
                                <option value="milestone">Milestone Review</option>
                                <option value="emergency">Emergency Meeting</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Preferred Date *</label>
                            <input type="date" name="date" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Purpose/Agenda *</label>
                            <textarea name="purpose" rows="4" required placeholder="Describe the purpose of this meeting..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></textarea>
                        </div>
                        <div style="display: flex; gap: 10px; justify-content: flex-end;">
                            <button type="button" onclick="closeMeetingModal()" style="padding: 8px 16px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer;">Cancel</button>
                            <button type="submit" style="padding: 8px 16px; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer;">Submit Request</button>
                        </div>
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

function closeMeetingModal() {
    const modal = document.getElementById('meetingRequestModal');
    if (modal) {
        modal.remove();
    }
}

function showNotifications() {
    showNotification('Notification center coming soon!', 'info');
}

function showNewTaskForm() {
    showNotification('Task creation coming soon!', 'info');
}

function showLoadingOverlay(message) {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;
        document.body.appendChild(overlay);
    }
    
    overlay.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 8px; text-align: center;">
            <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
            <p style="margin: 0; color: #333;">${message || 'Loading...'}</p>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    
    overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

document.addEventListener('submit', function(e) {
    if (e.target.id === 'meetingRequestForm') {
        e.preventDefault();
        submitMeetingRequest(e.target);
    }
});

async function submitMeetingRequest(form) {
    const formData = new FormData(form);
    const groupId = localStorage.getItem('groupId');
    const userId = localStorage.getItem('uid');
    
    try {
        showLoadingOverlay('Submitting meeting request...');
        
        const meetingData = {
            type: formData.get('type'),
            date: new Date(formData.get('date')).toISOString(),
            purpose: formData.get('purpose'),
            groupId: groupId,
            requestedBy: userId,
            requestedDate: new Date().toISOString(),
            status: 'pending',
            location: 'To be determined'
        };
        
        await firebase.firestore().collection('meetings').add(meetingData);
        
        hideLoadingOverlay();
        closeMeetingModal();
        showNotification('Meeting request submitted successfully!', 'success');
        
        // Refresh meetings display
        updateMeetingTable();
        
    } catch (error) {
        hideLoadingOverlay();
        console.error('Error submitting meeting request:', error);
        showNotification('Error submitting meeting request. Please try again.', 'error');
    }
}

console.log('Script loaded successfully');

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
