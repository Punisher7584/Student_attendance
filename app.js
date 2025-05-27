import { 
    db, 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc, // Add this import
    deleteDoc,
    updateDoc,
    query,
    where,
    addDoc,
    auth,
    signOut,
    onAuthStateChanged,
    deleteField
} from './firebase-config.js';

// Modified auth state handler
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // TEMPORARY BYPASS - REMOVE IN PRODUCTION
  console.log("Temporary admin bypass - remove in production!");
  showSection("dashboard");
  return;
  
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (!userDoc.exists()) {
      console.error("User document not found");
      alert("Access denied - no user record");
      await signOut(auth);
      window.location.href = "login.html";
      return;
    }

    const userData = userDoc.data();
    if (userData.role !== "admin") {
      alert("Only admins can access this dashboard");
      await signOut(auth);
      window.location.href = "login.html";
      return;
    }

    showSection("dashboard");
  } catch (error) {
    console.error("Auth error:", error);
    alert("Error verifying access");
    window.location.href = "login.html";
  }
});


// Global Functions
window.showSection = function(sectionId) {
    document.querySelectorAll(".main-content > div").forEach((section) => {
        section.style.display = "none";
    });

    const selectedSection = document.getElementById(sectionId);
    if (selectedSection) {
        selectedSection.style.display = "block";
    }

    // Initialize sections properly
    if (sectionId === "dashboard") {
        fetchDashboardData();
    }
    else if (sectionId === "create-class") {
        fetchClasses();
    }
    else if (sectionId === "add-semesters") {
        fetchClassesForDropdown("semester-class-select");
        fetchClassesWithSemesters();
    }
    else if (sectionId === "create-teacher") {
        fetchTeachers();
    }
    else if (sectionId === "allot-class") {
        initializeAllotClassSection();
    }
    else if (sectionId === "manage-students") {
        if (document.getElementById("student-class")) {
            fetchClassesForDropdown("student-class");
        }
        fetchStudents();
    }
    else if (sectionId === "attendance") {
        if (document.getElementById("attendance-class")) {
            fetchClassesForAttendanceDropdown();
        }
    }
};

// Add this function to properly handle user roles
async function setUserRole(uid, email, role = "user") {
    try {
        await setDoc(doc(db, "users", uid), {
            email,
            role,
            lastUpdated: new Date().toISOString()
        }, { merge: true });
    } catch (error) {
        console.error("Error setting user role:", error);
        throw error;
    }
}

// Add this to your admin dashboard
window.grantAdminRole = async function() {
    const email = prompt("Enter user email to make admin:");
    if (!email) return;
    
    try {
        // In a real app, you would look up the user by email
        const user = auth.currentUser;
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            role: "admin",
            grantedBy: auth.currentUser.uid,
            grantedAt: new Date().toISOString()
        }, { merge: true });
        alert("Admin role granted successfully!");
    } catch (error) {
        console.error("Error granting admin role:", error);
        alert("Error granting admin role: " + error.message);
    }
};

let allSubjects = {}; // To cache subjects for checkbox creation

window.onload = () => {
    showSection("dashboard");
};

window.logout = async function() {
    try {
        await signOut(auth);
        alert("Logged out successfully!");
        window.location.href = "login.html";
    } catch (error) {
        console.error("Logout Error:", error);
        alert("Error logging out: " + error.message);
    }
};

// Class Management Functions
// Toggle submenu function
window.toggleSubmenu = function(element, event) {
    // Prevent default anchor behavior
    event.preventDefault();
    event.stopPropagation();
    
    // Toggle the active state
    const isExpanded = element.getAttribute('aria-expanded') === 'true';
    element.setAttribute('aria-expanded', !isExpanded);
    
    // Close all other open submenus
    document.querySelectorAll('.sidebar li.has-submenu').forEach(item => {
        if (item !== element) {
            item.setAttribute('aria-expanded', 'false');
            item.classList.remove('active');
            item.querySelector('.submenu').classList.remove('active');
        }
    });
    
    // Toggle the current submenu
    element.classList.toggle('active');
    const submenu = element.querySelector('.submenu');
    submenu.classList.toggle('active');
};

// Close submenus when clicking outside
document.addEventListener('click', function(event) {
    if (!event.target.closest('.sidebar li.has-submenu')) {
        document.querySelectorAll('.sidebar li.has-submenu').forEach(item => {
            item.setAttribute('aria-expanded', 'false');
            item.classList.remove('active');
            item.querySelector('.submenu').classList.remove('active');
        });
    }
});

window.addClass = async function() {
    const className = document.getElementById("class-name").value.trim();
    if (className !== "") {
        try {
            await addDoc(collection(db, "classes"), { 
                name: className,
                semesters: {} // Initialize empty semesters object
            });
            document.getElementById("class-name").value = "";
            fetchClasses();
            fetchClassesForDropdown("semester-class-select");
            alert("Class added successfully!");
        } catch (error) {
            console.error("Error adding class:", error);
            alert("Error adding class. Please try again.");
        }
    } else {
        alert("Please enter a class name!");
    }
};

