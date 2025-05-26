// Update your import statement to include 'update'
import { 
    db, rtdb, auth,
    collection, getDocs, doc, getDoc, deleteDoc, updateDoc, query, where, addDoc,
    ref, get, set, push, remove, child, update, // Added 'update'
    signOut, onAuthStateChanged
} from './firebase-config.js';

// Global Functions
window.showSection = function(sectionId) {
    document.querySelectorAll(".main-content > div").forEach((section) => {
        section.style.display = "none";
    });

    const selectedSection = document.getElementById(sectionId);
    if (selectedSection) {
        selectedSection.style.display = "block";
    }

    // Load data based on which section is selected
    switch(sectionId) {
        case "dashboard":
            fetchDashboardData();
            break;
            
        case "manage-classes":
            fetchClasses();
            break;
            
        case "manage-teachers":
            fetchClassesForDropdown("teacher-class");
            fetchTeachers();
            break;
            
        case "manage-students":
            fetchClassesForDropdown("student-class");
            fetchStudents();
            break;
            
        case "attendance":
            fetchClassesForAttendanceDropdown();
            break;
            
        case "manage-subjects":
            // Load classes for subjects dropdown and all existing subjects
            fetchClassesForDropdown("subject-class");
            loadAllSubjects();
            break;
            
        default:
            // No special handling for other sections
            break;
    }
};

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
window.addClass = async function() {
    const className = document.getElementById("class-name").value.trim();
    if (className !== "") {
        try {
            await addDoc(collection(db, "classes"), { name: className });
            document.getElementById("class-name").value = "";
            fetchClasses();
            alert("Class added successfully!");
        } catch (error) {
            console.error("Error adding class:", error);
            alert("Error adding class. Please try again.");
        }
    } else {
        alert("Please enter a class name!");
    }
};

window.addSemesterInput = function() {
    const container = document.getElementById('semester-inputs');
    const newInput = document.createElement('input');
    newInput.type = 'text';
    newInput.className = 'semester-name';
    newInput.placeholder = 'Semester Name';
    container.appendChild(newInput);
};

async function fetchClasses() {
    const classList = document.getElementById("class-list");
    classList.innerHTML = "<p>Loading classes...</p>";

    try {
        console.log("Attempting to fetch classes from Realtime DB...");
        const classesRef = ref(rtdb, 'classes');
        const snapshot = await get(classesRef);
        
        console.log("Snapshot exists?", snapshot.exists());
        console.log("Snapshot value:", snapshot.val());
        
        if (!snapshot.exists()) {
            console.log("No classes found in Realtime DB");
            classList.innerHTML = "<p>No classes found. Create your first class!</p>";
            return;
        }
        
        const classes = snapshot.val();
        console.log("Classes data:", classes);
        classList.innerHTML = "";
        
        for (const classId in classes) {
            const classData = classes[classId];
            console.log(`Processing class ${classId}:`, classData);
            
            let semestersHtml = '<ul>';
            
            if (classData.semesters) {
                console.log(`Found ${Object.keys(classData.semesters).length} semesters`);
                for (const semesterId in classData.semesters) {
                    const semester = classData.semesters[semesterId];
                    semestersHtml += `<li>${semester.name}</li>`;
                }
            } else {
                console.log("No semesters found for this class");
                semestersHtml += '<li>No semesters</li>';
            }
            semestersHtml += '</ul>';
            
            const classItem = document.createElement("div");
            classItem.className = "class-item";
            classItem.innerHTML = `
                <div class="class-info">
                    <h3>${classData.name}</h3>
                    <div class="semester-list">
                        <h4>Semesters:</h4>
                        ${semestersHtml}
                    </div>
                </div>
                <div class="class-actions">
                    <button class="edit-btn" onclick="editClass('${classId}')">Edit</button>
                    <button class="delete-btn" onclick="deleteClass('${classId}')">Delete</button>
                </div>
            `;
            classList.appendChild(classItem);
        }
    } catch (error) {
        console.error("Error fetching classes:", error);
        classList.innerHTML = `
            <p>Error loading classes. Please check console.</p>
            <p>${error.message}</p>
        `;
    }
}


