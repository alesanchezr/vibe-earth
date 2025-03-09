/**
 * Authentication Client for the application
 * Uses server-side authentication for security
 */
import { ApiClient } from './api-client.js';

// Create API client for authentication requests
const apiClient = new ApiClient();

/**
 * Sign in anonymously via the server
 * @returns {Promise<Object>} The user session
 * @throws {Error} If authentication fails
 */
export async function signInAnonymously() {
  console.log('Authenticating anonymously via server...');
  
  // Check if we already have a token in localStorage
  const storedToken = localStorage.getItem('auth_token');
  const storedUserId = localStorage.getItem('user_id');
  
  if (storedToken && storedUserId) {
    console.log('Found stored credentials, verifying...');
    
    // Verify the token with the server
    try {
      const verifyResponse = await apiClient.post('/api/auth/verify', {
        token: storedToken
      });
      
      if (verifyResponse.success && verifyResponse.user.id === storedUserId) {
        console.log('Stored credentials verified');
        return {
          user: {
            id: storedUserId
          },
          session: {
            access_token: storedToken
          }
        };
      }
    } catch (error) {
      console.warn('Stored token verification failed:', error.message);
      // Clear invalid credentials
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_id');
    }
  }
  
  // No valid stored token, create a new anonymous user
  try {
    const response = await apiClient.post('/api/auth/anonymous', {});
    
    if (!response.success) {
      throw new Error(response.error || 'Authentication failed');
    }
    
    console.log('Anonymous authentication successful:', response.user.id);
    
    // Store the token and user ID in localStorage
    localStorage.setItem('auth_token', response.session.access_token);
    localStorage.setItem('user_id', response.user.id);
    
    return {
      user: response.user,
      session: response.session
    };
  } catch (error) {
    console.error('Error in anonymous authentication:', error);
    throw new Error('Authentication failed: ' + (error.message || 'Unknown error'));
  }
}

/**
 * Get the current user ID
 * @returns {Promise<string|null>} The user ID or null if not authenticated
 */
export async function getCurrentUserId() {
  try {
    const storedUserId = localStorage.getItem('user_id');
    if (storedUserId) {
      return storedUserId;
    }
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Sign out the current user
 * @returns {Promise<void>}
 */
export async function signOut() {
  try {
    // Clear local storage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    console.log('Signed out successfully');
  } catch (error) {
    console.error('Error signing out:', error);
  }
} 