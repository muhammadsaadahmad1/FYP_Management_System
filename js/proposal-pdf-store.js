/**
 * PDF proposal storage: gzip + base64 in Firestore (no Firebase Storage).
 * PDF bytes live in proposalFiles/{proposalId}; proposal doc keeps metadata only.
 */
const ProposalPdfStore = (() => {
  const MAX_ORIGINAL_BYTES = 5 * 1024 * 1024;
  const CHUNK_BASE64_CHARS = 700000;
  const MAX_CHUNKS = 12;

  function ensurePako() {
    if (typeof pako === 'undefined') {
      throw new Error('Compression library not loaded. Please refresh the page.');
    }
  }

  function getDb(dbOverride) {
    if (dbOverride) return dbOverride;
    if (typeof db !== 'undefined') return db;
    if (typeof firebase !== 'undefined' && firebase.firestore) return firebase.firestore();
    throw new Error('Firestore is not available.');
  }

  function uint8ToBase64(bytes) {
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function base64ToUint8(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function splitBase64String(base64, chunkSize) {
    const chunks = [];
    for (let i = 0; i < base64.length; i += chunkSize) {
      chunks.push(base64.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async function prepareProposalPdfUpload(file) {
    if (!file) {
      throw new Error('Please select a PDF proposal file.');
    }

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    if (!isPdf) {
      throw new Error('Only PDF files are supported for proposal upload.');
    }

    if (file.size > MAX_ORIGINAL_BYTES) {
      throw new Error('PDF is too large. Maximum size is 5 MB.');
    }

    ensurePako();
    const originalBytes = new Uint8Array(await file.arrayBuffer());
    const compressed = pako.gzip(originalBytes);
    const proposalPDF = uint8ToBase64(compressed);
    const chunkCount = Math.max(1, Math.ceil(proposalPDF.length / CHUNK_BASE64_CHARS));

    if (chunkCount > MAX_CHUNKS) {
      throw new Error('PDF is too large after compression. Try reducing images or pages.');
    }

    return {
      proposalPDF,
      proposalFileName: file.name || 'proposal.pdf',
      proposalPDFEncoding: 'gzip-base64',
      originalFileSize: file.size,
      storedFileSize: compressed.length,
      proposalPDFStorage: chunkCount > 1 ? 'chunked' : 'single',
      proposalPDFChunkCount: chunkCount
    };
  }

  function buildProposalDocumentFields(prepared, uploadedAt) {
    const uploaded = uploadedAt || new Date().toISOString();
    return {
      proposalFileName: prepared.proposalFileName,
      uploadedAt: uploaded,
      proposalPDFEncoding: prepared.proposalPDFEncoding,
      proposalPDFStorage: prepared.proposalPDFStorage,
      proposalPDFChunkCount: prepared.proposalPDFChunkCount,
      originalFileSize: prepared.originalFileSize,
      storedFileSize: prepared.storedFileSize,
      status: 'pending'
    };
  }

  async function persistProposalPdf(dbOverride, proposalId, prepared) {
    const db = getDb(dbOverride);
    const fileRef = db.collection('proposalFiles').doc(proposalId);
    const commonMeta = {
      proposalFileName: prepared.proposalFileName,
      proposalPDFEncoding: prepared.proposalPDFEncoding,
      storedFileSize: prepared.storedFileSize,
      updatedAt: new Date().toISOString()
    };

    try {
      if (prepared.proposalPDFStorage === 'single') {
        await fileRef.set({
          ...commonMeta,
          storageMode: 'single',
          proposalPDF: prepared.proposalPDF,
          chunkCount: 1
        });
        return;
      }

      const chunks = splitBase64String(prepared.proposalPDF, CHUNK_BASE64_CHARS);
      await fileRef.set({
        ...commonMeta,
        storageMode: 'chunked',
        chunkCount: chunks.length
      });

      const batch = db.batch();
      chunks.forEach((data, index) => {
        batch.set(fileRef.collection('chunks').doc(String(index).padStart(4, '0')), { index, data });
      });
      await batch.commit();
    } catch (error) {
      if (error && error.code === 'permission-denied') {
        throw new Error(
          'Permission denied saving proposal PDF. Deploy updated Firestore rules for the proposalFiles collection.'
        );
      }
      throw error;
    }
  }

  function mergeFirestoreDoc(snap) {
    if (!snap || !snap.exists) return null;
    return { ...snap.data(), id: snap.id };
  }

  async function fetchProposalById(proposalId, dbOverride) {
    if (!proposalId) return null;
    const db = getDb(dbOverride);
    const snap = await db.collection('proposals').doc(String(proposalId)).get();
    return mergeFirestoreDoc(snap);
  }

  async function resolveProposal(proposalOrId, lookupKey = '__proposalPdfLookup', dbOverride) {
    if (proposalOrId && typeof proposalOrId === 'object') {
      if (!proposalOrId.id) return null;
      return { ...proposalOrId, id: proposalOrId.id };
    }

    const proposalId = String(proposalOrId || '').trim();
    if (!proposalId || proposalId === 'undefined' || proposalId === 'null') return null;

    window[lookupKey] = window[lookupKey] || {};
    if (window[lookupKey][proposalId]) {
      return { ...window[lookupKey][proposalId], id: proposalId };
    }

    const proposal = await fetchProposalById(proposalId, dbOverride);
    if (proposal) {
      proposal.id = proposalId;
      window[lookupKey][proposalId] = proposal;
    }
    return proposal;
  }

  async function loadProposalPdfBase64(dbOverride, proposal, explicitProposalId) {
    const proposalId = explicitProposalId || (proposal && proposal.id);
    if (!proposalId) {
      throw new Error('Proposal not found.');
    }

    if (proposal && proposal.proposalPDF && proposal.proposalPDFEncoding === 'gzip-base64') {
      return proposal.proposalPDF;
    }

    if (proposal && proposal.fileBase64 && proposal.fileEncoding === 'gzip-base64') {
      return proposal.fileBase64;
    }

    const db = getDb(dbOverride);
    const fileRef = db.collection('proposalFiles').doc(String(proposalId));
    const metaSnap = await fileRef.get();

    if (!metaSnap.exists) {
      throw new Error('Proposal PDF not found. The file may not have uploaded correctly — please submit the proposal again.');
    }

    const meta = metaSnap.data();
    if (meta.proposalPDF) {
      return meta.proposalPDF;
    }

    const chunksSnap = await fileRef.collection('chunks').orderBy('index').get();
    if (chunksSnap.empty) {
      throw new Error('Proposal PDF not found. The file may not have uploaded correctly — please submit the proposal again.');
    }

    return chunksSnap.docs.map((doc) => doc.data().data || '').join('');
  }

  async function getPdfBlob(proposal, dbOverride, proposalId) {
    const base64 = await loadProposalPdfBase64(dbOverride, proposal, proposalId);
    ensurePako();
    const compressed = base64ToUint8(base64);
    const decompressed = pako.ungzip(compressed);
    return new Blob([decompressed], { type: 'application/pdf' });
  }

  function hasProposalPdf(proposal) {
    if (!proposal) return false;
    return Boolean(
      proposal.proposalPDF ||
      proposal.proposalPDFStorage === 'single' ||
      proposal.proposalPDFStorage === 'chunked' ||
      proposal.fileBase64
    );
  }

  function ensureViewerModal() {
    if (document.getElementById('proposalPdfViewerModal')) return;

    document.body.insertAdjacentHTML(
      'beforeend',
      `
      <div id="proposalPdfViewerModal" class="modal" style="display:none; z-index:10000;">
        <div class="modal-content" style="max-width:960px; width:95%; height:90vh; margin:2vh auto; padding:0; display:flex; flex-direction:column;">
          <div class="modal-header" style="padding:16px 20px; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center;">
            <h3 id="proposalPdfViewerTitle" style="margin:0;">Proposal PDF</h3>
            <button type="button" class="btn btn-secondary" onclick="ProposalPdfStore.closeViewer()">&times; Close</button>
          </div>
          <iframe id="proposalPdfViewerFrame" title="Proposal PDF preview" style="flex:1; width:100%; border:none;"></iframe>
        </div>
      </div>
    `
    );

    const modal = document.getElementById('proposalPdfViewerModal');
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeViewer();
    });
  }

  let activeObjectUrl = null;

  function closeViewer() {
    const modal = document.getElementById('proposalPdfViewerModal');
    const frame = document.getElementById('proposalPdfViewerFrame');
    if (frame) frame.removeAttribute('src');
    if (modal) modal.style.display = 'none';
    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = null;
    }
  }

  async function showViewer(proposal, dbOverride, proposalId) {
    ensureViewerModal();
    const modal = document.getElementById('proposalPdfViewerModal');
    const frame = document.getElementById('proposalPdfViewerFrame');
    const title = document.getElementById('proposalPdfViewerTitle');

    if (typeof showLoadingOverlay === 'function') {
      showLoadingOverlay('Loading proposal PDF...');
    }

    try {
      const blob = await getPdfBlob(proposal, dbOverride, proposalId || proposal?.id);
      if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = URL.createObjectURL(blob);
      if (title) {
        title.textContent = proposal.proposalFileName || proposal.fileName || 'Proposal PDF';
      }
      frame.src = activeObjectUrl;
      modal.style.display = 'block';
    } finally {
      if (typeof hideLoadingOverlay === 'function') hideLoadingOverlay();
    }
  }

  async function downloadPdf(proposal, dbOverride, proposalId) {
    const blob = await getPdfBlob(proposal, dbOverride, proposalId || proposal?.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = proposal.proposalFileName || proposal.fileName || 'proposal.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function savePreparedPdf(dbOverride, proposalId, prepared) {
    await persistProposalPdf(dbOverride, proposalId, prepared);
  }

  function registerLookup(proposals, lookupKey = '__proposalPdfLookup') {
    window[lookupKey] = window[lookupKey] || {};
    (proposals || []).forEach((proposal) => {
      if (proposal && proposal.id) {
        window[lookupKey][proposal.id] = { ...proposal, id: proposal.id };
      }
    });
  }

  async function viewProposalById(proposalId, lookupKey = '__proposalPdfLookup', dbOverride) {
    const normalizedId = String(proposalId || '').trim();
    if (!normalizedId || normalizedId === 'undefined' || normalizedId === 'null') {
      throw new Error('Proposal not found.');
    }

    const proposal = await resolveProposal(normalizedId, lookupKey, dbOverride);
    if (!proposal) throw new Error('Proposal not found.');
    await showViewer(proposal, dbOverride, normalizedId);
  }

  async function downloadPdfById(proposalId, lookupKey = '__proposalPdfLookup', dbOverride) {
    const normalizedId = String(proposalId || '').trim();
    if (!normalizedId || normalizedId === 'undefined' || normalizedId === 'null') {
      throw new Error('Proposal not found.');
    }

    const proposal = await resolveProposal(normalizedId, lookupKey, dbOverride);
    if (!proposal) throw new Error('Proposal not found.');
    await downloadPdf(proposal, dbOverride, normalizedId);
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  return {
    prepareProposalPdfUpload,
    buildProposalDocumentFields,
    persistProposalPdf,
    savePreparedPdf,
    loadProposalPdfBase64,
    getPdfBlob,
    hasProposalPdf,
    showViewer,
    closeViewer,
    downloadPdf,
    registerLookup,
    fetchProposalById,
    resolveProposal,
    viewProposalById,
    downloadPdfById,
    formatBytes
  };
})();
