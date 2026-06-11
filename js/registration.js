// Shared registration logic for role-specific registration pages

function waitForFirebase() {
  return new Promise((resolve) => {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
      resolve();
    } else {
      setTimeout(() => waitForFirebase().then(resolve), 100);
    }
  });
}

function checkPasswordStrength(password) {
  const strengthBar = document.getElementById('strengthBar');
  const strengthText = document.getElementById('strengthText');
  if (!strengthBar || !strengthText) return;

  let strength = 0;
  if (password.length >= 6) strength++;
  if (password.length >= 10) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;

  strengthBar.className = 'strength-bar';
  strengthText.className = 'strength-text';

  if (password.length === 0) {
    strengthText.textContent = 'Enter password';
  } else if (strength <= 2) {
    strengthBar.classList.add('weak');
    strengthText.textContent = 'Weak password';
  } else if (strength <= 4) {
    strengthBar.classList.add('medium');
    strengthText.textContent = 'Medium strength';
  } else {
    strengthBar.classList.add('strong');
    strengthText.textContent = 'Strong password';
  }
}

function highlightInvalidField(field) {
  document.querySelectorAll('.field-invalid').forEach((el) => el.classList.remove('field-invalid'));
  field.classList.add('field-invalid');
  field.focus();
  field.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function validatePasswordFields() {
  const password = document.getElementById('password');
  const confirmPassword = document.getElementById('confirmPassword');
  const termsAccepted = document.getElementById('termsAccepted');

  if (!password || password.value.length < 6) {
    highlightInvalidField(password);
    alert('Please set a valid password (minimum 6 characters).');
    return false;
  }

  if (!confirmPassword || confirmPassword.value !== password.value) {
    highlightInvalidField(confirmPassword);
    alert('Passwords do not match.');
    return false;
  }

  if (termsAccepted && !termsAccepted.checked) {
    alert('Please accept the Terms & Conditions to continue.');
    return false;
  }

  return true;
}

function setStudentGroupSize(size) {
  const groupSizeInput = document.getElementById('groupSize');
  if (groupSizeInput) groupSizeInput.value = size;

  document.querySelectorAll('.group-size-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.size === String(size));
  });

  const member2 = document.getElementById('member2');
  const member3 = document.getElementById('member3');
  if (member2) member2.style.display = size >= 2 ? 'block' : 'none';
  if (member3) member3.style.display = size >= 3 ? 'block' : 'none';

  const studentFormFields = document.getElementById('studentFormFields');
  if (studentFormFields) studentFormFields.style.display = 'block';
}

