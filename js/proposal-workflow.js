/**
 * Shared proposal assignment workflow (student → supervisor → admin)
 */
const ProposalWorkflow = (function () {
  const RESPONSE_DAYS = 7;

  function getDb() {
    return window.firebaseServices?.db || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
  }

  function supervisorDisplayName(supervisor) {
    return supervisor.fullName || supervisor.displayName || supervisor.email || 'Supervisor';
  }

  function getResponseDeadline() {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + RESPONSE_DAYS);
    return deadline.toISOString();
  }

  function isOverdue(proposal) {
    if (proposal.assignmentStatus !== 'pending_supervisor') return false;
    if (!proposal.responseDeadline) return false;
    return new Date(proposal.responseDeadline) < new Date();
  }

  function getSubmittedDate(proposal) {
    return proposal.submittedDate || proposal.submittedAt || null;
  }

  function getDescription(proposal) {
    return proposal.abstract || proposal.description || proposal.projectDescription || '';
  }

  async function fetchAvailableSupervisors() {
    const db = getDb();
    const snapshot = await db.collection('supervisors')
      .where('isActive', '==', true)
      .where('showInStudentList', '==', true)
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async function getActiveAdminUserIds() {
    const db = getDb();
    // Use admins collection — readable by any signed-in user (unlike users collection)
    const snapshot = await db.collection('admins')
      .where('isActive', '==', true)
      .get();
    return snapshot.docs.map((doc) => doc.id);
  }

  async function getGroupMemberUserIds(groupId) {
    const db = getDb();
    // Read the group doc — readable by any signed-in user
    // Groups store members as objects; UIDs are stored per-member as uid field (if present)
    // or we fall back to reading memberUids array if present
    const groupDoc = await db.collection('groups').doc(groupId).get();
    if (!groupDoc.exists) return [];

    const groupData = groupDoc.data();

    // Prefer explicit memberUids array if stored
    if (Array.isArray(groupData.memberUids) && groupData.memberUids.length > 0) {
      return groupData.memberUids;
    }

    // Fall back: members array may contain objects with a uid field
    if (Array.isArray(groupData.members)) {
      const uids = groupData.members
        .filter((m) => typeof m === 'object' && m.uid)
        .map((m) => m.uid);
      if (uids.length > 0) return uids;
    }

    // Last resort: query users collection (requires rule allowing group-member reads)
    try {
      const usersSnap = await db.collection('users').where('groupId', '==', groupId).get();
      return usersSnap.docs.map((doc) => doc.id);
    } catch (e) {
      console.warn('Could not fetch group member UIDs from users collection:', e.message);
      return [];
    }
  }

  async function getStudentNames(groupId, groupData) {
    const db = getDb();
    const usersSnap = await db.collection('users').where('groupId', '==', groupId).get();
    if (!usersSnap.empty) {
      return usersSnap.docs.map((doc) => doc.data().displayName || doc.data().email).filter(Boolean);
    }

    if (groupData && Array.isArray(groupData.members)) {
      return groupData.members
        .map((member) => (typeof member === 'string' ? member : member.fullName || member.email))
        .filter(Boolean);
    }

    return [];
  }

  async function sendNotification(userId, payload) {
    const db = getDb();
    await db.collection('notifications').add({
      userId,
      read: false,
      createdAt: new Date().toISOString(),
      ...payload
    });
  }

  async function notifyAdmins(payload) {
    const adminIds = await getActiveAdminUserIds();
    await Promise.all(adminIds.map((adminId) => sendNotification(adminId, payload)));
  }

  async function notifyGroupMembers(groupId, payload) {
    const memberIds = await getGroupMemberUserIds(groupId);
    await Promise.all(memberIds.map((userId) => sendNotification(userId, payload)));
  }

  async function notifyProposalSubmitted({ proposalId, groupId, groupLabel, supervisorId, supervisorName, proposalTitle }) {
    await sendNotification(supervisorId, {
      type: 'proposal_supervisor_request',
      title: 'New Proposal Assignment Request',
      message: `${groupLabel} group submitted "${proposalTitle}" and requested you as their supervisor. Please accept or reject within 7 days.`,
      proposalId,
      groupId
    });

    await notifyAdmins({
      type: 'proposal_admin_request',
      title: 'Proposal Supervisor Request',
      message: `${groupLabel} group wants to assign their proposal to ${supervisorName} supervisor.`,
      proposalId,
      groupId,
      supervisorId,
      supervisorName
    });

    await notifyGroupMembers(groupId, {
      type: 'proposal_submitted',
      title: 'Proposal Submitted',
      message: `Your group proposal "${proposalTitle}" was sent to ${supervisorName} for review.`,
      proposalId,
      groupId
    });
  }

  async function notifyProposalAccepted({ proposalId, groupId, groupLabel, supervisorName, proposalTitle }) {
    await notifyGroupMembers(groupId, {
      type: 'proposal_accepted',
      title: 'Proposal Accepted',
      message: `${supervisorName} accepted your proposal "${proposalTitle}".`,
      proposalId,
      groupId
    });

    await notifyAdmins({
      type: 'proposal_accepted',
      title: 'Proposal Accepted by Supervisor',
      message: `${supervisorName} accepted the proposal from ${groupLabel} group.`,
      proposalId,
      groupId
    });
  }

  async function notifyProposalRejected({ proposalId, groupId, groupLabel, supervisorName, proposalTitle, rejectionReport }) {
    await notifyGroupMembers(groupId, {
      type: 'proposal_rejected',
      title: 'Proposal Rejected',
      message: `${supervisorName} rejected your proposal "${proposalTitle}". Reason: ${rejectionReport}`,
      proposalId,
      groupId,
      rejectionReport
    });

    await notifyAdmins({
      type: 'proposal_rejected',
      title: 'Proposal Rejected by Supervisor',
      message: `${supervisorName} rejected the proposal from ${groupLabel} group. Report: ${rejectionReport}`,
      proposalId,
      groupId,
      rejectionReport
    });
  }

  async function checkAndNotifyOverdueProposals() {
    const db = getDb();
    const snapshot = await db.collection('proposals')
      .where('assignmentStatus', '==', 'pending_supervisor')
      .get();

    const now = new Date();

    for (const doc of snapshot.docs) {
      const proposal = doc.data();
      if (proposal.adminOverdueNotified) continue;
      if (!proposal.responseDeadline || new Date(proposal.responseDeadline) >= now) continue;

      const groupLabel = proposal.groupId || 'Unknown';
      const supervisorName = proposal.requestedSupervisorName || 'the requested';

      await notifyAdmins({
        type: 'proposal_admin_overdue',
        title: 'Supervisor Response Overdue (7+ days)',
        message: `${groupLabel} group requested ${supervisorName} supervisor over 7 days ago with no response. You may permanently assign the project.`,
        proposalId: doc.id,
        groupId: proposal.groupId,
        supervisorId: proposal.requestedSupervisorId,
        supervisorName: proposal.requestedSupervisorName
      });

      await doc.ref.update({
        adminOverdueNotified: true,
        overdueAt: now.toISOString()
      });
    }
  }

  async function acceptProposal({ proposalId, supervisorId, supervisorName, feedback, groupId, groupLabel, proposalTitle }) {
    const db = getDb();
    const now = new Date().toISOString();

    // Fetch supervisor email so it can be cached on the group doc
    // (students cannot read the users collection for supervisor docs, but supervisors collection is readable)
    let supervisorEmail = '';
    try {
      const supDoc = await db.collection('supervisors').doc(supervisorId).get();
      if (supDoc.exists) supervisorEmail = supDoc.data().email || '';
    } catch (_) {}

    await db.collection('proposals').doc(proposalId).update({
      status: 'approved',
      assignmentStatus: 'accepted',
      supervisorId,
      supervisorName,
      supervisorEmail,
      feedback: feedback || '',
      reviewComment: feedback || '',
      reviewedDate: now,
      reviewedBy: supervisorId
    });

    if (groupId) {
      await db.collection('groups').doc(groupId).update({
        supervisorId,
        supervisorName,
        supervisorEmail,
        assignedAt: now
      });
    }

    await notifyProposalAccepted({ proposalId, groupId, groupLabel, supervisorName, proposalTitle });
  }

  async function rejectProposal({ proposalId, supervisorId, supervisorName, rejectionReport, groupId, groupLabel, proposalTitle }) {
    const db = getDb();
    const now = new Date().toISOString();

    await db.collection('proposals').doc(proposalId).update({
      status: 'rejected',
      assignmentStatus: 'rejected',
      rejectionReport,
      feedback: rejectionReport,
      reviewComment: rejectionReport,
      reviewedDate: now,
      reviewedBy: supervisorId
    });

    await db.collection('feedback').add({
      groupId,
      proposalId,
      type: 'proposal',
      message: rejectionReport,
      supervisorId,
      supervisorName,
      timestamp: now,
      decision: 'rejected'
    });

    await notifyProposalRejected({
      proposalId,
      groupId,
      groupLabel,
      supervisorName,
      proposalTitle,
      rejectionReport
    });
  }

  async function adminPermanentlyAssign({ proposalId, groupId, adminUid }) {
    const db = getDb();
    const proposalDoc = await db.collection('proposals').doc(proposalId).get();
    if (!proposalDoc.exists) throw new Error('Proposal not found');

    const proposal = proposalDoc.data();
    const supervisorId = proposal.requestedSupervisorId || proposal.supervisorId;
    const supervisorName = proposal.requestedSupervisorName || proposal.supervisorName;

    if (!supervisorId) throw new Error('No requested supervisor on this proposal');

    const now = new Date().toISOString();
    const groupLabel = proposal.groupId || groupId || 'Unknown';

    await db.collection('proposals').doc(proposalId).update({
      status: 'assigned',
      assignmentStatus: 'admin_assigned',
      supervisorId,
      supervisorName,
      assignedAt: now,
      assignedBy: adminUid,
      adminForceAssigned: true
    });

    if (groupId) {
      await db.collection('groups').doc(groupId).update({
        supervisorId,
        supervisorName,
        assignedAt: now,
        adminForceAssigned: true
      });
    }

    await sendNotification(supervisorId, {
      type: 'proposal_admin_assigned',
      title: 'Project Permanently Assigned by Admin',
      message: `Admin permanently assigned ${groupLabel} group's proposal "${proposal.title}" to you.`,
      proposalId,
      groupId
    });

    await notifyGroupMembers(groupId, {
      type: 'proposal_admin_assigned',
      title: 'Supervisor Permanently Assigned',
      message: `Admin assigned ${supervisorName} as your permanent supervisor for "${proposal.title}".`,
      proposalId,
      groupId
    });

    await notifyAdmins({
      type: 'proposal_admin_assigned',
      title: 'Proposal Permanently Assigned',
      message: `You permanently assigned ${groupLabel} group to ${supervisorName}.`,
      proposalId,
      groupId
    });
  }

  return {
    RESPONSE_DAYS,
    getDb,
    supervisorDisplayName,
    getResponseDeadline,
    isOverdue,
    getSubmittedDate,
    getDescription,
    fetchAvailableSupervisors,
    getStudentNames,
    notifyProposalSubmitted,
    checkAndNotifyOverdueProposals,
    acceptProposal,
    rejectProposal,
    adminPermanentlyAssign
  };
})();
