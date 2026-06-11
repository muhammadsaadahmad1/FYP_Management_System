// Shared UI helpers (notifications, loading overlay)

function showNotification(message, type = 'info') {
  let notificationDiv = document.getElementById('notification');
  if (!notificationDiv) {
    notificationDiv = document.createElement('div');
    notificationDiv.id = 'notification';
    notificationDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 9999;
      max-width: 320px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    document.body.appendChild(notificationDiv);
  }

  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };

  notificationDiv.style.background = colors[type] || colors.info;
  notificationDiv.textContent = message;
  notificationDiv.style.display = 'block';

  setTimeout(() => {
    notificationDiv.style.display = 'none';
  }, 3500);
}

function showLoadingOverlay(message = 'Loading...') {
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
      <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #2563eb; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
      <p style="margin: 0; color: #333;">${message}</p>
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
  if (overlay) overlay.style.display = 'none';
}
