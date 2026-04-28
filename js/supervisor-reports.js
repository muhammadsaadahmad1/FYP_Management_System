// Firebase Authentication Check for Supervisor Reports Page
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

    console.log('Supervisor role confirmed, loading reports data...');
    
    localStorage.setItem('uid', user.uid);
    localStorage.setItem('displayName', userData.displayName || user.email);
    localStorage.setItem('role', userData.role);
    
    loadSupervisorReportsPage();
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

// Global variable to store reports data
let supervisorReportsData = [];

// Load all reports page data
async function loadSupervisorReportsPage() {
  console.log('Loading supervisor reports page data...');
  
  try {
    const supervisorId = localStorage.getItem('uid');
    
    if (!supervisorId) {
      console.log('Missing supervisorId');
      if (typeof showNotification !== 'undefined') {
        showNotification('Missing user information. Please log in again.', 'error');
      }
      return;
    }
    
    // Load reports data
    const reportsData = await loadAllSupervisorReports(supervisorId);
    supervisorReportsData = reportsData;
    
    // Update stats
    updateReportsStats(reportsData);
    
    // Display reports
    displayReportsList(reportsData);
    
    console.log('Supervisor reports page loaded successfully');
    
  } catch (error) {
    console.error('Error loading supervisor reports page:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error loading reports data.', 'error');
    }
  }
}

// Load all supervisor reports with details
async function loadAllSupervisorReports(supervisorId) {
  try {
    const reportsSnapshot = await db.collection('reports')
      .where('supervisorId', '==', supervisorId)
      .orderBy('submittedDate', 'desc')
      .get();
    
    const reports = [];
    
    for (const reportDoc of reportsSnapshot.docs) {
      const reportData = reportDoc.data();
      
      // Get group information
      const groupDoc = await db.collection('groups').doc(reportData.groupId).get();
      const groupData = groupDoc.exists ? groupDoc.data() : null;
      
      // Get student information
      let studentNames = [];
      if (groupData && groupData.members) {
        for (const memberId of groupData.members) {
          const memberDoc = await db.collection('users').doc(memberId).get();
          if (memberDoc.exists) {
            studentNames.push(memberDoc.data().displayName);
          }
        }
      }
      
      reports.push({
        id: reportDoc.id,
        title: reportData.title || 'Untitled Report',
        type: reportData.type || 'other',
        status: reportData.status || 'pending',
        submittedDate: reportData.submittedDate || null,
        reviewedDate: reportData.reviewedDate || null,
        feedback: reportData.feedback || '',
        groupId: reportData.groupId,
        groupName: groupData ? groupData.groupName : 'Unknown Group',
        studentNames: studentNames,
        supervisorId: reportData.supervisorId,
        attachments: reportData.attachments || [],
        fileSize: reportData.fileSize || 0,
        downloadCount: reportData.downloadCount || 0,
        lastDownloaded: reportData.lastDownloaded || null
      });
    }
    
    return reports;
  } catch (error) {
    console.error('Error loading supervisor reports:', error);
    return [];
  }
}

// Update statistics cards
function updateReportsStats(reportsData) {
  const pendingCount = reportsData.filter(r => r.status === 'pending').length;
  const underReviewCount = reportsData.filter(r => r.status === 'under_review').length;
  const approvedCount = reportsData.filter(r => r.status === 'approved').length;
  const downloadedCount = reportsData.filter(r => r.downloadCount > 0).length;
  
  document.getElementById('pendingCount').textContent = pendingCount;
  document.getElementById('underReviewCount').textContent = underReviewCount;
  document.getElementById('approvedCount').textContent = approvedCount;
  document.getElementById('downloadedCount').textContent = downloadedCount;
}

