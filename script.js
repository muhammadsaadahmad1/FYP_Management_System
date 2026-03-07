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
    const groupId = localStorage.getItem('groupId');
    const currentUserRole = localStorage.getItem('role');
    
    if (!groupId || currentUserRole !== 'student') {
        console.log('Missing groupId or not student role');
        return;
    }
    
    try {
        showLoadingOverlay('Loading dashboard data...');
        
        // Fetch group data
        const groupDoc = await firebase.firestore().collection('groups').doc(groupId).get();
        let groupData = {};
        
        if (groupDoc.exists) {
            groupData = groupDoc.data();
        } else {
            // Create default group if it doesn't exist
            groupData = await createDefaultGroup(groupId);
        }
        
        // Fetch group members
        const membersSnapshot = await firebase.firestore()
            .collection('users')
            .where('groupId', '==', groupId)
            .where('role', '==', 'student')
            .get();
        
        const members = [];
        membersSnapshot.forEach(doc => {
            const memberData = doc.data();
            members.push({
                id: doc.id,
                name: memberData.displayName || memberData.name || 'Unknown',
                registrationNumber: memberData.loginId || memberData.registrationNumber || 'N/A',
                email: memberData.email || 'N/A',
                isGroupLeader: memberData.isGroupLeader || false
            });
        });
        
        // Fetch tasks
        const tasksSnapshot = await firebase.firestore()
            .collection('tasks')
            .where('groupId', '==', groupId)
            .get();
        
        const tasks = [];
        tasksSnapshot.forEach(doc => {
            const taskData = doc.data();
            tasks.push({
                id: doc.id,
                title: taskData.title,
                assignedTo: taskData.assignedTo,
                status: taskData.status
            });
        });
        
        // Fetch files
        const filesSnapshot = await firebase.firestore()
            .collection('files')
            .where('groupId', '==', groupId)
            .get();
        
        const files = [];
        filesSnapshot.forEach(doc => {
            const fileData = doc.data();
            files.push({
                id: doc.id,
                name: fileData.name,
                uploadedBy: fileData.uploadedBy,
                date: fileData.uploadDate,
                status: fileData.status
            });
        });
        
        // Fetch meetings
        const meetingsSnapshot = await firebase.firestore()
            .collection('meetings')
            .where('groupId', '==', groupId)
            .get();
        
        const meetings = [];
        meetingsSnapshot.forEach(doc => {
            const meetingData = doc.data();
            meetings.push({
                id: doc.id,
                date: meetingData.date,
                type: meetingData.type,
                status: meetingData.status
            });
        });
        
        // Fetch feedback
        const feedbackSnapshot = await firebase.firestore()
            .collection('feedback')
            .where('groupId', '==', groupId)
            .orderBy('timestamp', 'desc')
            .get();
        
        const feedbacks = [];
        feedbackSnapshot.forEach(doc => {
            const feedbackData = doc.data();
            feedbacks.push({
                id: doc.id,
                supervisor: feedbackData.supervisor,
                message: feedbackData.message,
                timestamp: feedbackData.timestamp
            });
        });
        
        // Fetch announcements
        const announcementsSnapshot = await firebase.firestore()
            .collection('announcements')
            .orderBy('timestamp', 'desc')
            .limit(5)
            .get();
        
        const announcements = [];
        announcementsSnapshot.forEach(doc => {
            const announcementData = doc.data();
            announcements.push({
                id: doc.id,
                title: announcementData.title,
                content: announcementData.content,
                timestamp: announcementData.timestamp
            });
        });
        
        // Update all sections
        updateWelcomeMessage(groupData);
        updateGroupMembers(members);
        updateProjectOverview(groupData);
        updateTaskAssignments(members, tasks);
        updateFileUploads(members, files);
        updateMeetingTable(meetings);
        updateProposalStatus(groupData);
        updateSupervisorFeedback(feedbacks);
        updateAnnouncements(announcements);
        updateNotificationCount(announcements.length);
        
        hideLoadingOverlay();
        
    } catch (error) {
        hideLoadingOverlay();
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data. Please check your connection.', 'error');
        
        // Show empty states
        updateWelcomeMessage({ groupId: groupId });
        updateGroupMembers([]);
        updateProjectOverview({ groupId, projectTitle: 'No Project Data', supervisor: 'No Supervisor', timeline: 'N/A', progress: 0 });
        updateTaskAssignments([], []);
        updateFileUploads([], []);
        updateMeetingTable([]);
        updateProposalStatus({});
        updateSupervisorFeedback([]);
        updateAnnouncements([]);
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

// Update group members section
function updateGroupMembers(members) {
    console.log('🔄 updateGroupMembers function called with:', members);
    
    const membersList = document.querySelector('.members-list');
    console.log('🔍 Found members list element:', membersList);
    
    if (!membersList) {
        console.error('❌ Members list element not found in DOM');
        return;
    }
    
    console.log('🔄 Updating group members with data:', members);
    console.log('👥 Total members to display:', members.length);
    
    // Clear existing content
    membersList.innerHTML = '';
    
    if (members.length === 0) {
        membersList.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">No group members found</p>';
        console.log('⚠️ No members to display');
        return;
    }
    
    members.forEach((member, index) => {
        console.log(`👤 Processing member ${index + 1}:`, member);
        
        const memberDiv = document.createElement('div');
        memberDiv.className = `member ${member.isGroupLeader ? 'leader' : ''}`;
        
        const leaderBadge = member.isGroupLeader ? '<span class="leader-badge">Leader</span>' : '';
        
        memberDiv.innerHTML = `
            <div class="member-info">
                <div class="member-name">
                    ${member.name} ${leaderBadge}
                </div>
                <div class="member-details">
                    ID: ${member.registrationNumber} | Email: ${member.email}
                </div>
            </div>
        `;
        
        membersList.appendChild(memberDiv);
        console.log(`✅ Added member ${member.name} to display`);
    });
    
    console.log('✅ All group members displayed successfully');
    console.log('🔍 Final members list HTML:', membersList.innerHTML);
}

// Update project overview
function updateProjectOverview(groupData) {
    const projectInfo = document.querySelector('.project-info');
    if (!projectInfo) return;
    
    projectInfo.innerHTML = `
        <div class="info-row">
            <span class="label">Group ID:</span>
            <span class="value">${groupData.groupId || 'N/A'}</span>
        </div>
        <div class="info-row">
            <span class="label">Project:</span>
            <span class="value">${groupData.projectTitle || 'No Project Data'}</span>
        </div>
        <div class="info-row">
            <span class="label">Supervisor:</span>
            <span class="value">${groupData.supervisor || 'No Supervisor Assigned'}</span>
        </div>
        <div class="info-row">
            <span class="label">Timeline:</span>
            <span class="value">${groupData.timeline || 'N/A'}</span>
        </div>
        <div class="info-row">
            <span class="label">Group Progress:</span>
            <div class="progress-bar">
                <div class="progress" style="width: ${groupData.progress || 0}%"></div>
            </div>
            <span class="progress-text">${groupData.progress || 0}%</span>
        </div>
    `;
}

// Update proposal status
function updateProposalStatus(groupData) {
    const proposalStatus = document.querySelector('.proposal-status');
    if (!proposalStatus) return;
    
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
}

// Update supervisor feedback
function updateSupervisorFeedback(feedbacks) {
    const feedbackList = document.querySelector('.feedback-list');
    if (!feedbackList) return;
    
    feedbackList.innerHTML = '';
    
    if (!feedbackbacks || feedbacks.length === 0) {
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

// Update file uploads
function updateFileUploads(members, files) {
    const fileTableDiv = document.querySelector('.file-table');
    if (!fileTableDiv) return;
    
    // Create table structure
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
                <!-- Files will be dynamically loaded here -->
            </tbody>
        </table>
    `;
    
    const fileTableBody = fileTableDiv.querySelector('tbody');
    if (!fileTableBody) return;
    
    if (files.length === 0) {
        fileTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #6c757d; padding: 20px;">No files uploaded yet</td></tr>';
        return;
    }
    
    files.forEach(file => {
        const uploadedBy = members.find(m => m.id === file.uploadedBy);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><i class="fas fa-file-${getFileIcon(file.name)}"></i> ${file.name}</td>
            <td>${uploadedBy ? uploadedBy.name : 'Unknown'}</td>
            <td>${new Date(file.date).toLocaleDateString()}</td>
            <td><span class="status ${file.status}">${file.status}</span></td>
        `;
        fileTableBody.appendChild(row);
    });
}

// Update task assignments
function updateTaskAssignments(members, tasks) {
    const taskTableDiv = document.querySelector('.task-table');
    if (!taskTableDiv) return;
    
    // Create table structure
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
                <!-- Tasks will be dynamically loaded here -->
            </tbody>
        </table>
    `;
    
    const taskTableBody = taskTableDiv.querySelector('tbody');
    if (!taskTableBody) return;
    
    if (tasks.length === 0) {
        taskTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #6c757d; padding: 20px;">No tasks assigned yet</td></tr>';
        return;
    }
    
    tasks.forEach(task => {
        const assignedMember = members.find(m => m.id === task.assignedTo);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${task.title}</td>
            <td>${assignedMember ? assignedMember.name : 'Unassigned'}</td>
            <td><span class="status ${task.status.replace(' ', '-')}">${task.status}</span></td>
        `;
        taskTableBody.appendChild(row);
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
