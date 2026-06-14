/**
 * Store report PDFs as gzip-compressed Base64 in Firestore (no Firebase Storage).
 */
const ReportFileStore = (() => {
  const MAX_ORIGINAL_BYTES = 5 * 1024 * 1024;
  const MAX_STORED_BASE64_CHARS = 850000;

  function ensurePako() {
    if (typeof pako === 'undefined') {
      throw new Error('Compression library not loaded. Please refresh the page.');
    }
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

  function getBlobFromReport(report) {
    if (!report) return null;

    if (report.fileBase64 && report.fileEncoding === 'gzip-base64') {
      ensurePako();
      const compressed = base64ToUint8(report.fileBase64);
      const decompressed = pako.ungzip(compressed);
      return new Blob([decompressed], { type: report.fileMimeType || 'application/pdf' });
    }

    const url = report.downloadURL || report.fileLink || report.fileUrl || report.documentUrl;
    if (url) return { externalUrl: url };

    return null;
  }

  async function preparePdfForFirestore(file) {
    if (!file) return null;

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    if (!isPdf) {
      throw new Error('Only PDF report files are supported.');
    }

    if (file.size > MAX_ORIGINAL_BYTES) {
      throw new Error('PDF is too large. Maximum size is 5 MB.');
    }

    ensurePako();
    const originalBytes = new Uint8Array(await file.arrayBuffer());
    const compressed = pako.gzip(originalBytes);
    const fileBase64 = uint8ToBase64(compressed);

    if (fileBase64.length > MAX_STORED_BASE64_CHARS) {
      throw new Error(
        'PDF is still too large after compression. Try a shorter document or reduce embedded images.'
      );
    }

    return {
      fileBase64,
      fileEncoding: 'gzip-base64',
      fileMimeType: 'application/pdf',
      fileName: file.name,
      originalFileSize: file.size,
      storedFileSize: compressed.length,
      fileStorageSkipped: false
    };
  }

  function hasStoredFile(report) {
    return Boolean(
      report &&
      (report.fileBase64 ||
        report.downloadURL ||
        report.fileLink ||
        report.fileUrl ||
        report.documentUrl)
    );
  }

  function openReportFile(report) {
    const blobResult = getBlobFromReport(report);
    if (!blobResult) {
      throw new Error('No report file is attached.');
    }

    if (blobResult.externalUrl) {
      window.open(blobResult.externalUrl, '_blank', 'noopener');
      return;
    }

    const url = URL.createObjectURL(blobResult);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function downloadReportFile(report) {
    const blobResult = getBlobFromReport(report);
    if (!blobResult) {
      throw new Error('No report file is attached.');
    }

    if (blobResult.externalUrl) {
      const link = document.createElement('a');
      link.href = blobResult.externalUrl;
      link.download = report.fileName || report.title || 'report.pdf';
      link.target = '_blank';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const url = URL.createObjectURL(blobResult);
    const link = document.createElement('a');
    link.href = url;
    link.download = report.fileName || report.title || 'report.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function getDocumentActionsHtml(report, reportId) {
    if (!hasStoredFile(report)) return '';

    const id = reportId || report.id || '';
    return `
      <h4>Document</h4>
      <p>
        <button type="button" class="btn btn-primary" style="margin-right:10px;"
          onclick="ReportFileStore.openReportFile(window.__reportFileLookup && window.__reportFileLookup['${id}'])">
          <i class="fas fa-external-link-alt"></i> Open PDF
        </button>
        <button type="button" class="btn btn-secondary"
          onclick="ReportFileStore.downloadReportFile(window.__reportFileLookup && window.__reportFileLookup['${id}'])">
          <i class="fas fa-download"></i> Download
        </button>
      </p>
      ${report.originalFileSize ? `<p style="font-size:13px;color:#6b7280;">Original: ${formatBytes(report.originalFileSize)}${report.storedFileSize ? ` · Stored compressed: ${formatBytes(report.storedFileSize)}` : ''}</p>` : ''}
    `;
  }

  function registerReportLookup(reports) {
    window.__reportFileLookup = window.__reportFileLookup || {};
    (reports || []).forEach((report) => {
      if (report && report.id) window.__reportFileLookup[report.id] = report;
    });
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  return {
    preparePdfForFirestore,
    hasStoredFile,
    openReportFile,
    downloadReportFile,
    getDocumentActionsHtml,
    registerReportLookup,
    formatBytes
  };
})();
