import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAd5V0nDOu29Y9U_vfhkSgLObpgZbzOrqg",
    authDomain: "prepwise-32dfe.firebaseapp.com",
    projectId: "prepwise-32dfe",
    storageBucket: "prepwise-32dfe.firebasestorage.app",
    messagingSenderId: "537284123273",
    appId: "1:537284123273:web:5aa974d0a104740bac8458",
    measurementId: "G-CFGZTTXZ21",
};

// ✅ FIXED
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ✅ FIXED
export const auth = getAuth(app);
export const db = getFirestore(app);