// Firestore helper functions
// Example usage of Firebase Firestore database

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  setDoc,
} from 'firebase/firestore'
import { db } from './config'

const USERS_COLLECTION = 'users'

/**
 * Add a document to a collection
 * @param {string} collectionName - Name of the collection
 * @param {Object} data - Data to add
 * @returns {Promise} - Document reference
 */
export const addDocument = async (collectionName, data) => {
  try {
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    return { success: true, id: docRef.id }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Get all documents from a collection
 * @param {string} collectionName - Name of the collection
 * @returns {Promise} - Array of documents
 */
export const getDocuments = async (collectionName) => {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName))
    const documents = []
    querySnapshot.forEach((doc) => {
      documents.push({ id: doc.id, ...doc.data() })
    })
    return { success: true, data: documents }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Get a single document by ID
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @returns {Promise} - Document data
 */
export const getDocument = async (collectionName, docId) => {
  try {
    const docRef = doc(db, collectionName, docId)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return { success: true, data: { id: docSnap.id, ...docSnap.data() } }
    } else {
      return { success: false, error: 'Document not found' }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Update a document
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @param {Object} data - Data to update
 * @returns {Promise}
 */
export const updateDocument = async (collectionName, docId, data) => {
  try {
    const docRef = doc(db, collectionName, docId)
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date(),
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Delete a document
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @returns {Promise}
 */
export const deleteDocument = async (collectionName, docId) => {
  try {
    await deleteDoc(doc(db, collectionName, docId))
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Query documents with filters
 * @param {string} collectionName - Name of the collection
 * @param {Array} filters - Array of filter objects { field, operator, value }
 * @param {string} orderByField - Field to order by
 * @param {string} orderDirection - 'asc' or 'desc'
 * @param {number} limitCount - Maximum number of documents
 * @returns {Promise} - Array of documents
 */
export const queryDocuments = async (
  collectionName,
  filters = [],
  orderByField = null,
  orderDirection = 'asc',
  limitCount = null
) => {
  try {
    let q = collection(db, collectionName)
    
    // Apply filters
    filters.forEach((filter) => {
      q = query(q, where(filter.field, filter.operator, filter.value))
    })
    
    // Apply ordering
    if (orderByField) {
      q = query(q, orderBy(orderByField, orderDirection))
    }
    
    // Apply limit
    if (limitCount) {
      q = query(q, limit(limitCount))
    }
    
    const querySnapshot = await getDocs(q)
    const documents = []
    querySnapshot.forEach((doc) => {
      documents.push({ id: doc.id, ...doc.data() })
    })
    
    return { success: true, data: documents }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Listen to real-time updates from a collection
 * @param {string} collectionName - Name of the collection
 * @param {Function} callback - Callback function that receives the documents
 * @returns {Function} - Unsubscribe function
 */
export const subscribeToCollection = (collectionName, callback) => {
  const unsubscribe = onSnapshot(
    collection(db, collectionName),
    (querySnapshot) => {
      const documents = []
      querySnapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() })
      })
      callback(documents)
    },
    (error) => {
      console.error('Error listening to collection:', error)
      callback([], error)
    }
  )
  
  return unsubscribe
}

/**
 * Listen to a single document in real time
 * @param {string} collectionName
 * @param {string} docId
 * @param {Function} callback
 * @returns {Function}
 */
export const subscribeToDocument = (collectionName, docId, callback) => {
  const docRef = doc(db, collectionName, docId)
  const unsubscribe = onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() })
      } else {
        callback(null)
      }
    },
    (error) => {
      console.error('Error listening to document:', error)
      callback(null, error)
    }
  )

  return unsubscribe
}

/**
 * Set/overwrite document data
 * @param {string} collectionName
 * @param {string} docId
 * @param {Object} data
 * @param {boolean} merge
 * @returns {Promise}
 */
export const setDocument = async (collectionName, docId, data, merge = true) => {
  try {
    const docRef = doc(db, collectionName, docId)
    await setDoc(docRef, data, { merge })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Create a Firestore user profile document if it does not exist.
 * @param {import('firebase/auth').User} user
 * @param {Object} extraData
 */
export const createUserProfile = async (user, extraData = {}) => {
  if (!user?.uid) {
    return { success: false, error: 'Invalid user object' }
  }

  try {
    const docRef = doc(db, USERS_COLLECTION, user.uid)
    const snapshot = await getDoc(docRef)

    if (snapshot.exists()) {
      return { success: true, alreadyExists: true, data: snapshot.data() }
    }

    const profile = {
      name: extraData.name || user.displayName || 'User',
      email: user.email || extraData.email || '',
      role: extraData.role || 'Parent',
      createdAt: new Date(),
    }

    await setDoc(docRef, profile, { merge: false })

    return { success: true, data: profile }
  } catch (error) {
    console.error('Error creating user profile:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get a Firestore user profile.
 * @param {string} uid
 */
export const getUserProfile = async (uid) => {
  if (!uid) {
    return { success: false, error: 'Missing UID' }
  }

  try {
    const docRef = doc(db, USERS_COLLECTION, uid)
    const snapshot = await getDoc(docRef)

    if (!snapshot.exists()) {
      return { success: false, error: 'User profile not found' }
    }

    return { success: true, data: { id: snapshot.id, ...snapshot.data() } }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Ensure a user profile exists, creating it when necessary.
 * @param {import('firebase/auth').User} user
 * @param {Object} fallbackData
 */
export const ensureUserProfile = async (user, fallbackData = {}) => {
  const result = await createUserProfile(user, fallbackData)
  if (!result.success) {
    console.error('Failed to ensure user profile:', result.error)
  }
  return result
}

/**
 * Example usage:
 * 
 * // Add a document
 * const result = await addDocument('users', { name: 'John', email: 'john@example.com' })
 * 
 * // Get all documents
 * const { data } = await getDocuments('users')
 * 
 * // Get a single document
 * const { data } = await getDocument('users', 'document-id')
 * 
 * // Update a document
 * await updateDocument('users', 'document-id', { name: 'Jane' })
 * 
 * // Delete a document
 * await deleteDocument('users', 'document-id')
 * 
 * // Query with filters
 * const { data } = await queryDocuments(
 *   'users',
 *   [{ field: 'email', operator: '==', value: 'john@example.com' }],
 *   'createdAt',
 *   'desc',
 *   10
 * )
 * 
 * // Real-time subscription
 * const unsubscribe = subscribeToCollection('users', (users) => {
 *   console.log('Users updated:', users)
 * })
 * // Later, to stop listening:
 * unsubscribe()
 */
