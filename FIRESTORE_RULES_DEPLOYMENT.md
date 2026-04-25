# 🔥 Firestore Rules Deployment Instructions

## 🚨 Issue: "Missing or insufficient permissions" Error

The registration is failing because Firestore security rules don't allow writes to `supervisors` and `admins` collections.

## ✅ Solution: Update Firestore Rules

### Step 1: Go to Firebase Console
1. Visit: https://console.firebase.google.com/
2. Select project: `fypmanagementsystem-29faf`
3. Navigate to: **Firestore Database** → **Rules** tab

### Step 2: Replace Rules
Copy and paste the complete rules below:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all operations for development
    match /{document=**} {
      allow read, write, create, update, delete: if true;
    }
    
    // Users collection - allow all operations for registration
    match /users/{userId} {
      allow read: if true;
      allow create: if true;
      allow write: if true;
      allow update: if true;
      allow delete: if true;
    }
    
    // Groups collection - allow all operations for registration
    match /groups/{groupId} {
      allow read: if true;
      allow create: if true;
      allow write: if true;
      allow update: if true;
      allow delete: if true;
    }
    
    // Projects collection
    match /projects/{projectId} {
      allow read, write, create, update, delete: if true;
    }
    
    // Proposals collection
    match /proposals/{proposalId} {
      allow read, write, create, update, delete: if true;
    }
    
    // Reports collection
    match /reports/{reportId} {
      allow read, write, create, update, delete: if true;
    }
    
    // Meetings collection
    match /meetings/{meetingId} {
      allow read, write, create, update, delete: if true;
    }
    
    // Test collection
    match /test_collection/{docId} {
      allow read, write, create, update, delete: if true;
    }
    
    // Public collection
    match /public/{docId} {
      allow read, write, create, update, delete: if true;
    }
    
    // System collection
    match /system/{docId} {
      allow read, write, create, update, delete: if true;
    }
    
    // Supervisors collection - allow all operations for registration
    match /supervisors/{supervisorId} {
      allow read: if true;
      allow create: if true;
      allow write: if true;
      allow update: if true;
      allow delete: if true;
    }
    
    // Admins collection - allow all operations for registration
    match /admins/{adminId} {
      allow read: if true;
      allow create: if true;
      allow write: if true;
      allow update: if true;
      allow delete: if true;
    }
  }
}
```

### Step 3: Publish Rules
1. Click **Publish** button
2. Wait for confirmation that rules are published

## 🎯 What This Fixes

- ✅ Supervisor registration can write to `supervisors` collection
- ✅ Admin registration can write to `admins` collection
- ✅ Student registration can write to `users` collection
- ✅ Group registration can write to `groups` collection
- ✅ All registration types will work without permission errors

## 🚀 After Deployment

Once rules are published:
1. Test supervisor registration
2. Test admin registration  
3. Test student group registration
4. All should work without "Missing or insufficient permissions" error

## 📝 Alternative: CLI Deployment (If Console Not Working)

If you prefer CLI, try these commands:
```bash
firebase logout
firebase login
firebase deploy --only firestore
```

## 🔍 Troubleshooting

If still getting errors:
1. Check Firebase project ID is correct: `fypmanagementsystem-29faf`
2. Ensure you're logged into correct Google account
3. Try clearing browser cache and re-login to Firebase Console
4. Verify rules syntax has no errors before publishing
