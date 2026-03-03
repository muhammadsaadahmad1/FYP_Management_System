function login() {
  const role = document.getElementById("role").value;
  if (!role) return alert("Please select a role");

  localStorage.setItem("role", role);

  if (role === "student") location.href = "student-dashboard.html";
  if (role === "admin") location.href = "admin-dashboard.html";
  if (role === "supervisor") location.href = "supervisor-dashboard.html";
}