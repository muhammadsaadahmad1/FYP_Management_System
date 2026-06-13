// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCljq20BTSxK2mRWicAsfAjh7B8ZTDSNgQ",
  authDomain: "fypmanagementsystem-29faf.firebaseapp.com",
  projectId: "fypmanagementsystem-29faf",
  storageBucket: "fypmanagementsystem-29faf.firebasestorage.app",
  messagingSenderId: "215218060669",
  appId: "1:215218060669:web:2cb287d2aa4b545f50a014",
  measurementId: "G-4DQVXVP3NX"
};

// Initialize Firebase with error handling
let firebaseApp;
let auth, db, storage;

try {
  // Check if Firebase is already initialized
  if (!firebase.apps.length) {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully!');
  } else {
    firebaseApp = firebase.app();
    console.log('Firebase already initialized, using existing instance');
  }

  // Initialize Firebase services
  auth = firebase.auth();
  db = firebase.firestore();
  if (typeof firebase.storage === 'function') {
    storage = firebase.storage();
  } else {
    console.warn('Firebase Storage SDK not loaded — storage features disabled on this page.');
  }

  if (db) {
    try {
      db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
        merge: true
      });
    } catch (settingsErr) {
      console.log('Firestore settings skipped:', settingsErr.message);
    }
  }

} catch (error) {
  console.error('Firebase initialization error:', error);
  if (!auth || !db) {
    console.error('Critical Firebase services unavailable:', error.message);
  }
}

// Export Firebase services for use in other files
window.firebaseServices = {
  auth: auth,
  db: db,
  storage: storage,
  app: firebaseApp
};

// Global aliases used across dashboard scripts (student.js, admin.js, etc.)
window.db = db;
window.auth = auth;
window.storage = storage;

async function verifyFirebaseConnection() {
  if (!db) {
    console.error('Firebase Firestore is not available');
    return false;
  }

  try {
    await db.collection('login_lookup').limit(1).get();
    console.log('Firebase connected — Firestore is reachable');
    return true;
  } catch (error) {
    if (error.code === 'permission-denied') {
      console.log('Firebase connected — sign in to access protected data');
      return true;
    }
    console.error('Firebase connection check failed:', error.code || error.message);
    return false;
  }
}

verifyFirebaseConnection();

function initLogoHomeLinks() {
  const selectors = [
    '.sidebar .logo img',
    '.login-header img',
    '.register-header img',
    '.landing-header .brand > img'
  ];

  document.querySelectorAll(selectors.join(', ')).forEach((img) => {
    if (!img || img.closest('a.logo-home-link')) return;

    const link = document.createElement('a');
    link.href = 'index.html';
    link.className = 'logo-home-link';
    link.setAttribute('aria-label', 'Go to home page');
    img.parentNode.insertBefore(link, img);
    link.appendChild(img);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLogoHomeLinks);
} else {
  initLogoHomeLinks();
}

console.log('Firebase configuration loaded successfully!');
