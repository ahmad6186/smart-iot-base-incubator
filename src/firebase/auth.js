// Firebase Authentication helper functions

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth, getAdminAuth, db } from './config'
import { createUserProfile, ensureUserProfile } from './firestore'
import { doc, setDoc } from 'firebase/firestore'

/**
 * Sign in with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise} - User credential
 */
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    return { success: true, user: userCredential.user }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Sign up with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} displayName - User display name (optional)
 * @returns {Promise} - User credential
 */
export const signUp = async (email, password, displayName = null) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    
    // Update profile if display name is provided
    if (displayName) {
      await updateProfile(userCredential.user, { displayName })
    }

    const profileResult = await createUserProfile(userCredential.user, {
      name: displayName,
      role: 'Parent',
    })

    if (!profileResult.success) {
      console.error('Failed to create user profile:', profileResult.error)
    }
    
    return { success: true, user: userCredential.user }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Sign out current user
 * @returns {Promise}
 */
export const logOut = async () => {
  try {
    await signOut(auth)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Create a new user while keeping the current admin session intact.
 * Uses a secondary Firebase app instance so admins can provision accounts.
 */
export const createUserAsAdmin = async ({ email, password, displayName, role = 'Parent' }) => {
  const adminAuth = getAdminAuth()

  try {
    const userCredential = await createUserWithEmailAndPassword(adminAuth, email, password)
    const { user: newUser } = userCredential

    if (displayName) {
      await updateProfile(newUser, { displayName })
    }

    const profile = {
      name: displayName,
      email: newUser.email || email,
      role,
      createdAt: new Date(),
    }

    await setDoc(doc(db, 'users', newUser.uid), profile, { merge: false })

    return {
      success: true,
      data: {
        uid: newUser.uid,
        email: newUser.email,
      },
    }
  } catch (error) {
    return { success: false, error: error.message }
  } finally {
    await signOut(adminAuth).catch(() => {})
  }
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise}
 */
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Get current user
 * @returns {Object|null} - Current user or null
 */
export const getCurrentUser = () => {
  return auth.currentUser
}

/**
 * Listen to authentication state changes
 * @param {Function} callback - Callback function that receives the user
 * @returns {Function} - Unsubscribe function
 */
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        await ensureUserProfile(user, {
          name: user.displayName || 'User',
          email: user.email || '',
          role: 'Parent',
        })
      } catch (error) {
        console.error('Error ensuring user profile:', error)
      }
    }
    callback(user)
  })
}
