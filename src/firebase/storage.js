// Firebase Storage helper functions
// Example usage of Firebase Storage for file uploads

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
  getMetadata,
} from 'firebase/storage'
import { storage } from './config'

/**
 * Upload a file to Firebase Storage
 * @param {File} file - File to upload
 * @param {string} path - Storage path (e.g., 'images/profile.jpg')
 * @param {Function} onProgress - Optional progress callback
 * @returns {Promise} - Download URL
 */
export const uploadFile = async (file, path, onProgress = null) => {
  try {
    const storageRef = ref(storage, path)
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, file)
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref)
    
    return { success: true, url: downloadURL, path: path }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Get download URL for a file
 * @param {string} path - Storage path
 * @returns {Promise} - Download URL
 */
export const getFileURL = async (path) => {
  try {
    const storageRef = ref(storage, path)
    const url = await getDownloadURL(storageRef)
    return { success: true, url }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Delete a file from Storage
 * @param {string} path - Storage path
 * @returns {Promise}
 */
export const deleteFile = async (path) => {
  try {
    const storageRef = ref(storage, path)
    await deleteObject(storageRef)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * List all files in a folder
 * @param {string} folderPath - Folder path
 * @returns {Promise} - Array of file references
 */
export const listFiles = async (folderPath) => {
  try {
    const folderRef = ref(storage, folderPath)
    const result = await listAll(folderRef)
    
    const files = []
    for (const itemRef of result.items) {
      const url = await getDownloadURL(itemRef)
      const metadata = await getMetadata(itemRef)
      files.push({
        name: itemRef.name,
        url,
        size: metadata.size,
        contentType: metadata.contentType,
        updated: metadata.updated,
      })
    }
    
    return { success: true, files }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Get file metadata
 * @param {string} path - Storage path
 * @returns {Promise} - File metadata
 */
export const getFileMetadata = async (path) => {
  try {
    const storageRef = ref(storage, path)
    const metadata = await getMetadata(storageRef)
    return { success: true, metadata }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * Example usage:
 * 
 * // Upload a file
 * const fileInput = document.querySelector('input[type="file"]')
 * const file = fileInput.files[0]
 * const result = await uploadFile(file, 'images/profile.jpg')
 * if (result.success) {
 *   console.log('File uploaded:', result.url)
 * }
 * 
 * // Get file URL
 * const { url } = await getFileURL('images/profile.jpg')
 * 
 * // Delete a file
 * await deleteFile('images/profile.jpg')
 * 
 * // List files in a folder
 * const { files } = await listFiles('images/')
 * 
 * // Get file metadata
 * const { metadata } = await getFileMetadata('images/profile.jpg')
 */