async function fetchClassesWithSemesters() {
    const semesterList = document.getElementById("semester-list");
    semesterList.innerHTML = "";

    try {
        const classesSnapshot = await getDocs(collection(db, "classes"));
        if (classesSnapshot.empty) {
            semesterList.innerHTML = "<p>No classes found.</p>";
        } else {
            classesSnapshot.forEach(async (doc) => {
                const classData = doc.data();
                const classItem = document.createElement("div");
                classItem.className = "class-item";
                
                // Class header with name
                const classHeader = document.createElement("div");
                classHeader.className = "class-header";
                classHeader.innerHTML = `<h3>${classData.name}</h3>`;
                
                // Semesters list
                const semesterListContainer = document.createElement("div");
                semesterListContainer.className = "semester-list-container";
                
                if (classData.semesters && Object.keys(classData.semesters).length > 0) {
                    semesterListContainer.innerHTML = "<h4>Semesters:</h4>";
                    const semesterUl = document.createElement("ul");
                    
                    for (const [semesterId, semesterData] of Object.entries(classData.semesters)) {
                        const semesterItem = document.createElement("li");
                        semesterItem.innerHTML = `
                            <span>${semesterData.name}</span>
                            <div class="semester-actions">
                                <button class="edit-btn" onclick="editSemester('${doc.id}', '${semesterId}', '${semesterData.name}')">Edit</button>
                                <button class="delete-btn" onclick="deleteSemester('${doc.id}', '${semesterId}')">Delete</button>
                            </div>
                        `;
                        semesterUl.appendChild(semesterItem);
                    }
                    
                    semesterListContainer.appendChild(semesterUl);
                } else {
                    semesterListContainer.innerHTML = "<p>No semesters added yet.</p>";
                }
                
                classItem.appendChild(classHeader);
                classItem.appendChild(semesterListContainer);
                semesterList.appendChild(classItem);
            });
        }
    } catch (error) {
        console.error("Error fetching classes with semesters:", error);
        semesterList.innerHTML = "<p class='error'>Error loading classes and semesters.</p>";
    }
}


async function fetchClasses() {
    const classList = document.getElementById("class-list");
    classList.innerHTML = "";

    try {
        const classesSnapshot = await getDocs(collection(db, "classes"));
        if (classesSnapshot.empty) {
            classList.innerHTML = "<p>No classes found.</p>";
        } else {
            classesSnapshot.forEach((doc) => {
                const classData = doc.data();
                const classItem = document.createElement("div");
                classItem.className = "class-item";
                classItem.innerHTML = `
                    <div class="class-header">
                        <h3>${classData.name}</h3>
                        <div class="class-actions">
                            <button class="edit-btn" onclick="editClass('${doc.id}', '${classData.name}')">Edit</button>
                            <button class="delete-btn" onclick="deleteClass('${doc.id}')">Delete</button>
                        </div>
                    </div>
                `;
                classList.appendChild(classItem);
            });
        }
    } catch (error) {
        console.error("Error fetching classes:", error);
        classList.innerHTML = "<p class='error'>Error loading classes.</p>";
    }
}


window.editClass = async function(id, currentName) {
    const newName = prompt("Enter new class name:", currentName);
    if (newName && newName.trim() !== "") {
        try {
            await updateDoc(doc(db, "classes", id), { name: newName });
            fetchClasses();
            alert("Class updated successfully!");
        } catch (error) {
            console.error("Error updating class:", error);
            alert("Error updating class. Please try again.");
        }
    }   
};

window.deleteClass = async function(id) {
    if (confirm("Are you sure you want to delete this class and all its semesters?")) {
        try {
            await deleteDoc(doc(db, "classes", id));
            fetchClasses();
            alert("Class deleted successfully!");
        } catch (error) {
            console.error("Error deleting class:", error);
            alert("Error deleting class. Please try again.");
        }
    }
};


// Semester Management Functions
window.addSemester = async function() {
    const classId = document.getElementById("semester-class-select").value;
    const semesterName = document.getElementById("semester-name").value.trim();
    
    if (!classId) {
        alert("Please select a class!");
        return;
    }
    
    if (!semesterName) {
        alert("Please enter a semester name!");
        return;
    }
    
    try {
        const classRef = doc(db, "classes", classId);
        const classSnap = await getDoc(classRef);
        
        if (classSnap.exists()) {
            const classData = classSnap.data();
            const newSemester = {
                name: semesterName,
                subjects: {}
            };
            
            await updateDoc(classRef, {
                [`semesters.${Date.now()}`]: newSemester
            });
            
            document.getElementById("semester-name").value = "";
            fetchClassesWithSemesters(); // Update the semester list
            alert("Semester added successfully!");
        } else {
            alert("Selected class not found!");
        }
    } catch (error) {
        console.error("Error adding semester:", error);
        alert("Error adding semester. Please try again.");
    }
};

window.editSemester = async function(classId, semesterId, currentName) {
    const newName = prompt("Enter new semester name:", currentName);
    if (newName && newName.trim() !== "") {
        try {
            const classRef = doc(db, "classes", classId);
            await updateDoc(classRef, {
                [`semesters.${semesterId}.name`]: newName
            });
            fetchClassesWithSemesters(); // Update the semester list
            alert("Semester updated successfully!");
        } catch (error) {
            console.error("Error updating semester:", error);
            alert("Error updating semester. Please try again.");
        }
    }
};

window.deleteSemester = async function(classId, semesterId) {
    if (confirm("Are you sure you want to delete this semester?")) {
        try {
            const classRef = doc(db, "classes", classId);
            await updateDoc(classRef, {
                [`semesters.${semesterId}`]: deleteField()
            });
            fetchClassesWithSemesters(); // Update the semester list
            alert("Semester deleted successfully!");
        } catch (error) {
            console.error("Error deleting semester:", error);
            alert("Error deleting semester. Please try again.");
        }
    }
};


