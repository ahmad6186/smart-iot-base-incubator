// Firebase configuration
import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Your web app's Firebase configuration
// You can use environment variables or hardcode for development
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBOE6ihB5uDTSPSsT2mtyfeBVjbI0-kKh8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "smart-iot-base-incubator.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "smart-iot-base-incubator",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "smart-iot-base-incubator.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1098334965708",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1098334965708:web:abfd009e8d5234939f9769",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-E50396W51G"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firebase Analytics (only in browser environment)
let analytics = null
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app)
}

// Initialize Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export { analytics }

export default app

