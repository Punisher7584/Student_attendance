import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, getDocs, doc, getDoc, deleteDoc, updateDoc, query, where, addDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    getDatabase, ref, get, set, push, remove, child, update // Added 'update' here
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { 
    getAuth, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCnNDrfQexuEyMXMKGCv_CMf1jfDtqLmuw",
    authDomain: "student-attendance-mangament.firebaseapp.com",
    databaseURL: "https://student-attendance-mangament.firebaseio.com",
    projectId: "student-attendance-mangament",
    storageBucket: "student-attendance-mangament.appspot.com",
    messagingSenderId: "899024610963",
    appId: "1:899024610963:web:9e9654f79078f309078f66"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // Firestore instance
const rtdb = getDatabase(app); // Realtime Database instance
const auth = getAuth(app);

export { 
    db, // Firestore
    rtdb, // Realtime Database
    auth,
    // Firestore functions
    collection, getDocs, doc, getDoc, deleteDoc, updateDoc, query, where, addDoc,
    // Realtime DB functions
    ref, get, set, push, remove, child, update, // Added 'update' here
    // Auth functions
    signOut, onAuthStateChanged
};