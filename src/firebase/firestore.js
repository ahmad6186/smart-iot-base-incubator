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
} from 'firebase/firestore'
import { db } from './config'

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