window.addClassWithSemesters = async function() {
    const className = document.getElementById('class-name').value.trim();
    const semesterInputs = document.querySelectorAll('.semester-name');
    const semesters = {};
    
    console.log("Attempting to add class with semesters...");
    console.log("Class Name:", className);
    console.log("Semester Inputs:", semesterInputs);

    // Collect semester names
    semesterInputs.forEach(input => {
        if (input.value.trim()) {
            const semesterId = push(ref(rtdb, 'temp')).key; // Generate ID
            semesters[semesterId] = {
                name: input.value.trim(),
                subjects: {}
            };
            console.log("Added semester:", input.value.trim());
        }
    });
    
    if (!className) {
        console.log("No class name provided");
        alert('Please enter a class name!');
        return;
    }
    
    if (Object.keys(semesters).length === 0) {
        console.log("No semesters provided");
        alert('Please add at least one semester!');
        return;
    }
    
    try {
        console.log("Creating class in Realtime Database...");
        const newClassRef = push(ref(rtdb, 'classes'));
        console.log("New class reference:", newClassRef);
        
        const classData = {
            name: className,
            semesters: semesters
        };
        console.log("Class data to save:", classData);
        
        await set(newClassRef, classData);
        console.log("Class saved to Realtime DB");
        
        // Also add to Firestore
        console.log("Adding to Firestore...");
        await addDoc(collection(db, "classes"), {
            name: className,
            rtdbId: newClassRef.key
        });
        console.log("Class saved to Firestore");
        
        // Clear form
        document.getElementById('class-name').value = '';
        document.getElementById('semester-inputs').innerHTML = 
            '<input type="text" class="semester-name" placeholder="Semester Name">';
        
        fetchClasses();
        alert('Class with semesters added successfully!');
    } catch (error) {
        console.error('Error adding class:', error);
        alert(`Error adding class: ${error.message}`);
    }
};



window.editClass = async function(classId) {
    try {
        // Get class data from Realtime DB
        const classRef = ref(rtdb, `classes/${classId}`);
        const snapshot = await get(classRef);
        
        if (!snapshot.exists()) {
            alert("Class not found!");
            return;
        }
        
        const classData = snapshot.val();
        const newName = prompt("Enter new class name:", classData.name);
        
        if (newName && newName.trim() !== "") {
            // Update class name in Realtime DB
            await update(classRef, { name: newName });
            
            // Also update in Firestore if exists
            const q = query(collection(db, "classes"), where("rtdbId", "==", classId));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(async (doc) => {
                await updateDoc(doc.ref, { name: newName });
            });
            
            fetchClasses();
            alert("Class updated successfully!");
        }
    } catch (error) {
        console.error("Error updating class:", error);
        alert("Error updating class. Please try again.");
    }
};


window.deleteClass = async function(classId) {
    if (confirm("Are you sure you want to delete this class and all its semesters?")) {
        try {
            // Delete from Realtime Database
            const classRef = ref(rtdb, `classes/${classId}`);
            await remove(classRef);
            
            // Also delete from Firestore if exists
            const q = query(collection(db, "classes"), where("rtdbId", "==", classId));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(async (doc) => {
                await deleteDoc(doc.ref);
            });
            
            fetchClasses();
            alert("Class deleted successfully!");
        } catch (error) {
            console.error("Error deleting class:", error);
            alert("Error deleting class. Please try again.");
        }
    }
};

