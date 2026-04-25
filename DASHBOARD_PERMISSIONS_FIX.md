# Fix Student Dashboard "Insufficient Permissions" Error

## 🚨 **Problem:**
Student dashboard shows "insufficient permissions" error because Firestore security rules are too restrictive.

## 🔧 **Quick Fix:**

### **Step 1: Open Firebase Console**
1. Go to: https://console.firebase.google.com/
2. Select your project: `fypmanagementsystem-29faf`
3. Go to Firestore Database
4. Click "Rules" tab

### **Step 2: Replace Rules**
**Delete all existing rules** and paste this:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own user data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Groups collection - allow authenticated users to access
    match /groups/{groupId} {
      allow read, write: if request.auth != null;
      
      // Group members subcollection
      match /members/{memberId} {
        allow read, write: if request.auth != null;
      }
      
      // Group supervisors subcollection
      match /supervisors/{supervisorId} {
        allow read, write: if request.auth != null;
      }
    }
    
    // Files collection - allow authenticated users to access
    match /files/{fileId} {
      allow read, write: if request.auth != null;
    }
    
    // Reports collection - allow authenticated users to access
    match /reports/{reportId} {
      allow read, write: if request.auth != null;
    }
    
    // Proposals collection - allow authenticated users to access
    match /proposals/{proposalId} {
      allow read, write: if request.auth != null;
    }
    
    // Meetings collection - allow authenticated users to access
    match /meetings/{meetingId} {
      allow read, write: if request.auth != null;
    }
    
    // Feedback collection - allow authenticated users to access
    match /feedback/{feedbackId} {
      allow read, write: if request.auth != null;
    }
    
    // Deadlines collection - allow authenticated users to access
    match /deadlines/{deadlineId} {
      allow read, write: if request.auth != null;
    }
    
    // Announcements collection - allow authenticated users to access
    match /announcements/{announcementId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### **Step 3: Publish**
Click "Publish" to save the rules.

## ✅ **After Publishing:**

1. **Wait 2-3 minutes** for rules to propagate
2. **Refresh your student dashboard**
3. **Dashboard should load without permission errors**

## 🎯 **Expected Result:**

- ✅ **Student dashboard loads properly**
- ✅ **All dashboard sections work**
- ✅ **No more permission errors**
- ✅ **Data displays correctly**

## 🔍 **Verification:**

Test these dashboard features:
- ✅ Recent activity
- ✅ Proposals section
- ✅ Meetings section
- ✅ Reports section
- ✅ Group information

## ⚠️ **Security Note:**

These rules allow any authenticated user to access any data. For production, implement proper group-based access control.

## 📞 **Alternative: Ultra-Permissive Rules**

If still having issues, use these rules temporarily:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Deploy the rules and your student dashboard should work immediately!** 🌟
