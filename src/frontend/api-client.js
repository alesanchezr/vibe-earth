/**
 * API Client for interacting with the backend
 */
export class ApiClient {
  /**
   * Create a new API client
   */
  constructor() {
    // Determine if we're in development mode (Vite uses port 5173 by default)
    const isDev = window.location.port === '5173';
    
    // In development, connect to the backend server on port 3000
    // In production, connect to the same host
    const host = isDev ? 'localhost:3000' : window.location.host;
    const protocol = window.location.protocol;
    
    this.baseUrl = `${protocol}//${host}`;
    console.log(`API client initialized with base URL: ${this.baseUrl}`);
  }
  
  /**
   * Get active user count
   * @returns {Promise<Object>} Response with totalUsers property
   */
  async getStats() {
    try {
      const response = await fetch(`${this.baseUrl}/api/stats`);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  }
  
  /**
   * Add a random user
   * @returns {Promise<Object>} Response with the new user data
   */
  async addRandomUser() {
    try {
      const response = await fetch(`${this.baseUrl}/api/users/random`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error adding random user:', error);
      throw error;
    }
  }
  
  /**
   * Add a custom user
   * @param {Object} userData User data
   * @param {number} userData.position_x X position
   * @param {number} userData.position_y Y position
   * @param {number} userData.position_z Z position
   * @param {number} userData.size Size
   * @param {string} userData.color Color
   * @returns {Promise<Object>} Response with the new user data
   */
  async addCustomUser(userData) {
    try {
      const response = await fetch(`${this.baseUrl}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error adding custom user:', error);
      throw error;
    }
  }
  
  /**
   * Remove all users
   * @returns {Promise<Object>} Response with success status
   */
  async truncateUsers() {
    try {
      const response = await fetch(`${this.baseUrl}/api/truncate-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error truncating users:', error);
      throw error;
    }
  }
} 