// Teacher Management Functions
window.saveTeacher = async function(event) {
    event.preventDefault();

    const firstName = document.getElementById("first-name").value.trim();
    const lastName = document.getElementById("last-name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const classId = document.getElementById("teacher-class").value;

    if (!firstName || !lastName || !email || !phone || !classId) {
        alert("Please fill all fields!");
        return;
    }

    try {
        await addDoc(collection(db, "teachers"), {
            firstName,
            lastName,
            email,
            phone,
            classId,
        });

        document.getElementById("teacher-form").reset();
        fetchTeachers();
        alert("Teacher saved successfully!");
    } catch (error) {
        console.error("Error saving teacher:", error);
        alert("Error saving teacher. Please try again.");
    }
};

async function fetchTeachers() {
    const teacherList = document.getElementById("teacher-list");
    teacherList.innerHTML = "<h2>Saved Teachers</h2>";

    try {
        const teachersSnapshot = await getDocs(collection(db, "teachers"));
        if (teachersSnapshot.empty) {
            teacherList.innerHTML += "<p>No teachers found.</p>";
        } else {
            teachersSnapshot.forEach(async (teacherDoc) => {
                const teacherData = teacherDoc.data();
                const classDocRef = doc(db, "classes", teacherData.classId);
                const classDoc = await getDoc(classDocRef);
                const className = classDoc.exists() ? classDoc.data().name : "Unknown Class";

                const teacherItem = document.createElement("div");
                teacherItem.innerHTML = `
                    <p><strong>${teacherData.firstName} ${teacherData.lastName}</strong></p>
                    <p>Email: ${teacherData.email}</p>
                    <p>Phone: ${teacherData.phone}</p>
                    <p>Class: ${className}</p>
                    <button class="edit-btn" onclick="editTeacher('${teacherDoc.id}')">Edit</button>
                    <button class="delete-btn" onclick="deleteTeacher('${teacherDoc.id}')">Delete</button>
                `;
                teacherList.appendChild(teacherItem);
            });
        }
    } catch (error) {
        console.error("Error fetching teachers:", error);
        alert("Error fetching teachers. Please try again.");
    }
}

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
    if (confirm("Are you sure you want to delete this teacher?")) {
        try {
            await deleteDoc(doc(db, "teachers", id));
            fetchTeachers();
            alert("Teacher deleted successfully!");
        } catch (error) {
            console.error("Error deleting teacher:", error);
            alert("Error deleting teacher. Please try again.");
        }
    }
};

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

// Event Listeners
document.getElementById("teacher-form").addEventListener("submit", window.saveTeacher);
document.getElementById("student-form").addEventListener("submit", window.saveStudent);



document.addEventListener('DOMContentLoaded', () => {
    loadClassesForDropdowns();
    loadAllSubjects();
});




document.addEventListener('DOMContentLoaded', () => {
    loadClassesForDropdowns();
    loadAllSubjects();
});

// function loadClassesForDropdowns() {
//     get(classesRef).then((snapshot) => {
//         const classes = snapshot.val() || {};
        
//         // Populate class dropdowns (for subjects, attendance, etc.)
//         const classDropdowns = [
//             document.getElementById('subject-class'),
//             document.getElementById('attendance-class'),
//             document.getElementById('teacher-class'),
//             document.getElementById('student-class')
//         ];
        
//         classDropdowns.forEach(dropdown => {
//             dropdown.innerHTML = '<option value="">Select Class</option>';
//             for (const classId in classes) {
//                 const className = classes[classId].name;
//                 dropdown.innerHTML += `<option value="${classId}">${className}</option>`;
//             }
//         });
//     });
// }

// function loadAllSubjects() {
//     get(subjectsRef).then((snapshot) => {
//         const subjects = snapshot.val() || {};
//         const existingSubjectsDropdown = document.getElementById('existing-subjects');
        
//         existingSubjectsDropdown.innerHTML = '<option value="">Select from existing subjects</option>';
//         for (const subjectId in subjects) {
//             existingSubjectsDropdown.innerHTML += `<option value="${subjectId}">${subjects[subjectId]}</option>`;
//         }
//     });
// }