// Display reports list
function displayReportsList(reportsData) {
  const container = document.getElementById('reportsListContainer');
  if (!container) return;
  
  if (reportsData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-file-pdf" style="font-size: 48px; color: #cbd5e1; margin-bottom: 20px;"></i>
        <h4>No Reports Found</h4>
        <p style="color: #6b7280;">No reports have been submitted yet.</p>
      </div>
    `;
    return;
  }
  
  const reportsHtml = reportsData.map(report => `
    <div class="report-card" data-report-id="${report.id}" data-status="${report.status}" data-type="${report.type}" data-date="${report.submittedDate}">
      <div class="report-card-header">
        <div class="report-info">
          <h4>${report.title}</h4>
          <span class="report-id">ID: ${report.id}</span>
        </div>
        <span class="status-badge ${report.status}">${formatStatus(report.status)}</span>
      </div>
      
      <div class="report-card-body">
        <div class="report-detail">
          <i class="fas fa-users"></i>
          <div>
            <label>Group</label>
            <p>${report.groupName}</p>
          </div>
        </div>
        
        <div class="report-detail">
          <i class="fas fa-user-graduate"></i>
          <div>
            <label>Students</label>
            <p>${report.studentNames.join(', ') || 'N/A'}</p>
          </div>
        </div>
        
        <div class="report-detail">
          <i class="fas fa-tag"></i>
          <div>
            <label>Type</label>
            <p>${formatReportType(report.type)}</p>
          </div>
        </div>
        
        <div class="report-detail">
          <i class="fas fa-calendar"></i>
          <div>
            <label>Submitted</label>
            <p>${report.submittedDate ? new Date(report.submittedDate).toLocaleDateString() : 'N/A'}</p>
          </div>
        </div>
        
        <div class="report-detail">
          <i class="fas fa-database"></i>
          <div>
            <label>File Size</label>
            <p>${formatFileSize(report.fileSize)}</p>
          </div>
        </div>
        
        <div class="report-detail">
          <i class="fas fa-download"></i>
          <div>
            <label>Downloads</label>
            <p>${report.downloadCount}</p>
          </div>
        </div>
      </div>
      
      <div class="report-attachments">
        ${report.attachments && report.attachments.length > 0 ? `
          <div class="attachment-preview">
            <i class="fas fa-file-pdf"></i>
            <span>${report.attachments[0].name}</span>
          </div>
        ` : '<p style="color: #9ca3af; font-size: 12px;">No attachments</p>'}
      </div>
      
      <div class="report-card-actions">
        <button class="btn btn-primary" onclick="reviewReport('${report.id}')">
          <i class="fas fa-eye"></i> Review
        </button>
        <button class="btn btn-success" onclick="downloadReport('${report.id}')">
          <i class="fas fa-download"></i> Download
        </button>
        <button class="btn btn-info" onclick="viewReportHistory('${report.id}')">
          <i class="fas fa-history"></i> History
        </button>
      </div>
    </div>
  `).join('');
  
  container.innerHTML = reportsHtml;
}

// Filter reports based on search and filters
function filterReports() {
  const searchInput = document.getElementById('reportSearchInput').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  const typeFilter = document.getElementById('typeFilter').value;
  const dateFilter = document.getElementById('dateFilter').value;
  
  const filteredReports = supervisorReportsData.filter(report => {
    const matchesSearch = 
      report.title.toLowerCase().includes(searchInput) ||
      report.groupName.toLowerCase().includes(searchInput) ||
      report.studentNames.some(name => name.toLowerCase().includes(searchInput));
    
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    const matchesType = typeFilter === 'all' || report.type === typeFilter;
    
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const reportDate = new Date(report.submittedDate);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
      
      switch(dateFilter) {
        case 'today':
          matchesDate = reportDate >= today && reportDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
          break;
        case 'week':
          matchesDate = reportDate >= weekStart && reportDate <= weekEnd;
          break;
        case 'month':
          matchesDate = reportDate >= monthStart && reportDate <= monthEnd;
          break;
        case 'quarter':
          matchesDate = reportDate >= quarterStart && reportDate <= quarterEnd;
          break;
      }
    }
    
    return matchesSearch && matchesStatus && matchesType && matchesDate;
  });
  
  displayReportsList(filteredReports);
}

// Review report
async function reviewReport(reportId) {
  try {
    const report = supervisorReportsData.find(r => r.id === reportId);
    if (!report) {
      if (typeof showNotification !== 'undefined') {
        showNotification('Report not found', 'error');
      }
      return;
    }
    
    const modal = document.getElementById('reportReviewModal');
    const content = document.getElementById('reportReviewContent');
    
    content.innerHTML = `
      <div class="report-review">
        <div class="review-section">
          <h4>Report Details</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <label>Title:</label>
              <p>${report.title}</p>
            </div>
            <div class="detail-item">
              <label>Group:</label>
              <p>${report.groupName}</p>
            </div>
            <div class="detail-item">
              <label>Students:</label>
              <p>${report.studentNames.join(', ')}</p>
            </div>
            <div class="detail-item">
              <label>Type:</label>
              <p>${formatReportType(report.type)}</p>
            </div>
            <div class="detail-item">
              <label>Submitted:</label>
              <p>${report.submittedDate ? new Date(report.submittedDate).toLocaleDateString() : 'N/A'}</p>
            </div>
            <div class="detail-item">
              <label>Status:</label>
              <span class="status-badge ${report.status}">${formatStatus(report.status)}</span>
            </div>
            <div class="detail-item">
              <label>File Size:</label>
              <p>${formatFileSize(report.fileSize)}</p>
            </div>
            <div class="detail-item">
              <label>Downloads:</label>
              <p>${report.downloadCount}</p>
            </div>
          </div>
        </div>
        
        ${report.attachments && report.attachments.length > 0 ? `
          <div class="review-section">
            <h4>Attachments</h4>
            <div class="attachments-list">
              ${report.attachments.map(att => `
                <div class="attachment-item">
                  <i class="fas fa-file-pdf"></i>
                  <span>${att.name}</span>
                  <button class="btn btn-sm btn-primary" onclick="downloadAttachment('${att.url}')">
                    <i class="fas fa-download"></i> Download
                  </button>
                  <button class="btn btn-sm btn-info" onclick="previewAttachment('${att.url}')">
                    <i class="fas fa-eye"></i> Preview
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <div class="review-section">
          <h4>Review Action</h4>
          <form id="reportReviewForm">
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
              <textarea id="reviewFeedback" rows="6" placeholder="Provide detailed feedback on the report..."></textarea>
            </div>
            <div class="form-group">
              <label for="reviewGrade">Grade (Optional):</label>
              <input type="text" id="reviewGrade" placeholder="e.g., A, B+, 85/100">
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" onclick="closeReportReviewModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">Submit Review</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    // Add form submit handler
    document.getElementById('reportReviewForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitReportReview(reportId);
    });
    
    modal.style.display = 'block';
    
  } catch (error) {
    console.error('Error reviewing report:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error loading report for review', 'error');
    }
  }
}

