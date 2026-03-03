// Enhanced Login Function with Firebase
async function login() {
  const email = document.getElementById("email")?.value || document.getElementById("username")?.value;
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;

  if (!email || !password || !role) {
    alert("Please fill in all fields and select a role");
    return;
  }

  // Show loading state
  const loginBtn = document.querySelector(".login-btn");
  const originalText = loginBtn.textContent;
  loginBtn.textContent = "Signing in...";
  loginBtn.disabled = true;

  try {
    // Sign in with Firebase
    const result = await firebaseAuth.signIn(email, password);
    
    if (result.success) {
      // Redirect based on role
      switch (role) {
        case "student":
          window.location.href = "student-dashboard.html";
          break;
        case "admin":
          window.location.href = "admin-dashboard.html";
          break;
        case "supervisor":
          window.location.href = "supervisor-dashboard.html";
          break;
        default:
          throw new Error("Invalid role selected");
      }
    } else {
      alert(result.error || "Login failed. Please try again.");
    }
  } catch (error) {
    console.error("Login error:", error);
    alert("Login failed: " + error.message);
  } finally {
    // Reset button state
    loginBtn.textContent = originalText;
    loginBtn.disabled = false;
  }
}

// Enhanced Registration Function
async function register() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const role = document.getElementById("role").value;
  const displayName = document.getElementById("displayName")?.value || email.split('@')[0];

  if (!email || !password || !confirmPassword || !role) {
    alert("Please fill in all fields");
    return;
  }

  if (password !== confirmPassword) {
    alert("Passwords do not match");
    return;
  }

  if (password.length < 6) {
    alert("Password must be at least 6 characters");
    return;
  }

  // Show loading state
  const registerBtn = document.querySelector(".register-btn");
  const originalText = registerBtn.textContent;
  registerBtn.textContent = "Creating account...";
  registerBtn.disabled = true;

  try {
    // Register with Firebase
    const result = await firebaseAuth.signUp(email, password, role, displayName);
    
    if (result.success) {
      alert("Registration successful! Please sign in.");
      window.location.href = "login.html";
    } else {
      alert(result.error || "Registration failed. Please try again.");
    }
  } catch (error) {
    console.error("Registration error:", error);
    alert("Registration failed: " + error.message);
  } finally {
    // Reset button state
    registerBtn.textContent = originalText;
    registerBtn.disabled = false;
  }
}

// Logout Function
async function logout() {
  try {
    const result = await firebaseAuth.signOut();
    if (result.success) {
      window.location.href = "index.html";
    } else {
      alert("Logout failed: " + result.error);
    }
  } catch (error) {
    console.error("Logout error:", error);
    alert("Logout failed: " + error.message);
  }
}

// Check authentication status
function checkAuth() {
  const user = firebaseAuth.getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

// Legacy function for backward compatibility
function legacyLogin() {
  const role = document.getElementById("role").value;
  if (!role) return alert("Please select a role");

  localStorage.setItem("role", role);

  if (role === "student") location.href = "student-dashboard.html";
  if (role === "admin") location.href = "admin-dashboard.html";
  if (role === "supervisor") location.href = "supervisor-dashboard.html";
}