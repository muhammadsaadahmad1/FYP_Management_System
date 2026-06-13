/**
 * Admin Groups Dashboard — view and filter all student groups
 */

let enrichedGroups = [];
let allSupervisors = [];
let filterState = {
  search: '',
  discipline: 'all',
  batch: 'all',
  supervisor: 'all',
  category: 'all'
};

async function loadAdminGroupsPage() {
  console.log('Loading Admin Groups Dashboard...');

  try {
    const adminNameEl = document.getElementById('adminName');
    const displayName = localStorage.getItem('displayName');
    if (adminNameEl && displayName) adminNameEl.textContent = displayName;

    showLoadingState();

    const [groupsSnap, usersSnap, proposalsSnap, supervisorsSnap] = await Promise.all([
      db.collection('groups').get(),
      db.collection('users').where('role', '==', 'student').get(),
      db.collection('proposals').get(),
      db.collection('supervisors').get()
    ]);

    const groups = groupsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const students = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const proposals = proposalsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    allSupervisors = supervisorsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    enrichedGroups = groups.map((group) => enrichGroupRecord(group, students, proposals, allSupervisors));

    enrichedGroups.sort((a, b) => String(a.groupId || a.id).localeCompare(String(b.groupId || b.id)));

    populateFilterOptions(enrichedGroups);
    bindFilterEvents();
    updateGroupStats(enrichedGroups);
    applyGroupFilters();

    console.log(`Admin Groups Dashboard loaded (${enrichedGroups.length} groups)`);
  } catch (error) {
    console.error('Error loading admin groups page:', error);
    showNotification('Failed to load groups. Please refresh and try again.', 'error');
    renderErrorState(error.message);
  }
}

function enrichGroupRecord(group, students, proposals, supervisors) {
  const groupKey = group.groupId || group.id;
  const groupStudents = students.filter((s) => s.groupId === groupKey || s.groupId === group.id);

  const groupProposals = proposals
    .filter((p) => p.groupId === groupKey || p.groupId === group.id)
    .sort((a, b) => getTimestamp(b) - getTimestamp(a));

  const proposal = groupProposals[0] || null;

  const membersFromGroup = Array.isArray(group.members) ? group.members : [];
  const studentsList = mergeStudentLists(membersFromGroup, groupStudents);

  const discipline = pickFirst(
    group.discipline,
    studentsList[0]?.medium,
    membersFromGroup[0]?.medium
  ) || 'N/A';

  const batch = pickFirst(
    group.batch,
    studentsList[0]?.batch,
    membersFromGroup[0]?.batch
  ) || 'N/A';

  const supervisorId = pickFirst(
    group.supervisorId,
    proposal?.supervisorId,
    proposal?.requestedSupervisorId
  );

  const supervisor = supervisors.find((s) => s.id === supervisorId) || {};
  const supervisorName = pickFirst(
    group.supervisorName,
    proposal?.supervisorName,
    proposal?.requestedSupervisorName,
    supervisor.fullName,
    supervisor.displayName
  ) || 'Not Assigned';

  const category = pickFirst(
    group.projectCategory,
    proposal?.category,
    proposal?.projectType
  ) || 'N/A';

  const projectTitle = pickFirst(
    group.projectTitle,
    proposal?.title,
    proposal?.projectTitle
  ) || 'Not submitted';

  return {
    ...group,
    groupKey,
    groupName: group.groupName || groupKey,
    discipline,
    batch,
    supervisorId: supervisorId || '',
    supervisorName,
    category,
    projectTitle,
    proposal,
    students: studentsList,
    supervisor
  };
}

function mergeStudentLists(membersFromGroup, groupStudents) {
  const byRoll = new Map();

  membersFromGroup.forEach((member) => {
    const roll = member.registrationNumber || member.loginId || member.studentId || '';
    byRoll.set(roll || member.email || member.fullName, {
      name: member.fullName || member.displayName || member.name || 'Unknown',
      rollNumber: roll || 'N/A',
      email: member.email || 'N/A',
      batch: member.batch || 'N/A',
      medium: member.medium || 'N/A',
      isGroupLeader: Boolean(member.isGroupLeader)
    });
  });

  groupStudents.forEach((student) => {
    const roll = student.registrationNumber || student.loginId || student.id;
    const key = roll || student.email;
    byRoll.set(key, {
      name: student.displayName || student.fullName || 'Unknown',
      rollNumber: roll || 'N/A',
      email: student.email || 'N/A',
      batch: student.batch || 'N/A',
      medium: student.medium || 'N/A',
      isGroupLeader: Boolean(student.isGroupLeader)
    });
  });

  return Array.from(byRoll.values());
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
}

function getTimestamp(record) {
  const raw = record?.submittedAt || record?.createdAt || record?.updatedAt;
  if (!raw) return 0;
  if (typeof raw.toDate === 'function') return raw.toDate().getTime();
  return new Date(raw).getTime() || 0;
}