async function loadClassesForDropdowns() {
    try {
        // Get from both Firestore and RTDB to sync
        const [firestoreSnapshot, rtdbSnapshot] = await Promise.all([
            getDocs(collection(db, "classes")),
            get(ref(rtdb, 'classes'))
        ]);
        
        const classDropdowns = [
            document.getElementById('subject-class'),
            document.getElementById('attendance-class'),
            document.getElementById('teacher-class'),
            document.getElementById('student-class')
        ];
        
        // Create a map of all available classes
        const classesMap = {};
        
        // Add Firestore classes
        firestoreSnapshot.forEach(doc => {
            classesMap[doc.id] = {
                name: doc.data().name,
                rtdbId: doc.data().rtdbId || doc.id
            };
        });
        
        // Add RTDB classes (in case they're not in Firestore)
        if (rtdbSnapshot.exists()) {
            const rtdbClasses = rtdbSnapshot.val();
            for (const classId in rtdbClasses) {
                if (!Object.values(classesMap).some(c => c.rtdbId === classId)) {
                    classesMap[classId] = {
                        name: rtdbClasses[classId].name,
                        rtdbId: classId
                    };
                }
            }
        }
        
        // Populate all dropdowns
        classDropdowns.forEach(dropdown => {
            dropdown.innerHTML = '<option value="">Select Class</option>';
            for (const [id, classData] of Object.entries(classesMap)) {
                const option = document.createElement("option");
                option.value = id; // Use Firestore ID if available
                option.textContent = classData.name;
                option.dataset.rtdbId = classData.rtdbId; // Store RTDB reference
                dropdown.appendChild(option);
            }
        });
    } catch (error) {
        console.error("Error loading classes:", error);
        alert("Error loading classes. Please check console.");
    }
}


// Get reference to subjects in Realtime Database
function getSubjectsRef() {
    return ref(rtdb, 'subjects');
}

// Get reference to classes in Realtime Database
function getClassesRef() {
    return ref(rtdb, 'classes');
}

async function loadAllSubjects() {
    try {
        const snapshot = await get(getSubjectsRef());
        const subjects = snapshot.val() || {};
        const existingSubjectsDropdown = document.getElementById('existing-subjects');
        
        existingSubjectsDropdown.innerHTML = '<option value="">Select from existing subjects</option>';
        for (const subjectId in subjects) {
            existingSubjectsDropdown.innerHTML += `<option value="${subjectId}">${subjects[subjectId]}</option>`;
        }
    } catch (error) {
        console.error("Error loading subjects:", error);
        alert("Error loading subjects. Please try again.");
    }
}

window.fetchSemestersForClass = async function() {
    const classId = document.getElementById('subject-class').value;
    const semesterDropdown = document.getElementById('subject-semester');
    
    semesterDropdown.innerHTML = '<option value="">Loading semesters...</option>';
    
    if (!classId) {
        semesterDropdown.innerHTML = '<option value="">Select Class First</option>';
        return;
    }
    
    try {
        const semestersRef = ref(rtdb, `classes/${classId}/semesters`);
        const snapshot = await get(semestersRef);
        
        if (!snapshot.exists()) {
            semesterDropdown.innerHTML = '<option value="">No semesters found</option>';
            return;
        }
        
        const semesters = snapshot.val();
        semesterDropdown.innerHTML = '<option value="">Select Semester</option>';
        
        for (const semesterId in semesters) {
            const semester = semesters[semesterId];
            semesterDropdown.innerHTML += `
                <option value="${semesterId}">${semester.name}</option>
            `;
        }
    } catch (error) {
        console.error("Failed to fetch semesters:", error);
        semesterDropdown.innerHTML = '<option value="">Error loading semesters</option>';
    }
};

