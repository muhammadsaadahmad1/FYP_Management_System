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

  // Enable offline persistence for Firestore using new API with better error handling
  if (db) {
    // Try the new cache API first (recommended)
    try {
      db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
      });
      db.enableNetwork()
        .then(() => {
          console.log('Firestore cache configured and network enabled');
        })
        .catch((err) => {
          console.log('Network enable error:', err);
        });
    } catch (settingsErr) {
      // Fallback to the old persistence method if settings API fails
      db.enablePersistence()
        .then(() => {
          console.log('Firestore offline persistence enabled (legacy method)');
        })
        .catch((err) => {
          if (err.code === 'failed-precondition') {
            console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
          } else if (err.code === 'unimplemented') {
            console.log('The current browser does not support persistence.');
          } else {
            console.log('Persistence error:', err);
          }
        });
    }
  }

} catch (error) {
  console.error('Firebase initialization error:', error);
  // Only alert if core services failed — don't block the page for optional features
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

console.log('Firebase configuration loaded successfully!');
