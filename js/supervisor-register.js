// Supervisor Registration System
class SupervisorRegistration {
  constructor() {
    this.form = document.getElementById('supervisorRegistrationForm');
    this.isSubmitting = false;
  }

  async initialize() {
    try {
      // Add form submit listener
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.isSubmitting) {
          this.handleSubmit();
        }
      });
    } catch (error) {
      console.error('Registration initialization error:', error);
      showNotification('Error initializing registration form', 'error');
    }
  }

  async handleSubmit() {
    try {
      this.isSubmitting = true;
      showLoadingOverlay('Creating supervisor account...');
      
      // Get form data
      const formData = new FormData(this.form);
      const registrationData = {
        fullName: formData.get('fullName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        employeeId: formData.get('employeeId'),
        department: formData.get('department'),
        designation: formData.get('designation'),
        expertise: formData.get('expertise'),
        qualificationDoc: await this.uploadQualificationDoc(formData.get('qualificationDoc')),
        status: 'pending_approval',
        registeredAt: new Date().toISOString(),
        emailVerified: false,
        approvedBy: null,
        approvedAt: null
      };

      // Validate form data
      const validation = this.validateSupervisorForm(registrationData);
      if (!validation.isValid) {
        showNotification(validation.error, 'error');
        return;
      }

      // Create Firebase Auth account
      const userCredential = await firebase.auth()
        .createUserWithEmailAndPassword(registrationData.email, 'tempPassword123!');

      // Send email verification
      await userCredential.user.sendEmailVerification();

      // Store supervisor data in Firestore
      await firebase.firestore().collection('supervisors').add({
        ...registrationData,
        uid: userCredential.user.uid,
        password: 'tempPassword123!' // Will be updated after approval
      });

      showNotification('Registration submitted! Please check your email for verification.', 'success');
      
      // Clear form
      this.form.reset();
      
    } catch (error) {
      console.error('Registration error:', error);
      showNotification('Registration failed: ' + error.message, 'error');
    } finally {
      this.isSubmitting = false;
      hideLoadingOverlay();
    }
  }

  validateSupervisorForm(data) {
    const errors = [];

    // Validate full name
    if (!data.fullName || data.fullName.trim().length < 3) {
      errors.push('Full name must be at least 3 characters long');
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email || !emailRegex.test(data.email)) {
      errors.push('Please enter a valid email address');
    }

    // Validate employee ID
    if (!data.employeeId || data.employeeId.trim().length < 3) {
      errors.push('Employee ID must be at least 3 characters long');
    }

    // Validate department
    if (!data.department) {
      errors.push('Please select a department');
    }

    // Validate designation
    if (!data.designation || data.designation.trim().length < 2) {
      errors.push('Designation must be at least 2 characters long');
    }

    // Validate expertise
    if (!data.expertise || data.expertise.trim().length < 10) {
      errors.push('Areas of expertise must be at least 10 characters long');
    }

    // Validate qualification document
    if (!data.qualificationDoc) {
      errors.push('Please upload your qualification document');
    }

    return {
      isValid: errors.length === 0,
      error: errors.join(', ')
    };
  }

  async uploadQualificationDoc(file) {
    try {
      if (!file) {
        return null;
      }

      // Upload to Firebase Storage
      const storageRef = firebase.storage().ref();
      const fileRef = storageRef.child(`qualifications/${Date.now()}_${file.name}`);
      
      await fileRef.put(file);
      const downloadURL = await fileRef.getDownloadURL();
      
      return {
        name: file.name,
        size: file.size,
        type: file.type,
        url: downloadURL
      };
    } catch (error) {
      console.error('Qualification document upload error:', error);
      showNotification('Error uploading qualification document', 'error');
      return null;
    }
  }
}

// Initialize registration system
document.addEventListener('DOMContentLoaded', () => {
  const registration = new SupervisorRegistration();
  registration.initialize();
});
