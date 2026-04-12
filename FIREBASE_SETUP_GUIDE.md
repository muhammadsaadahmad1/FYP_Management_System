# Firebase Setup & Deployment Guide

## Overview
This guide will help you set up Firebase properly with your FYP Management System and ensure all services are working correctly.

## Quick Setup Steps

### 1. Test Firebase Connection
Open `firebase-setup.html` in your browser and run the "Firebase Connection Test" to verify your configuration.

### 2. Deploy Security Rules
Copy the security rules from `firestore.rules` and deploy them to your Firebase project:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `fypmanagementsystem-29faf`
3. Navigate to **Firestore Database** > **Rules**
4. Replace the existing rules with the content from `firestore.rules`
5. Click **Publish**

### 3. Test All Services
Run the complete system test in `firebase-setup.html` to verify:
- Firebase connection
- Authentication
- Firestore operations
- Security rules

## Firebase Configuration

### Project Details
- **Project ID**: `fypmanagementsystem-29faf`
- **Auth Domain**: `fypmanagementsystem-29faf.firebaseapp.com`
- **Storage Bucket**: `fypmanagementsystem-29faf.firebasestorage.app`

### API Keys
The Firebase configuration is already set up in `js/firebase-config.js` with the correct API keys.

## Security Rules

### Current Rules
The security rules in `firestore.rules` provide:
- **User authentication** for login/registration
- **Collection access** based on user roles
- **Development collections** for testing
- **Secure data access** for production

### Key Features
- Users collection allows read access for login
- All other collections require authentication
- Test collections allow all operations for development
- Proper data isolation between users

## Testing Checklist

### Connection Tests
- [ ] Firebase SDK loads correctly
- [ ] Project connection established
- [ ] Firestore database accessible
- [ ] Authentication service available

### Authentication Tests
- [ ] User registration works
- [ ] User login works
- [ ] Password reset works
- [ ] Session persistence works

### Database Tests
- [ ] Write operations work
- [ ] Read operations work
- [ ] Update operations work
- [ ] Delete operations work
- [ ] Query operations work

### Security Tests
- [ ] Security rules deployed
- [ ] User access control works
- [ ] Data isolation works
- [ ] Unauthorized access blocked

## Common Issues & Solutions

### Issue: "Missing or insufficient permissions"
**Solution**: Deploy the security rules from `firestore.rules`

### Issue: "Firebase initialization failed"
**Solution**: Check internet connection and API keys

### Issue: "User not found"
**Solution**: Ensure user is created in both Auth and Firestore

### Issue: "Connection timeout"
**Solution**: Check network connectivity and Firebase project status

## Production Deployment

### Before Going Live
1. Test all functionality in `firebase-setup.html`
2. Deploy security rules
3. Test registration and login flows
4. Verify dashboard functionality
5. Test all user roles

### Security Checklist
- [ ] Security rules deployed
- [ ] API keys secured
- [ ] User authentication working
- [ ] Data access control working
- [ ] No test collections in production

## Support

If you encounter issues:
1. Check browser console for errors
2. Run the Firebase setup test
3. Verify security rules are deployed
4. Check Firebase project status

## Next Steps

After Firebase is properly set up:
1. Test student registration
2. Test supervisor registration
3. Test admin registration
4. Verify all login flows
5. Test dashboard functionality

Your FYP Management System will be ready for production use!
