// Firebase Authentication System
class FirebaseAuth {
  constructor() {
    this.auth = firebase.auth();
    this.db = firebase.firestore();
    this.setupAuthListener();
  }

  // Listen to authentication state changes
  setupAuthListener() {
    this.auth.onAuthStateChanged((user) => {
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

  // Sign up with email and password
  async signUp(email, password, role, displayName) {
    try {
      // Create user in Firebase Auth
      const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Update display name
      await user.updateProfile({ displayName });

      // Store user role and additional info in Firestore
      await this.db.collection('users').doc(user.uid).set({
        uid: user.uid,
        email: email,
        displayName: displayName,
        role: role,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        isActive: true
      });

      console.log('User registered successfully!');
      return { success: true, user };
    } catch (error) {
      console.error('Registration error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Sign in with email and password
  async signIn(email, password) {
    try {
      const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Get user role from Firestore
      const userDoc = await this.db.collection('users').doc(user.uid).get();
      const userData = userDoc.data();

      console.log('User data from Firestore:', userData);
      console.log('isActive value:', userData?.isActive);

      // Check if user exists and is active (or if isActive field doesn't exist, assume active for backward compatibility)
      if (userData && (userData.isActive !== false)) {
        // Store role in localStorage for easy access
        localStorage.setItem('role', userData.role);
        
        console.log('User signed in successfully!');
        return { success: true, user, role: userData.role };
      } else {
        console.log('Account not active or user data missing');
        await this.auth.signOut();
        return { success: false, error: 'Account is not active' };
      }
    } catch (error) {
      console.error('Sign in error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Sign out
  async signOut() {
    try {
      await this.auth.signOut();
      localStorage.removeItem('role');
      console.log('User signed out successfully!');
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get current user
  getCurrentUser() {
    return this.auth.currentUser;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return this.auth.currentUser !== null;
  }

  // Get user role
  async getUserRole() {
    const user = this.getCurrentUser();
    if (!user) return null;

    try {
      const userDoc = await this.db.collection('users').doc(user.uid).get();
      const userData = userDoc.data();
      return userData ? userData.role : null;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  }
}

// Initialize Firebase Auth
const firebaseAuth = new FirebaseAuth();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FirebaseAuth;
}