function populateFilterOptions(groups) {
  fillSelect('disciplineFilter', uniqueValues(groups, (g) => g.discipline), 'All Disciplines');
  fillSelect('batchFilter', uniqueValues(groups, (g) => g.batch), 'All Batches');

  const defaultCategories = ['FYP', 'Research', 'Industry Project'];
  const categories = [...new Set([...defaultCategories, ...uniqueValues(groups, (g) => g.category)])];
  fillSelect('categoryFilter', categories, 'All Categories');

  const supervisorSelect = document.getElementById('supervisorFilter');
  if (!supervisorSelect) return;

  supervisorSelect.innerHTML = `
    <option value="all">All Supervisors</option>
    <option value="unassigned">Unassigned</option>
  `;

  allSupervisors
    .filter((s) => s.isActive !== false)
    .sort((a, b) => (a.fullName || a.displayName || '').localeCompare(b.fullName || b.displayName || ''))
    .forEach((supervisor) => {
      const option = document.createElement('option');
      option.value = supervisor.id;
      option.textContent = supervisor.fullName || supervisor.displayName || supervisor.email || 'Supervisor';
      supervisorSelect.appendChild(option);
    });
}

function fillSelect(elementId, values, allLabel) {
  const select = document.getElementById(elementId);
  if (!select) return;

  select.innerHTML = `<option value="all">${allLabel}</option>`;
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function uniqueValues(items, getter) {
  return [...new Set(items.map(getter).filter((v) => v && v !== 'N/A'))].sort();
}

function bindFilterEvents() {
  const searchInput = document.getElementById('groupSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      filterState.search = searchInput.value.trim().toLowerCase();
      applyGroupFilters();
    });
  }

  ['disciplineFilter', 'batchFilter', 'supervisorFilter', 'categoryFilter'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      filterState.discipline = document.getElementById('disciplineFilter')?.value || 'all';
      filterState.batch = document.getElementById('batchFilter')?.value || 'all';
      filterState.supervisor = document.getElementById('supervisorFilter')?.value || 'all';
      filterState.category = document.getElementById('categoryFilter')?.value || 'all';
      applyGroupFilters();
    });
  });

  const clearBtn = document.getElementById('clearFiltersBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearGroupFilters);
  }
}

function clearGroupFilters() {
  filterState = { search: '', discipline: 'all', batch: 'all', supervisor: 'all', category: 'all' };

  const searchInput = document.getElementById('groupSearchInput');
  if (searchInput) searchInput.value = '';

  ['disciplineFilter', 'batchFilter', 'supervisorFilter', 'categoryFilter'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = 'all';
  });

  applyGroupFilters();
}

function applyGroupFilters() {
  const filtered = enrichedGroups.filter(matchesGroupFilters);
  updateGroupStats(filtered);
  renderGroupsTable(filtered);
}

function matchesGroupFilters(group) {
  const searchBlob = [
    group.groupKey,
    group.groupName,
    group.projectTitle,
    group.supervisorName,
    group.discipline,
    group.batch,
    group.category,
    ...(group.students || []).map((s) => `${s.name} ${s.rollNumber} ${s.email}`)
  ].join(' ').toLowerCase();

  if (filterState.search && !searchBlob.includes(filterState.search)) return false;
  if (filterState.discipline !== 'all' && group.discipline !== filterState.discipline) return false;
  if (filterState.batch !== 'all' && String(group.batch) !== filterState.batch) return false;
  if (filterState.category !== 'all' && group.category !== filterState.category) return false;

  if (filterState.supervisor === 'unassigned') {
    return !group.supervisorId && group.supervisorName === 'Not Assigned';
  }
  if (filterState.supervisor !== 'all' && group.supervisorId !== filterState.supervisor) {
    return false;
  }

  return true;
}