window.loadClassSemesters = async function() {
    const classId = document.getElementById("semester-class-select").value;
    if (!classId) return;
    
    try {
        const classRef = doc(db, "classes", classId);
        const classSnap = await getDoc(classRef);
        
        if (classSnap.exists()) {
            const classData = classSnap.data();
            console.log("Available semesters:", classData.semesters);
        }
    } catch (error) {
        console.error("Error loading semesters:", error);
    }
};


// Teacher Management Functions
window.showTeacherSubSection = function(subSectionId) {
    // Hide all top-level sections
    document.querySelectorAll('.main-content > div').forEach(div => {
        div.style.display = 'none';
    });

    // Show the parent section for teacher management
    document.getElementById('manage-teachers').style.display = 'block';

    // Hide all subsections
    const subsections = document.querySelectorAll('#manage-teachers .teacher-subsection');
    subsections.forEach(sub => sub.style.display = 'none');

    // Show only the selected subsection
    document.getElementById(subSectionId).style.display = 'block';
    
    // Load appropriate data
    if (subSectionId === 'create-teacher') {
        fetchTeachers();
    } else if (subSectionId === 'allot-class') {
        initializeAllotClassSection();
    }
};


// Add this function to initialize the allot class section
async function initializeAllotClassSection() {
    try {
        await fetchTeachersForDropdown();
        await fetchClassesForDropdown("assignment-class");
        await fetchTeacherAssignments();
        
        // Set up event listeners
        const classSelect = document.getElementById("assignment-class");
        if (classSelect) {
            classSelect.addEventListener("change", function() {
                const classId = this.value;
                if (classId) {
                    loadSemesterCheckboxes(classId);
                } else {
                    document.getElementById("semester-checkboxes").style.display = "none";
                    document.getElementById("subject-checkboxes").style.display = "none";
                }
            });
        }
    } catch (error) {
        console.error("Error initializing allot class section:", error);
        alert("Error initializing teacher assignment section. Please try again.");
    }
}

async function loadSemesterCheckboxes(classId) {
    const semesterContainer = document.getElementById("semester-checkboxes");
    semesterContainer.innerHTML = "<h4>Select Semesters:</h4>";
    semesterContainer.style.display = "none";
    document.getElementById("subject-checkboxes").style.display = "none";
    
    if (!classId) return;
    
    try {
        const classRef = doc(db, "classes", classId);
        const classSnap = await getDoc(classRef);
        
        if (classSnap.exists()) {
            const classData = classSnap.data();
            if (classData.semesters && Object.keys(classData.semesters).length > 0) {
                for (const [semesterId, semesterData] of Object.entries(classData.semesters)) {
                    const checkboxDiv = document.createElement("div");
                    checkboxDiv.className = "semester-checkbox";
                    
                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.id = `semester-${semesterId}`;
                    checkbox.value = semesterId;
                    checkbox.dataset.classId = classId;
                    checkbox.addEventListener("change", function() {
                        if (this.checked) {
                            loadSubjectCheckboxes(classId, semesterId);
                        } else {
                            // Hide subjects if semester is unchecked
                            document.getElementById("subject-checkboxes").style.display = "none";
                        }
                    });
                    
                    const label = document.createElement("label");
                    label.htmlFor = `semester-${semesterId}`;
                    label.textContent = semesterData.name;
                    
                    checkboxDiv.appendChild(checkbox);
                    checkboxDiv.appendChild(label);
                    semesterContainer.appendChild(checkboxDiv);
                }
                
                semesterContainer.style.display = "block";
            }
        }
    } catch (error) {
        console.error("Error loading semesters:", error);
    }
}

async function loadSubjectCheckboxes(classId, semesterId) {
    const subjectContainer = document.getElementById("subject-checkboxes");
    subjectContainer.innerHTML = "<h4>Select Subjects:</h4>";
    subjectContainer.style.display = "none";
    
    try {
        const classRef = doc(db, "classes", classId);
        const classSnap = await getDoc(classRef);
        
        if (classSnap.exists()) {
            const classData = classSnap.data();
            const semester = classData.semesters?.[semesterId];
            
            if (semester && semester.subjects) {
                for (const [subjectId, subjectName] of Object.entries(semester.subjects)) {
                    const checkboxDiv = document.createElement("div");
                    checkboxDiv.className = "subject-checkbox";
                    
                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.id = `subject-${subjectId}`;
                    checkbox.value = subjectId;
                    checkbox.dataset.semesterId = semesterId;
                    checkbox.dataset.classId = classId;
                    
                    const label = document.createElement("label");
                    label.htmlFor = `subject-${subjectId}`;
                    label.textContent = subjectName;
                    
                    checkboxDiv.appendChild(checkbox);
                    checkboxDiv.appendChild(label);
                    subjectContainer.appendChild(checkboxDiv);
                }
                
                subjectContainer.style.display = "block";
            }
        }
    } catch (error) {
        console.error("Error loading subjects:", error);
    }
}


