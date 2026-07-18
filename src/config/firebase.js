import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
const firebaseConfig = {
  apiKey: "AIzaSyBAir7gb-cZNH_pHSe_mAkhQ5ZW0GEZgj0",
  authDomain: "rosewood-audio.firebaseapp.com",
  projectId: "rosewood-audio",
  storageBucket: "rosewood-audio.firebasestorage.app",
  messagingSenderId: "115788951436",
  appId: "1:115788951436:web:ce2ba3b01058977891b0a9",
  measurementId: "G-KXNQ9GXKRT"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
