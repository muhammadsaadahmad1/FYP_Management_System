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
  storage = firebase.storage();

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

  // Set up auth state listener
  if (auth) {
    auth.onAuthStateChanged((user) => {
      if (user) {
        console.log('User is signed in:', user.email);
        // Store user session
        localStorage.setItem('user', JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName
        }));
      } else {
        console.log('User is signed out');
        localStorage.removeItem('user');
      }
    });
  }

} catch (error) {
  console.error('Firebase initialization error:', error);
  alert('Firebase initialization failed. Please check your internet connection and try again.');
}

// Export Firebase services for use in other files
window.firebaseServices = {
  auth: auth,
  db: db,
  storage: storage,
  app: firebaseApp
};

console.log('Firebase configuration loaded successfully!');
