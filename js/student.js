if (localStorage.getItem("role") !== "student") location.href = "login.html";

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