function updateGroupStats(groups) {
  const total = groups.length;
  const assigned = groups.filter((g) => g.supervisorId || g.supervisorName !== 'Not Assigned').length;
  const withProject = groups.filter((g) => g.projectTitle && g.projectTitle !== 'Not submitted').length;
  const disciplines = new Set(groups.map((g) => g.discipline).filter((d) => d && d !== 'N/A')).size;

  setText('totalGroupsCount', total);
  setText('assignedGroupsCount', assigned);
  setText('withProjectCount', withProject);
  setText('disciplineCount', disciplines);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function showLoadingState() {
  const container = document.getElementById('groupsTableContainer');
  if (!container) return;
  container.innerHTML = `
    <div class="loading-spinner">
      <i class="fas fa-spinner"></i>
      <p>Loading groups...</p>
    </div>
  `;
}

function renderErrorState(message) {
  const container = document.getElementById('groupsTableContainer');
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-exclamation-circle"></i>
      <h3>Error Loading Groups</h3>
      <p>${message || 'Unknown error'}</p>
      <button class="btn btn-primary" style="margin-top: 15px;" onclick="loadAdminGroupsPage()">
        <i class="fas fa-sync"></i> Retry
      </button>
    </div>
  `;
}

function renderGroupsTable(groups) {
  const container = document.getElementById('groupsTableContainer');
  const resultCount = document.getElementById('groupsResultCount');
  if (!container) return;

  if (resultCount) {
    resultCount.textContent = `${groups.length} group${groups.length === 1 ? '' : 's'} shown`;
  }

  if (groups.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users"></i>
        <h3>No Groups Found</h3>
        <p>Try adjusting your search or filter criteria.</p>
      </div>
    `;
    return;
  }

  let html = `
    <table class="groups-table">
      <thead>
        <tr>
          <th>Group ID</th>
          <th>Discipline</th>
          <th>Batch</th>
          <th>Supervisor</th>
          <th>Category</th>
          <th>Project Title</th>
          <th>Members</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  groups.forEach((group) => {
    html += `
      <tr class="group-row" data-group-key="${escapeAttr(group.groupKey)}" onclick="viewGroupDetails('${escapeAttr(group.groupKey)}')">
        <td><strong>${escapeHtml(group.groupKey)}</strong></td>
        <td>${escapeHtml(group.discipline)}</td>
        <td>${escapeHtml(String(group.batch))}</td>
        <td>${escapeHtml(group.supervisorName)}</td>
        <td>${escapeHtml(group.category)}</td>
        <td>${escapeHtml(group.projectTitle)}</td>
        <td>${group.students?.length || group.groupSize || 0}</td>
        <td>
          <button class="action-btn btn-view" onclick="viewGroupDetails('${escapeAttr(group.groupKey)}')">
            <i class="fas fa-eye"></i> View
          </button>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function viewGroupDetails(groupKey) {
  const group = enrichedGroups.find((g) => g.groupKey === groupKey);
  if (!group) return;

  const modal = document.getElementById('groupDetailModal');
  const modalBody = document.getElementById('groupModalBody');
  if (!modal || !modalBody) return;

  const studentsHtml = (group.students || []).length
    ? `
      <table class="detail-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Roll Number</th>
            <th>Email</th>
            <th>Batch</th>
          </tr>
        </thead>
        <tbody>
          ${group.students.map((student) => `
            <tr>
              <td>${escapeHtml(student.name)}${student.isGroupLeader ? ' <span class="leader-badge">Leader</span>' : ''}</td>
              <td>${escapeHtml(student.rollNumber)}</td>
              <td>${escapeHtml(student.email)}</td>
              <td>${escapeHtml(String(student.batch))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '<p class="muted">No student records found for this group.</p>';

  const supervisor = group.supervisor || {};
  const proposal = group.proposal;

  modalBody.innerHTML = `
    <div class="group-detail">
      <div class="detail-grid">
        <div><span class="detail-label">Group ID</span><strong>${escapeHtml(group.groupKey)}</strong></div>
        <div><span class="detail-label">Discipline</span><strong>${escapeHtml(group.discipline)}</strong></div>
        <div><span class="detail-label">Batch</span><strong>${escapeHtml(String(group.batch))}</strong></div>
        <div><span class="detail-label">Group Size</span><strong>${group.students?.length || group.groupSize || 0}</strong></div>
      </div>

      <h4>Students</h4>
      ${studentsHtml}

      <h4>Project Details</h4>
      <div class="detail-panel">
        <p><strong>Title:</strong> ${escapeHtml(group.projectTitle)}</p>
        <p><strong>Category:</strong> ${escapeHtml(group.category)}</p>
        <p><strong>Status:</strong> ${escapeHtml(proposal?.status || proposal?.assignmentStatus || 'No proposal submitted')}</p>
        ${proposal?.description ? `<p><strong>Description:</strong> ${escapeHtml(proposal.description)}</p>` : ''}
      </div>

      <h4>Supervisor Details</h4>
      <div class="detail-panel">
        ${group.supervisorId ? `
          <p><strong>Name:</strong> ${escapeHtml(group.supervisorName)}</p>
          <p><strong>Department:</strong> ${escapeHtml(supervisor.department || 'N/A')}</p>
          <p><strong>Email:</strong> ${escapeHtml(supervisor.email || 'N/A')}</p>
          <p><strong>Designation:</strong> ${escapeHtml(supervisor.designation || 'N/A')}</p>
          <p><strong>Expertise:</strong> ${escapeHtml(supervisor.expertise || 'N/A')}</p>
        ` : '<p class="muted">No supervisor assigned yet.</p>'}
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function closeGroupModal() {
  const modal = document.getElementById('groupDetailModal');
  if (modal) modal.classList.remove('active');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function logout() {
  firebaseLogout('login.html');
}

window.onclick = function (event) {
  const modal = document.getElementById('groupDetailModal');
  if (event.target === modal) closeGroupModal();
};
