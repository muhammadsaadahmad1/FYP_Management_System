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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Enable offline persistence for Firestore
db.enablePersistence()
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code == 'unimplemented') {
      console.log('The current browser does not support persistence.');
    }
  });

console.log('Firebase initialized successfully!');