window.saveTeacher = async function(event) {
    event.preventDefault();

    const firstName = document.getElementById("first-name").value.trim();
    const lastName = document.getElementById("last-name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();

    if (!firstName || !lastName || !email || !phone) {
        alert("Please fill all fields!");
        return;
    }

    try {
        await addDoc(collection(db, "teachers"), {
            firstName,
            lastName,
            email,
            phone,
            createdAt: new Date().toISOString()
        });

        document.getElementById("teacher-form").reset();
        fetchTeachers(); // Refresh teacher list
        alert("Teacher saved successfully!");
    } catch (error) {
        console.error("Error saving teacher:", error);
        alert("Error saving teacher. Please try again.");
    }
};

async function fetchTeachers() {
    const teacherList = document.getElementById("teacher-list");
    if (!teacherList) {
        console.error("Teacher list element not found");
        return;
    }

    teacherList.innerHTML = "<h3>Saved Teachers</h3>";
    
    try {
        const teachersSnapshot = await getDocs(collection(db, "teachers"));
        
        if (teachersSnapshot.empty) {
            teacherList.innerHTML += "<p>No teachers found.</p>";
            return;
        }

        teachersSnapshot.forEach((doc) => {
            const teacherData = doc.data();
            const teacherItem = document.createElement("div");
            teacherItem.className = "teacher-item";
            teacherItem.innerHTML = `
                <div class="teacher-info">
                    <h4>${teacherData.firstName} ${teacherData.lastName}</h4>
                    <p>Email: ${teacherData.email}</p>
                    <p>Phone: ${teacherData.phone}</p>
                </div>
                <div class="teacher-actions">
                    <button class="edit-btn" onclick="editTeacher('${doc.id}')">Edit</button>
                    <button class="delete-btn" onclick="deleteTeacher('${doc.id}')">Delete</button>
                </div>
            `;
            teacherList.appendChild(teacherItem);
        });
    } catch (error) {
        console.error("Error fetching teachers:", error);
        teacherList.innerHTML += `<p class="error">Error loading teachers: ${error.message}</p>`;
    }
}

// async function fetchTeachers() {
//     const teacherList = document.getElementById("teacher-list");
//     if (!teacherList) return;

//     teacherList.innerHTML = "<h3>Teacher List</h3>";
    
//     try {
//         const teachersSnapshot = await getDocs(collection(db, "teachers"));
        
//         if (teachersSnapshot.empty) {
//             teacherList.innerHTML += "<p>No teachers found.</p>";
//             return;
//         }

//         teachersSnapshot.forEach((doc) => {
//             const teacherData = doc.data();
//             const teacherItem = document.createElement("div");
//             teacherItem.className = "teacher-item";
//             teacherItem.innerHTML = `
//                 <div class="teacher-info">
//                     <h4>${teacherData.firstName} ${teacherData.lastName}</h4>
//                     <p>Email: ${teacherData.email}</p>
//                     <p>Phone: ${teacherData.phone}</p>
//                 </div>
//                 <div class="teacher-actions">
//                     <button onclick="editTeacher('${doc.id}')">Edit</button>
//                     <button onclick="deleteTeacher('${doc.id}')">Delete</button>
//                 </div>
//             `;
//             teacherList.appendChild(teacherItem);
//         });
//     } catch (error) {
//         console.error("Error fetching teachers:", error);
//         teacherList.innerHTML += `<p class="error">Error loading teachers: ${error.message}</p>`;
//     }
// }

// async function fetchTeachers() {
//     const teacherList = document.getElementById("teacher-list");
//     if (!teacherList) {
//         console.error("Teacher list element not found");
//         return;
//     }

//     teacherList.innerHTML = "<h2>Saved Teachers</h2>";
    
//     try {
//         const teachersSnapshot = await getDocs(collection(db, "teachers"));
        
//         if (teachersSnapshot.empty) {
//             teacherList.innerHTML += "<p>No teachers found.</p>";
//             return;
//         }

//         // Get all assignments first
//         const assignmentsSnapshot = await getDocs(collection(db, "teacher_assignments"));
//         const assignmentsMap = new Map();
//         assignmentsSnapshot.forEach(doc => {
//             const data = doc.data();
//             if (!assignmentsMap.has(data.teacherId)) {
//                 assignmentsMap.set(data.teacherId, []);
//             }
//             assignmentsMap.get(data.teacherId).push(data);
//         });

//         // Process each teacher
//         for (const teacherDoc of teachersSnapshot.docs) {
//             const teacherData = teacherDoc.data();
//             const teacherAssignments = assignmentsMap.get(teacherDoc.id) || [];

//             const teacherItem = document.createElement("div");
//             teacherItem.className = "teacher-item";
            
//             // Teacher info
//             teacherItem.innerHTML = `
//                 <div class="teacher-info">
//                     <h3>${teacherData.firstName} ${teacherData.lastName}</h3>
//                     <p>Email: ${teacherData.email}</p>
//                     <p>Phone: ${teacherData.phone}</p>
//                 </div>
//                 <div class="teacher-assignments">
//                     <h4>Assignments:</h4>
//             `;

//             // Add assignments if they exist
//             if (teacherAssignments.length === 0) {
//                 teacherItem.innerHTML += `<p>No assignments yet.</p>`;
//             } else {
//                 const assignmentsList = document.createElement("ul");
                
//                 // Process each assignment
//                 for (const assignment of teacherAssignments) {
//                     // Get class name
//                     let className = "Unknown Class";
//                     try {
//                         const classDoc = await getDoc(doc(db, "classes", assignment.classId));
//                         if (classDoc.exists()) {
//                             className = classDoc.data().name;
//                         }
//                     } catch (error) {
//                         console.error("Error fetching class:", error);
//                     }

//                     // Get semester name
//                     let semesterName = "Unknown Semester";
//                     try {
//                         const classDoc = await getDoc(doc(db, "classes", assignment.classId));
//                         if (classDoc.exists()) {
//                             const classData = classDoc.data();
//                             semesterName = classData.semesters?.[assignment.semesterId]?.name || semesterName;
//                         }
//                     } catch (error) {
//                         console.error("Error fetching semester:", error);
//                     }

//                     // Create assignment item
//                     const assignmentItem = document.createElement("li");
//                     assignmentItem.innerHTML = `
//                         <strong>${className} - ${semesterName}</strong>
//                         <button onclick="removeAssignment('${assignment.id}')">Remove</button>
//                     `;
//                     assignmentsList.appendChild(assignmentItem);
//                 }
                
//                 teacherItem.appendChild(assignmentsList);
//             }

//             // Add action buttons
//             teacherItem.innerHTML += `
//                 </div>
//                 <div class="teacher-actions">
//                     <button onclick="editTeacher('${teacherDoc.id}')">Edit</button>
//                     <button onclick="deleteTeacher('${teacherDoc.id}')">Delete</button>
//                 </div>
//             `;

//             teacherList.appendChild(teacherItem);
//         }
//     } catch (error) {
//         console.error("Error fetching teachers:", error);
//         teacherList.innerHTML += `<p class="error">Error loading teachers: ${error.message}</p>`;
//     }
// }



// Add this function to load semesters when a class is selected
window.loadTeacherSemesters = async function(classId) {
    const semesterSelect = document.getElementById("teacher-semester");
    semesterSelect.innerHTML = "<option value=''>Select Semester</option>";
    
    if (!classId) return;
    
    try {
        const classRef = doc(db, "classes", classId);
        const classSnap = await getDoc(classRef);
        
        if (classSnap.exists()) {
            const classData = classSnap.data();
            if (classData.semesters) {
                for (const [semesterId, semesterData] of Object.entries(classData.semesters)) {
                    const option = document.createElement("option");
                    option.value = semesterId;
                    option.textContent = semesterData.name;
                    semesterSelect.appendChild(option);
                }
            }
        }
    } catch (error) {
        console.error("Error loading semesters:", error);
        alert("Error loading semesters. Please try again.");
    }
};


window.editTeacher = async function(id) {
    const teacherDoc = await getDoc(doc(db, "teachers", id));
    if (teacherDoc.exists()) {
        const teacherData = teacherDoc.data();
        const newFirstName = prompt("Enter new first name:", teacherData.firstName);
        const newLastName = prompt("Enter new last name:", teacherData.lastName);
        const newEmail = prompt("Enter new email:", teacherData.email);
        const newPhone = prompt("Enter new phone number:", teacherData.phone);

        if (newFirstName && newLastName && newEmail && newPhone) {
            try {
                await updateDoc(doc(db, "teachers", id), {
                    firstName: newFirstName,
                    lastName: newLastName,
                    email: newEmail,
                    phone: newPhone,
                });
                fetchTeachers();
                alert("Teacher updated successfully!");
            } catch (error) {
                console.error("Error updating teacher:", error);
                alert("Error updating teacher. Please try again.");
            }
        }
    }
};


window.deleteTeacher = async function(id) {
    if (confirm("Are you sure you want to delete this teacher and all their assignments?")) {
        try {
            // First delete any assignments for this teacher
            const assignmentsQuery = query(
                collection(db, "teacher_assignments"),
                where("teacherId", "==", id)
            );
            const assignmentsSnapshot = await getDocs(assignmentsQuery);
            
            const deletePromises = [];
            assignmentsSnapshot.forEach((doc) => {
                deletePromises.push(deleteDoc(doc.ref));
            });
            
            await Promise.all(deletePromises);
            
            // Then delete the teacher
            await deleteDoc(doc(db, "teachers", id));
            
            fetchTeachers();
            alert("Teacher deleted successfully!");
        } catch (error) {
            console.error("Error deleting teacher:", error);
            alert("Error deleting teacher. Please try again.");
        }
    }
};

async function fetchTeachersForDropdown() {
    const teacherSelect = document.getElementById("assignment-teacher");
    if (!teacherSelect) return;
    
    teacherSelect.innerHTML = "<option value=''>Select Teacher</option>";
    
    try {
        const teachersSnapshot = await getDocs(collection(db, "teachers"));
        teachersSnapshot.forEach((doc) => {
            const teacherData = doc.data();
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent = `${teacherData.firstName} ${teacherData.lastName}`;
            teacherSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error fetching teachers:", error);
    }
}


window.loadAssignmentSemesters = async function(classId) {
    const semesterSelect = document.getElementById("assignment-semester");
    if (!semesterSelect) return;
    
    semesterSelect.innerHTML = "<option value=''>Select Semester</option>";
    document.getElementById("subject-checkboxes").style.display = "none";
    
    if (!classId) return;
    
    try {
        const classRef = doc(db, "classes", classId);
        const classSnap = await getDoc(classRef);
        
        if (classSnap.exists()) {
            const classData = classSnap.data();
            if (classData.semesters) {
                for (const [semesterId, semesterData] of Object.entries(classData.semesters)) {
                    const option = document.createElement("option");
                    option.value = semesterId;
                    option.textContent = semesterData.name;
                    semesterSelect.appendChild(option);
                }
            }
        }
    } catch (error) {
        console.error("Error loading semesters:", error);
    }
};


window.loadAssignmentSubjects = async function(semesterId) {
    const subjectContainer = document.getElementById("subject-checkboxes");
    if (!subjectContainer) return;
    
    subjectContainer.innerHTML = "<h4>Select Subjects:</h4>";
    subjectContainer.style.display = "none";
    
    if (!semesterId) return;
    
    const classId = document.getElementById("assignment-class").value;
    if (!classId) return;
    
    try {
        const classRef = doc(db, "classes", classId);
        const classSnap = await getDoc(classRef);
        
        if (classSnap.exists()) {
            const classData = classSnap.data();
            const semester = classData.semesters?.[semesterId];
            
            if (semester && semester.subjects) {
                allSubjects = semester.subjects;
                
                for (const [subjectId, subjectName] of Object.entries(semester.subjects)) {
                    const checkboxDiv = document.createElement("div");
                    checkboxDiv.className = "subject-checkbox";
                    
                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.id = `subject-${subjectId}`;
                    checkbox.value = subjectId;
                    
                    const label = document.createElement("label");
                    label.htmlFor = `subject-${subjectId}`;
                    label.textContent = subjectName;
                    
                    checkboxDiv.appendChild(checkbox);
                    checkboxDiv.appendChild(label);
                    subjectContainer.appendChild(checkboxDiv);
                }
                
                subjectContainer.style.display = "block";
            }
        }
    } catch (error) {
        console.error("Error loading subjects:", error);
    }
};


window.assignTeacher = async function() {
    const teacherId = document.getElementById("assignment-teacher").value;
    const classId = document.getElementById("assignment-class").value;
    
    if (!teacherId || !classId) {
        alert("Please select teacher and class!");
        return;
    }
    
    // Get selected semesters and their subjects
    const selectedSemesters = [];
    const semesterCheckboxes = document.querySelectorAll("#semester-checkboxes input[type='checkbox']:checked");
    
    if (semesterCheckboxes.length === 0) {
        alert("Please select at least one semester!");
        return;
    }
    
    try {
        // First, remove any existing assignments for this teacher-class combination
        const existingAssignmentsQuery = query(
            collection(db, "teacher_assignments"),
            where("teacherId", "==", teacherId),
            where("classId", "==", classId)
        );
        
        const existingAssignments = await getDocs(existingAssignmentsQuery);
        const deletePromises = [];
        existingAssignments.forEach(doc => {
            deletePromises.push(deleteDoc(doc.ref));
        });
        await Promise.all(deletePromises);
        
        // Create new assignments for each selected semester
        for (const semesterCheckbox of semesterCheckboxes) {
            const semesterId = semesterCheckbox.value;
            const subjectCheckboxes = document.querySelectorAll(
                `#subject-checkboxes input[type='checkbox'][data-semester-id='${semesterId}']:checked`
            );
            
            const selectedSubjects = Array.from(subjectCheckboxes).map(cb => cb.value);
            
            if (selectedSubjects.length === 0) {
                alert(`Please select at least one subject for semester ${semesterCheckbox.nextElementSibling.textContent}`);
                return;
            }
            
            await addDoc(collection(db, "teacher_assignments"), {
                teacherId,
                classId,
                semesterId,
                subjects: selectedSubjects,
                isActive: true,
                assignedDate: new Date().toISOString()
            });
        }
        
        alert("Teacher assigned successfully!");
        fetchTeacherAssignments();
    } catch (error) {
        console.error("Error assigning teacher:", error);
        alert("Error assigning teacher. Please try again.");
    }
};

async function fetchTeacherAssignments() {
    const assignmentsContainer = document.getElementById("teacher-assignments");
    if (!assignmentsContainer) return;

    assignmentsContainer.innerHTML = "<h3>Teacher Assignments</h3>";
    
    try {
        // Get all assignments
        const assignmentsSnapshot = await getDocs(collection(db, "teacher_assignments"));
        
        if (assignmentsSnapshot.empty) {
            assignmentsContainer.innerHTML += "<p>No assignments found.</p>";
            return;
        }

        // Get all teachers, classes, and semesters for reference
        const [teachersSnapshot, classesSnapshot] = await Promise.all([
            getDocs(collection(db, "teachers")),
            getDocs(collection(db, "classes"))
        ]);

        // Create maps for quick lookup
        const teachersMap = new Map();
        teachersSnapshot.forEach(doc => {
            teachersMap.set(doc.id, doc.data());
        });

        const classesMap = new Map();
        classesSnapshot.forEach(doc => {
            classesMap.set(doc.id, doc.data());
        });

        // Group assignments by teacher
        const assignmentsByTeacher = new Map();
        assignmentsSnapshot.forEach(doc => {
            const assignment = doc.data();
            if (!assignmentsByTeacher.has(assignment.teacherId)) {
                assignmentsByTeacher.set(assignment.teacherId, []);
            }
            assignmentsByTeacher.get(assignment.teacherId).push({
                id: doc.id,
                ...assignment
            });
        });

        // Display assignments
        for (const [teacherId, assignments] of assignmentsByTeacher.entries()) {
            const teacherData = teachersMap.get(teacherId);
            if (!teacherData) continue;

            const teacherDiv = document.createElement("div");
            teacherDiv.className = "teacher-assignment-group";
            teacherDiv.innerHTML = `<h4>${teacherData.firstName} ${teacherData.lastName}</h4>`;
            
            const assignmentsList = document.createElement("ul");
            assignmentsList.className = "assignment-list";

            for (const assignment of assignments) {
                const classData = classesMap.get(assignment.classId);
                if (!classData) continue;

                const semesterData = classData.semesters?.[assignment.semesterId];
                if (!semesterData) continue;

                // Get subject names
                const subjectNames = [];
                if (assignment.subjects && Array.isArray(assignment.subjects)) {
                    assignment.subjects.forEach(subjectId => {
                        if (semesterData.subjects?.[subjectId]) {
                            subjectNames.push(semesterData.subjects[subjectId]);
                        }
                    });
                }

                const assignmentItem = document.createElement("li");
                assignmentItem.className = "assignment-item";
                assignmentItem.innerHTML = `
                    <div class="assignment-info">
                        <p><strong>Class:</strong> ${classData.name}</p>
                        <p><strong>Semester:</strong> ${semesterData.name}</p>
                        <p><strong>Subjects:</strong> ${subjectNames.join(", ") || "None"}</p>
                    </div>
                    <button class="remove-btn" onclick="removeAssignment('${assignment.id}')">Remove</button>
                `;
                assignmentsList.appendChild(assignmentItem);
            }

            teacherDiv.appendChild(assignmentsList);
            assignmentsContainer.appendChild(teacherDiv);
        }
    } catch (error) {
        console.error("Error fetching assignments:", error);
        assignmentsContainer.innerHTML += `<p class="error">Error loading assignments: ${error.message}</p>`;
    }
}


window.removeAssignment = async function(assignmentId) {
    if (confirm("Are you sure you want to remove this assignment?")) {
        try {
            await deleteDoc(doc(db, "teacher_assignments", assignmentId));
            fetchTeacherAssignments();
            alert("Assignment removed successfully!");
        } catch (error) {
            console.error("Error removing assignment:", error);
            alert("Error removing assignment. Please try again.");
        }
    }
};


document.addEventListener("DOMContentLoaded", function() {
    // Teacher form submission
    const teacherForm = document.getElementById("teacher-form");
    if (teacherForm) {
        teacherForm.addEventListener("submit", function(e) {
            e.preventDefault();
            window.saveTeacher(e);
        });
    }

    // Student form submission
    const studentForm = document.getElementById("student-form");
    if (studentForm) {
        studentForm.addEventListener("submit", function(e) {
            e.preventDefault();
            window.saveStudent(e);
        });
    }
});



// Student Management Functions
window.saveStudent = async function(event) {
    event.preventDefault();

    const firstName = document.getElementById("student-first-name").value.trim();
    const lastName = document.getElementById("student-last-name").value.trim();
    const rollNo = document.getElementById("student-roll-no").value.trim();
    const email = document.getElementById("student-email").value.trim();
    const phone = document.getElementById("student-phone").value.trim();
    const classId = document.getElementById("student-class").value;

    if (!firstName || !lastName || !rollNo || !email || !phone || !classId) {
        alert("Please fill all fields!");
        return;
    }

    try {
        await addDoc(collection(db, "students"), {
            firstName,
            lastName,
            rollNo,
            email,
            phone,
            classId,
        });

        document.getElementById("student-form").reset();
        fetchStudents();
        alert("Student saved successfully!");
    } catch (error) {
        console.error("Error saving student:", error);
        alert("Error saving student. Please try again.");
    }
};

async function fetchStudents() {
    const studentList = document.getElementById("student-list");
    studentList.innerHTML = "<h2>Saved Students</h2>";

    try {
        const studentsSnapshot = await getDocs(collection(db, "students"));
        if (studentsSnapshot.empty) {
            studentList.innerHTML += "<p>No students found.</p>";
        } else {
            studentsSnapshot.forEach(async (studentDoc) => {
                const studentData = studentDoc.data();
                const classId = studentData.classId;

                if (!classId) {
                    console.warn(`Student ${studentDoc.id} has no classId.`);
                    displayStudent(studentList, studentDoc.id, studentData, "Unknown Class");
                    return;
                }

                try {
                    const classDocRef = doc(db, "classes", classId);
                    const classDoc = await getDoc(classDocRef);

                    if (classDoc.exists()) {
                        const className = classDoc.data().name;
                        displayStudent(studentList, studentDoc.id, studentData, className);
                    } else {
                        console.warn(`Class ${classId} not found for student ${studentDoc.id}.`);
                        displayStudent(studentList, studentDoc.id, studentData, "Unknown Class");
                    }
                } catch (error) {
                    console.error(`Error fetching class for student ${studentDoc.id}:`, error);
                    displayStudent(studentList, studentDoc.id, studentData, "Unknown Class");
                }
            });
        }
    } catch (error) {
        console.error("Error fetching students:", error);
        alert("Error fetching students. Please try again.");
    }
}

function displayStudent(studentList, studentId, studentData, className) {
    const studentItem = document.createElement("div");
    studentItem.innerHTML = `
        <p><strong>${studentData.firstName} ${studentData.lastName}</strong></p>
        <p>Roll No: ${studentData.rollNo}</p>
        <p>Email: ${studentData.email}</p>
        <p>Phone: ${studentData.phone}</p>
        <p>Class: ${className}</p>
        <button class="edit-btn" onclick="editStudent('${studentId}')">Edit</button>
        <button class="delete-btn" onclick="deleteStudent('${studentId}')">Delete</button>
    `;
    studentList.appendChild(studentItem);
}

window.editStudent = async function(id) {
    const studentDoc = await getDoc(doc(db, "students", id));
    if (studentDoc.exists()) {
        const studentData = studentDoc.data();
        const newFirstName = prompt("Enter new first name:", studentData.firstName);
        const newLastName = prompt("Enter new last name:", studentData.lastName);
        const newRollNo = prompt("Enter new roll number:", studentData.rollNo);
        const newEmail = prompt("Enter new email:", studentData.email);
        const newPhone = prompt("Enter new phone number:", studentData.phone);

        if (newFirstName && newLastName && newRollNo && newEmail && newPhone) {
            try {
                await updateDoc(doc(db, "students", id), {
                    firstName: newFirstName,
                    lastName: newLastName,
                    rollNo: newRollNo,
                    email: newEmail,
                    phone: newPhone,
                });
                fetchStudents();
                alert("Student updated successfully!");
            } catch (error) {
                console.error("Error updating student:", error);
                alert("Error updating student. Please try again.");
            }
        }
    }
};

window.deleteStudent = async function(id) {
    if (confirm("Are you sure you want to delete this student?")) {
        try {
            await deleteDoc(doc(db, "students", id));
            fetchStudents();
            alert("Student deleted successfully!");
        } catch (error) {
            console.error("Error deleting student:", error);
            alert("Error deleting student. Please try again.");
        }
    }
};

// Attendance Management Functions
window.fetchStudentsForAttendance = async function() {
    const classId = document.getElementById("attendance-class").value;
    const date = document.getElementById("attendance-date").value;
    const studentList = document.getElementById("attendance-student-list");
    studentList.innerHTML = "";

    if (!classId || !date) {
        return;
    }

    try {
        const studentsSnapshot = await getDocs(collection(db, "students"));
        const studentsInClass = studentsSnapshot.docs.filter(doc => doc.data().classId === classId);

        if (studentsInClass.length === 0) {
            studentList.innerHTML = "<tr><td colspan='4'>No students found in this class.</td></tr>";
        } else {
            for (const studentDoc of studentsInClass) {
                const studentData = studentDoc.data();
                const studentId = studentDoc.id;

                const attendanceQuery = query(
                    collection(db, "attendance"),
                    where("studentId", "==", studentId),
                    where("classId", "==", classId),
                    where("date", "==", date)
                );
                const attendanceSnapshot = await getDocs(attendanceQuery);

                let status = "Unmarked";
                if (!attendanceSnapshot.empty) {
                    status = attendanceSnapshot.docs[0].data().status;
                }

                const row = document.createElement("tr");
                row.setAttribute("data-student-id", studentId);
                row.innerHTML = `
                    <td>${studentData.firstName} ${studentData.lastName}</td>
                    <td>${studentData.rollNo}</td>
                    <td>${status}</td>
                    <td>
                        <button class="present-btn" onclick="markAttendance('${studentId}', 'present')">Present</button>
                        <button class="absent-btn" onclick="markAttendance('${studentId}', 'absent')">Absent</button>
                    </td>
                `;
                studentList.appendChild(row);
            }
        }
    } catch (error) {
        console.error("Error fetching students for attendance:", error);
        alert("Error fetching students for attendance. Please try again.");
    }
};

window.markAttendance = function(studentId, status) {
    const row = document.querySelector(`tr[data-student-id="${studentId}"]`);
    if (row) {
        row.querySelector("td:nth-child(3)").innerText = status;
    }
};

window.saveAttendance = async function() {
    const classId = document.getElementById("attendance-class").value;
    const date = document.getElementById("attendance-date").value;

    if (!classId || !date) {
        alert("Please select a class and date!");
        return;
    }

    const studentRows = document.querySelectorAll("#attendance-student-list tr");
    if (studentRows.length === 0) {
        alert("No students found to mark attendance!");
        return;
    }

    try {
        for (const row of studentRows) {
            const studentId = row.getAttribute("data-student-id");
            const status = row.querySelector("td:nth-child(3)").innerText;

            const attendanceQuery = query(
                collection(db, "attendance"),
                where("studentId", "==", studentId),
                where("classId", "==", classId),
                where("date", "==", date)
            );
            const attendanceSnapshot = await getDocs(attendanceQuery);

            if (attendanceSnapshot.empty) {
                await addDoc(collection(db, "attendance"), {
                    studentId,
                    classId,
                    date,
                    status,
                });
            } else {
                const attendanceId = attendanceSnapshot.docs[0].id;
                await updateDoc(doc(db, "attendance", attendanceId), {
                    status,
                });
            }
        }

        alert("Attendance saved successfully!");
    } catch (error) {
        console.error("Error saving attendance:", error);
        alert("Error saving attendance. Please try again.");
    }
};

// Helper Functions
async function fetchDashboardData() {
    try {
        const studentsSnapshot = await getDocs(collection(db, "students"));
        const totalStudents = studentsSnapshot.size;

        const teachersSnapshot = await getDocs(collection(db, "teachers"));
        const totalTeachers = teachersSnapshot.size;

        const classesSnapshot = await getDocs(collection(db, "classes"));
        const totalClasses = classesSnapshot.size;

        document.getElementById("total-students").innerText = totalStudents;
        document.getElementById("total-teachers").innerText = totalTeachers;
        document.getElementById("total-classes").innerText = totalClasses;
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        alert("Error fetching dashboard data. Please try again.");
    }
}

async function fetchClassesForDropdown(dropdownId) {
    const classSelect = document.getElementById(dropdownId);
    classSelect.innerHTML = "<option value=''>Select Class</option>";

    try {
        const classesSnapshot = await getDocs(collection(db, "classes"));
        classesSnapshot.forEach((doc) => {
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent = doc.data().name;
            classSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error fetching classes:", error);
        alert("Error fetching classes. Please try again.");
    }
}

async function fetchClassesForAttendanceDropdown() {
    const classSelect = document.getElementById("attendance-class");
    classSelect.innerHTML = "<option value=''>Select Class</option>";

    try {
        const classesSnapshot = await getDocs(collection(db, "classes"));
        classesSnapshot.forEach((doc) => {
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent = doc.data().name;
            classSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error fetching classes:", error);
        alert("Error fetching classes. Please try again.");
    }
}

document.getElementById("teacher-form").addEventListener("submit", window.saveTeacher);
document.getElementById("student-form").addEventListener("submit", window.saveStudent);