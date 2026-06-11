# FYP Management System

A web-based Final Year Project management platform for university students, supervisors, and administrators.

## Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend / Database:** Firebase Authentication, Cloud Firestore, Firebase Storage
- **Hosting:** Firebase Hosting
- **Local dev:** live-server on port 5500

## Firebase Services

| Service | Purpose |
|---------|---------|
| Firebase Auth | Login, registration, session management |
| Cloud Firestore | Users, groups, proposals, reports, meetings, feedback |
| Firebase Storage | Project files, admin documents |
| Firebase Hosting | Production deployment |

## User Roles

- **Student** — group registration, proposals, reports, meetings
- **Supervisor** — review proposals, manage groups, feedback (requires admin approval)
- **Admin** — manage system, assign supervisors, approve accounts

## Run Locally

```bash
cd "FYP management system"
npx live-server --port=5500 --host=localhost --open=/index.html
```

Or double-click `start-localhost.bat`.

## Deploy Firebase Rules

```bash
firebase deploy --only firestore:rules,storage
```

## Project Structure

```
├── index.html              # Landing page
├── login.html              # Role-based login
├── student-register.html   # Student group registration
├── supervisor-register.html
├── admin-register.html
├── js/
│   ├── firebase-config.js  # Firebase initialization
│   ├── firebase-auth.js    # Auth helper class
│   ├── auth-guard.js       # Protected page guards
│   ├── registration.js     # Registration logic
│   ├── student.js          # Student module
│   ├── admin.js            # Admin module
│   └── supervisor.js       # Supervisor module
├── firestore.rules
├── storage.rules
└── firebase.json
```