// Submit report review
async function submitReportReview(reportId) {
  try {
    const decision = document.getElementById('reviewDecision').value;
    const feedback = document.getElementById('reviewFeedback').value;
    const grade = document.getElementById('reviewGrade').value;
    
    if (!decision) {
      if (typeof showNotification !== 'undefined') {
        showNotification('Please select a decision', 'error');
      }
      return;
    }
    
    const supervisorId = localStorage.getItem('uid');
    
    await db.collection('reports').doc(reportId).update({
      status: decision,
      feedback: feedback,
      grade: grade || '',
      reviewedDate: new Date().toISOString(),
      reviewedBy: supervisorId
    });
    
    // Send notification to students
    const report = supervisorReportsData.find(r => r.id === reportId);
    if (report && report.groupId) {
      const groupDoc = await db.collection('groups').doc(report.groupId).get();
      if (groupDoc.exists) {
        const groupData = groupDoc.data();
        if (groupData.members) {
          for (const memberId of groupData.members) {
            await db.collection('notifications').add({
              userId: memberId,
              type: 'report_review',
              title: `Report ${decision}`,
              message: `Your report "${report.title}" has been ${decision}.`,
              reportId: reportId,
              createdAt: new Date().toISOString(),
              read: false
            });
          }
        }
      }
    }
    
    if (typeof showNotification !== 'undefined') {
      showNotification(`Report ${decision} successfully!`, 'success');
    }
    
    closeReportReviewModal();
    loadSupervisorReportsPage(); // Reload data
    
  } catch (error) {
    console.error('Error submitting review:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error submitting review', 'error');
    }
  }
}

