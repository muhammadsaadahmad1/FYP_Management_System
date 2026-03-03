// Firebase Authentication Check for Student Dashboard
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    // No user is signed in, redirect to login
    window.location.href = "login.html";
    return;
  }

  try {
    // Get user role from Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.role !== 'student') {
      // User is not a student, redirect to login
      window.location.href = "login.html";
      return;
    }

    // User is authenticated and is a student, load dashboard data
    loadStudentData(user, userData);
  } catch (error) {
    console.error('Error checking user role:', error);
    window.location.href = "login.html";
  }
});

// Load student data from Firestore
async function loadStudentData(user, userData) {
  try {
    // Load student's project data
    const projectsSnapshot = await db.collection('projects')
      .where('studentId', '==', user.uid)
      .get();

    if (!projectsSnapshot.empty) {
      const projectData = projectsSnapshot.docs[0].data();
      updateDashboardWithRealData(projectData);
    } else {
      // Use demo data if no project found
      useDemoData();
    }
  } catch (error) {
    console.error('Error loading student data:', error);
    useDemoData();
  }
}

// Update dashboard with real data from Firestore
function updateDashboardWithRealData(projectData) {
  // Update project title
  const projectTitleElement = document.querySelector('section#proposal p strong');
  if (projectTitleElement && projectData.title) {
    projectTitleElement.nextSibling.textContent = ' ' + projectData.title;
  }

  // Update progress
  if (projectData.progress) {
    document.getElementById('progressFill').style.width = projectData.progress + '%';
    document.querySelector('section#proposal p strong:nth-of-type(3)').nextSibling.textContent = ' ' + projectData.progress + '%';
  }

  // Update status
  if (projectData.status) {
    const statusElement = document.querySelector('.status');
    statusElement.textContent = projectData.status;
    statusElement.className = 'status ' + (projectData.status.toLowerCase() === 'approved' ? 'approved' : 'pending');
  }
}

// Use demo data as fallback
function useDemoData() {
  console.log('Using demo data - no project found in Firestore');
  document.getElementById("progressFill").style.width = "72%";
}

// Tab switching functionality
function showSection(id, btn) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));

  document.getElementById(id).classList.add("active");
  btn.classList.add("active");
}

// Enhanced logout function with Firebase
async function logout() {
  try {
    await firebaseAuth.signOut();
    window.location.href = "login.html";
  } catch (error) {
    console.error('Logout error:', error);
    // Fallback to localStorage logout
    localStorage.clear();
    window.location.href = "login.html";
  }
}

const data = {
  project: "Smart Attendance System",
  status: "Approved",
  progress: 70,
  deadlines: ["Mid Evaluation – 15 Jan", "Final Defense – 10 May"]
};

document.getElementById("projectTitle").innerText = data.project;
document.getElementById("proposalStatus").innerText = data.status;
document.getElementById("progressBar").style.width = data.progress + "%";

data.deadlines.forEach(d => {
  const li = document.createElement("li");
  li.innerText = d;
  document.getElementById("deadlines").appendChild(li);
});