function getStudentMemberData(groupSize) {
  const members = [];

  for (let i = 1; i <= groupSize; i++) {
    const registrationNumber = document.getElementById(`studentId${i}`)?.value.trim();
    const fullName = document.getElementById(`fullName${i}`)?.value.trim();
    const email = document.getElementById(`email${i}`)?.value.trim();
    const department = document.getElementById(`department${i}`)?.value.trim();
    const batch = document.getElementById(`batch${i}`)?.value;
    const classNumber = document.getElementById(`classNumber${i}`)?.value.trim() || '';
    const section = document.getElementById(`section${i}`)?.value || '';
    const countryCode = document.getElementById(`countryCode${i}`)?.value || '+92';
    const phone = document.getElementById(`phone${i}`)?.value.trim() || '';

    const fields = [
      [`studentId${i}`, registrationNumber, `Registration number for Student ${i}`],
      [`fullName${i}`, fullName, `Full name for Student ${i}`],
      [`email${i}`, email, `Email for Student ${i}`],
      [`department${i}`, department, `Medium for Student ${i}`],
      [`batch${i}`, batch, `Batch for Student ${i}`],
      [`classNumber${i}`, classNumber, `Class number for Student ${i}`],
      [`section${i}`, section, `Section for Student ${i}`],
      [`phone${i}`, phone, `Phone for Student ${i}`]
    ];

    for (const [id, value, label] of fields) {
      if (!value) {
        highlightInvalidField(document.getElementById(id));
        alert(`Please fill in ${label}.`);
        return null;
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      highlightInvalidField(document.getElementById(`email${i}`));
      alert(`Invalid email address for Student ${i}.`);
      return null;
    }

    members.push({
      registrationNumber,
      loginId: registrationNumber,
      fullName,
      email,
      medium: department,
      batch,
      classNumber,
      section,
      phone: countryCode + phone,
      role: 'student',
      isGroupLeader: i === 1
    });
  }

  return members;
}

async function generateGroupId() {
  const snapshot = await firebase.firestore().collection('groups').get();
  let maxId = 0;

  snapshot.forEach((doc) => {
    const groupId = doc.data().groupId;
    const idNum = parseInt(String(groupId).replace('GRP', ''), 10);
    if (!Number.isNaN(idNum) && idNum > maxId) maxId = idNum;
  });

  const nextId = maxId + 1;
  if (nextId > 1000) throw new Error('Maximum group limit reached (1000 groups)');
  return `GRP${nextId.toString().padStart(4, '0')}`;
}

async function createStudentFirestoreDocs(user, member, groupId) {
  await firebase.firestore().collection('users').doc(user.uid).set({
    uid: user.uid,
    email: member.email,
    loginId: member.loginId,
    displayName: member.fullName,
    role: 'student',
    groupId,
    isGroupLeader: member.isGroupLeader,
    registrationNumber: member.registrationNumber,
    medium: member.medium,
    batch: member.batch,
    classNumber: member.classNumber,
    section: member.section,
    phone: member.phone,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    isActive: true
  });

  await firebase.firestore().collection('login_lookup').doc(member.registrationNumber).set({
    email: member.email,
    groupId,
    role: 'student',
    uid: user.uid
  });
}

async function registerStudentGroup() {
  await waitForFirebase();

  const groupSize = parseInt(document.getElementById('groupSize')?.value, 10);
  if (!groupSize || (groupSize !== 2 && groupSize !== 3)) {
    alert('Please select a group size (2 or 3 students).');
    return;
  }

  const members = getStudentMemberData(groupSize);
  if (!members) return;
  if (!validatePasswordFields()) return;

  const password = document.getElementById('password').value;
  const registerBtn = document.getElementById('registerBtn');
  registerBtn.disabled = true;
  registerBtn.textContent = 'Registering...';

  try {
    // Check emails before creating any accounts
    for (const member of members) {
      const signInMethods = await firebase.auth().fetchSignInMethodsForEmail(member.email);
      if (signInMethods.length > 0) {
        throw new Error(
          `Email ${member.email} is already registered in Firebase Auth. ` +
          'Delete it from Authentication → Users in the Firebase Console, then try again.'
        );
      }
    }

    // Create leader first so Firestore rules allow groups read/write (requires signedIn)
    const leader = members[0];
    const leaderCredential = await firebase.auth().createUserWithEmailAndPassword(leader.email, password);
    const leaderUser = leaderCredential.user;
    await leaderUser.updateProfile({ displayName: leader.fullName });

    const groupId = await generateGroupId();
    await firebase.firestore().collection('groups').doc(groupId).set({
      groupId,
      groupSize,
      members,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      isActive: true
    });

    const createdUsers = [];
    const memberUids = [leaderUser.uid];
    await createStudentFirestoreDocs(leaderUser, leader, groupId);
    createdUsers.push(leader);

    for (let i = 1; i < members.length; i++) {
      const member = members[i];
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(member.email, password);
      const user = userCredential.user;
      await user.updateProfile({ displayName: member.fullName });
      await createStudentFirestoreDocs(user, member, groupId);
      createdUsers.push(member);
      memberUids.push(user.uid);
    }

    // Store UIDs on the group doc so notifications can find members without querying users collection
    await firebase.firestore().collection('groups').doc(groupId).update({ memberUids });

    await firebase.auth().signOut();

    let message = `Group Registration Successful!\n\nGROUP ID: ${groupId}\n\nMembers:\n`;
    createdUsers.forEach((user, index) => {
      message += `\n${index + 1}. ${user.fullName}${user.isGroupLeader ? ' (Leader)' : ''}\n   Login ID: ${user.loginId}`;
    });
    message += '\n\nAll members share the same group password.\n\nRedirecting to login...';
    alert(message);
    window.location.href = 'login.html?role=student';
  } catch (error) {
    console.error('Group registration error:', error);
    try { await firebase.auth().signOut(); } catch (_) { /* ignore */ }
    let message = error.message || 'Group registration failed. Please try again.';
    if (error.code === 'permission-denied' || message.includes('insufficient permissions')) {
      message = 'Registration failed due to database permissions. Please refresh the page and try again.';
    }
    alert(message);
  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = 'Register Group';
  }
}

async function registerSupervisorAccount() {
  await waitForFirebase();

  const fullName = document.getElementById('fullNameSup')?.value.trim();
  const email = document.getElementById('emailSup')?.value.trim();
  const employeeId = document.getElementById('employeeId')?.value.trim();
  const department = document.getElementById('departmentSup')?.value;
  const designation = document.getElementById('designation')?.value.trim();
  const expertise = document.getElementById('expertise')?.value.trim();
  const phone = (document.getElementById('countryCodeSup')?.value || '+92') +
    (document.getElementById('phoneSup')?.value.trim() || '');

  const required = [
    ['fullNameSup', fullName, 'full name'],
    ['emailSup', email, 'email'],
    ['employeeId', employeeId, 'employee ID'],
    ['departmentSup', department, 'department'],
    ['designation', designation, 'designation'],
    ['expertise', expertise, 'areas of expertise'],
    ['phoneSup', document.getElementById('phoneSup')?.value.trim(), 'phone number']
  ];

  for (const [id, value] of required) {
    if (!value) {
      highlightInvalidField(document.getElementById(id));
      alert('Please fill in all required fields.');
      return;
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    highlightInvalidField(document.getElementById('emailSup'));
    alert('Please enter a valid email address.');
    return;
  }

  if (!validatePasswordFields()) return;

  const password = document.getElementById('password').value;
  const registerBtn = document.getElementById('registerBtn');
  registerBtn.disabled = true;
  registerBtn.textContent = 'Registering...';

  try {
    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    await user.updateProfile({ displayName: fullName });
    await user.sendEmailVerification();

    const supervisorData = {
      uid: user.uid,
      fullName,
      email,
      phone,
      employeeId,
      department,
      designation,
      expertise,
      status: 'pending_approval',
      registeredAt: new Date().toISOString(),
      emailVerified: false,
      approvedBy: null,
      approvedAt: null,
      role: 'supervisor',
      isActive: false
    };

    await firebase.firestore().collection('supervisors').doc(user.uid).set(supervisorData);
    await firebase.firestore().collection('users').doc(user.uid).set({
      uid: user.uid,
      email,
      loginId: employeeId,
      displayName: fullName,
      role: 'supervisor',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      isActive: false
    });

    alert(`Supervisor Registration Successful!\n\nWelcome, ${fullName}!\n\nYour application is pending admin approval.\n\nLogin ID: ${employeeId}\nEmail: ${email}\n\nRedirecting to login...`);
    window.location.href = 'login.html?role=supervisor';
  } catch (error) {
    console.error('Supervisor registration error:', error);
    let message = error.message || 'Supervisor registration failed.';
    if (error.code === 'auth/email-already-in-use') message = 'This email is already registered.';
    alert(message);
  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = 'Register as Supervisor';
  }
}

function handleAdminFileUpload(input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert('File size must be less than 5MB');
    input.value = '';
    return;
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    alert('Please upload a JPG, PNG, or PDF file');
    input.value = '';
    return;
  }

  const preview = document.getElementById('universityCardPreview');
  const fileName = document.getElementById('universityCardName');
  if (preview && fileName) {
    preview.style.display = 'block';
    fileName.textContent = file.name;
  }
}

async function notifySuperAdminsAboutNewAdmin(fullName, employeeId, email) {
  try {
    const snapshot = await firebase.firestore().collection('users')
      .where('role', '==', 'admin')
      .where('adminRoleType', '==', 'system_admin')
      .where('isActive', '==', true)
      .get();

    await Promise.all(snapshot.docs.map((doc) =>
      firebase.firestore().collection('notifications').add({
        userId: doc.data().uid,
        type: 'new_admin_application',
        title: 'New Admin Registration Pending Approval',
        message: `${fullName} (Employee ID: ${employeeId}) has registered as an admin and is awaiting your approval.`,
        applicantEmail: email,
        applicantEmployeeId: employeeId,
        applicantName: fullName,
        createdAt: new Date().toISOString(),
        read: false,
        actionRequired: true
      })
    ));
  } catch (error) {
    console.error('Error notifying super-admins:', error);
  }
}

async function registerAdminAccount() {
  await waitForFirebase();

  const fullName = document.getElementById('adminFullName')?.value.trim();
  const employeeId = document.getElementById('adminEmployeeId')?.value.trim();
  const email = document.getElementById('adminEmail')?.value.trim();
  const phone = (document.getElementById('countryCodeAdmin')?.value || '+92') +
    (document.getElementById('phoneAdmin')?.value.trim() || '');

  const required = [
    ['adminFullName', fullName, 'full name'],
    ['adminEmployeeId', employeeId, 'employee ID'],
    ['adminEmail', email, 'email'],
    ['phoneAdmin', document.getElementById('phoneAdmin')?.value.trim(), 'phone number']
  ];

  for (const [id, value] of required) {
    if (!value) {
      highlightInvalidField(document.getElementById(id));
      alert('Please fill in all required fields.');
      return;
    }
  }

  if (!email.endsWith('@aup.edu.pk')) {
    highlightInvalidField(document.getElementById('adminEmail'));
    alert('Please use your university email (@aup.edu.pk).');
    return;
  }

  if (!validatePasswordFields()) return;

  const password = document.getElementById('password').value;
  const registerBtn = document.getElementById('registerBtn');
  registerBtn.disabled = true;
  registerBtn.textContent = 'Registering...';

  try {
    const emailQuery = await firebase.firestore().collection('users')
      .where('email', '==', email).limit(1).get();
    if (!emailQuery.empty) throw new Error('This email is already registered.');

    const employeeQuery = await firebase.firestore().collection('users')
      .where('employeeId', '==', employeeId)
      .where('role', '==', 'admin')
      .limit(1).get();
    if (!employeeQuery.empty) throw new Error('This Employee ID is already registered.');

    const universityCardFile = document.getElementById('universityCard')?.files[0];
    let universityCardUrl = null;

    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    await user.updateProfile({ displayName: fullName });
    await user.sendEmailVerification();

    if (universityCardFile && window.firebaseServices?.storage) {
      try {
        const storageRef = window.firebaseServices.storage
          .ref()
          .child(`admin_documents/${user.uid}/${universityCardFile.name}`);
        await storageRef.put(universityCardFile);
        universityCardUrl = await storageRef.getDownloadURL();
      } catch (uploadError) {
        console.warn('University card upload failed:', uploadError);
      }
    }

    const userData = {
      uid: user.uid,
      email,
      loginId: employeeId,
      displayName: fullName,
      employeeId,
      phone,
      universityCardUrl,
      role: 'admin',
      status: 'pending_approval',
      isActive: false,
      isAdmin: true,
      registrationType: 'admin',
      approvedBy: null,
      approvedAt: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      registeredAt: new Date().toISOString()
    };

    await firebase.firestore().collection('users').doc(user.uid).set(userData);

    try {
      await firebase.firestore().collection('admins').doc(user.uid).set({
        uid: user.uid,
        fullName,
        employeeId,
        email,
        phone,
        status: 'pending_approval',
        registeredAt: new Date().toISOString(),
        role: 'admin',
        isActive: false
      });
    } catch (adminError) {
      console.warn('Could not create admins collection document:', adminError);
    }

    await notifySuperAdminsAboutNewAdmin(fullName, employeeId, email);

    alert(`Admin Registration Submitted!\n\nWelcome, ${fullName}!\n\nYour application is pending approval.\n\nEmployee ID: ${employeeId}\nEmail: ${email}\n\nRedirecting to login...`);
    window.location.href = 'login.html?role=admin';
  } catch (error) {
    console.error('Admin registration error:', error);
    let message = error.message || 'Admin registration failed.';
    if (error.code === 'auth/email-already-in-use') message = 'This email is already registered.';
    alert(message);
  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = 'Register as Admin';
  }
}