// Download report
async function downloadReport(reportId) {
  try {
    const report = supervisorReportsData.find(r => r.id === reportId);
    if (!report || !report.attachments || report.attachments.length === 0) {
      if (typeof showNotification !== 'undefined') {
        showNotification('No file available for download', 'error');
      }
      return;
    }
    
    // Update download count
    await db.collection('reports').doc(reportId).update({
      downloadCount: (report.downloadCount || 0) + 1,
      lastDownloaded: new Date().toISOString()
    });
    
    // Download the first attachment
    const attachment = report.attachments[0];
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (typeof showNotification !== 'undefined') {
      showNotification('Report downloaded successfully!', 'success');
    }
    
    // Reload data to update download count
    loadSupervisorReportsPage();
    
  } catch (error) {
    console.error('Error downloading report:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error downloading report', 'error');
    }
  }
}

// Download attachment
function downloadAttachment(url) {
  const link = document.createElement('a');
  link.href = url;
  link.download = '';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Preview attachment
function previewAttachment(url) {
  window.open(url, '_blank');
}

// View report history
function viewReportHistory(reportId) {
  if (typeof showNotification !== 'undefined') {
    showNotification('Report history feature coming soon!', 'info');
  }
}

// Generate summary report
function generateSummaryReport() {
  if (typeof showNotification !== 'undefined') {
    showNotification('Summary report feature coming soon!', 'info');
  }
}

// Modal functions
function closeReportReviewModal() {
  document.getElementById('reportReviewModal').style.display = 'none';
}

function openReportTemplateModal() {
  document.getElementById('reportTemplateModal').style.display = 'block';
}

function closeReportTemplateModal() {
  document.getElementById('reportTemplateModal').style.display = 'none';
  document.getElementById('reportTemplateForm').reset();
}

// Create report template
document.getElementById('reportTemplateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  try {
    const title = document.getElementById('templateTitle').value;
    const type = document.getElementById('templateType').value;
    const description = document.getElementById('templateDescription').value;
    const sections = document.getElementById('templateSections').value;
    const supervisorId = localStorage.getItem('uid');
    
    await db.collection('report_templates').add({
      title: title,
      type: type,
      description: description,
      sections: sections.split('\n').filter(s => s.trim()),
      supervisorId: supervisorId,
      createdAt: new Date().toISOString()
    });
    
    if (typeof showNotification !== 'undefined') {
      showNotification('Report template created successfully!', 'success');
    }
    
    closeReportTemplateModal();
    
  } catch (error) {
    console.error('Error creating report template:', error);
    if (typeof showNotification !== 'undefined') {
      showNotification('Error creating report template', 'error');
    }
  }
});

// Helper functions
function formatStatus(status) {
  if (!status) return 'Pending';
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatReportType(type) {
  const types = {
    'progress': 'Progress Report',
    'interim': 'Interim Report',
    'final': 'Final Report',
    'other': 'Other'
  };
  return types[type] || type;
}

function formatFileSize(bytes) {
  if (!bytes) return 'N/A';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function showNotifications() {
  if (typeof showNotification !== 'undefined') {
    showNotification('Notification center coming soon!', 'info');
  }
}

// Close modals when clicking outside
window.onclick = function(event) {
  const reviewModal = document.getElementById('reportReviewModal');
  const templateModal = document.getElementById('reportTemplateModal');
  
  if (event.target === reviewModal) {
    reviewModal.style.display = 'none';
  }
  if (event.target === templateModal) {
    templateModal.style.display = 'none';
  }
}