window.addSubjectToClassSemester = async function() {
    const classId = document.getElementById('subject-class').value;
    const semesterId = document.getElementById('subject-semester').value;
    const existingSubjectId = document.getElementById('existing-subjects').value;
    const newSubjectName = document.getElementById('new-subject').value.trim();
    
    if (!classId || !semesterId) {
        alert("Please select a class and semester first!");
        return;
    }
    
    if (!existingSubjectId && !newSubjectName) {
        alert("Please select an existing subject or enter a new subject!");
        return;
    }
    
    try {
        if (existingSubjectId) {
            // Add existing subject
            const subjectSnapshot = await get(child(getSubjectsRef(), existingSubjectId));
            const subjectRef = child(getClassesRef(), `${classId}/semesters/${semesterId}/subjects/${existingSubjectId}`);
            await set(subjectRef, subjectSnapshot.val());
        } else {
            // Add new subject
            const newSubjectRef = push(getSubjectsRef());
            await set(newSubjectRef, newSubjectName);
            
            const subjectId = newSubjectRef.key;
            const classSubjectRef = child(getClassesRef(), `${classId}/semesters/${semesterId}/subjects/${subjectId}`);
            await set(classSubjectRef, newSubjectName);
        }
        
        alert("Subject added successfully!");
        document.getElementById('new-subject').value = "";
        loadAllSubjects();
        fetchSubjectsForClassSemester();
    } catch (error) {
        console.error("Error adding subject:", error);
        alert("Error adding subject. Please try again.");
    }
};

window.fetchSubjectsForClassSemester = async function() {
    const classId = document.getElementById('subject-class').value;
    const semesterId = document.getElementById('subject-semester').value;
    const subjectsTable = document.getElementById('current-subjects-table');
    
    if (!classId || !semesterId) {
        subjectsTable.innerHTML = "";
        return;
    }
    
    try {
        const snapshot = await get(child(getClassesRef(), `${classId}/semesters/${semesterId}/subjects`));
        const subjects = snapshot.val() || {};
        subjectsTable.innerHTML = "";
        
        for (const subjectId in subjects) {
            const subjectName = subjects[subjectId];
            subjectsTable.innerHTML += `
                <tr>
                    <td>${subjectName}</td>
                    <td>
                        <button onclick="removeSubject('${classId}', '${semesterId}', '${subjectId}')">Remove</button>
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error("Error fetching subjects:", error);
        subjectsTable.innerHTML = "<tr><td>Error loading subjects</td></tr>";
    }
};

window.removeSubject = async function(classId, semesterId, subjectId) {
    if (confirm("Are you sure you want to remove this subject?")) {
        try {
            const subjectRef = child(getClassesRef(), `${classId}/semesters/${semesterId}/subjects/${subjectId}`);
            await remove(subjectRef);
            alert("Subject removed successfully!");
            fetchSubjectsForClassSemester();
        } catch (error) {
            console.error("Error removing subject:", error);
            alert("Error removing subject. Please try again.");
        }
    }
};



window.addSemesterToClass = async function() {
    const classSelect = document.getElementById('subject-class');
    const selectedOption = classSelect.options[classSelect.selectedIndex];
    const classId = selectedOption.dataset.rtdbId || classSelect.value;
    const semesterName = document.getElementById('new-semester').value.trim();
    
    if (!classId) {
        alert("Please select a valid class first!");
        return;
    }
    
    if (!semesterName) {
        alert("Please enter a semester name!");
        return;
    }
    
    try {
        const semestersRef = ref(rtdb, `classes/${classId}/semesters`);
        const newSemesterRef = push(semestersRef);
        
        await set(newSemesterRef, { 
            name: semesterName,
            subjects: {}
        });
        
        alert("Semester added successfully!");
        document.getElementById('new-semester').value = "";
        fetchSemestersForClass(); // Refresh the dropdown
        
        // Also refresh the classes list
        fetchClasses();
    } catch (error) {
        console.error("Error adding semester:", error);
        alert(`Error adding semester: ${error.message}`);
    }
};


