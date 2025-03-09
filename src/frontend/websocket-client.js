/**
 * WebSocket Client for User World
 * Handles real-time communication with the backend server
 */
export class WebSocketClient {
  constructor(world) {
    console.log('WebSocketClient constructor called with world:', world);
    
    if (!world) {
      console.error('WebSocketClient constructor: world is null or undefined');
      throw new Error('WebSocketClient requires a valid World instance');
    }
    
    this.world = world;
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second delay
    
    // Use the Supabase user ID from the World instance
    this.clientId = this.world.userId;
    console.log('WebSocket client initialized with client ID:', this.clientId);
    
    if (!this.clientId) {
      console.warn('WebSocketClient: clientId is null or undefined');
    }
    
    this.connect();
  }
  
  /**
   * Connect to the WebSocket server
   */
  connect() {
    // Determine if we're in development mode (Vite uses port 5173 by default)
    const isDev = window.location.port === '5173';
    
    // Determine the WebSocket URL based on the current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // In development, connect to the backend server on port 3000
    // In production, connect to the same host
    const host = isDev ? 'localhost:3000' : window.location.host;
    const wsUrl = `${protocol}//${host}`;
    
    console.log(`Connecting to WebSocket server at ${wsUrl}`);
    
    // Create a new WebSocket connection
    this.socket = new WebSocket(wsUrl);
    
    // Set up event handlers
    this.socket.onopen = this.onOpen.bind(this);
    this.socket.onmessage = this.onMessage.bind(this);
    this.socket.onclose = this.onClose.bind(this);
    this.socket.onerror = this.onError.bind(this);
  }
  
  /**
   * Handle WebSocket connection open
   */
  onOpen() {
    console.log('WebSocket connection established');
    this.connected = true;
    this.reconnectAttempts = 0;
    
    // Update connection status in UI
    this.updateConnectionStatus(true);
    
    // If we have a client ID, wait 3 seconds before spawning the user
    // This ensures all world initialization animations are complete
    if (this.clientId) {
      console.log('Waiting 3 seconds before spawning user to allow world initialization to complete...');
      
      // Start a countdown from 3 seconds
      const totalDelay = 3000; // 3 seconds
      const countdownInterval = 1000; // 1 second
      let remainingTime = totalDelay;
      
      // Update status to show we're preparing to spawn with countdown
      this.updateConnectionStatus(true, `Spawning in ${remainingTime / 1000}...`);
      
      // Create a countdown timer
      const countdownTimer = setInterval(() => {
        remainingTime -= countdownInterval;
        
        if (remainingTime <= 0) {
          // Clear the interval when countdown is complete
          clearInterval(countdownTimer);
          
          // Update status to show we're spawning
          this.updateConnectionStatus(true, 'Spawning...');
          
          // Get the authentication token from localStorage
          const token = localStorage.getItem('auth_token');
          
          console.log('Sending spawn_user message with clientId:', this.clientId);
          this.send({
            type: 'spawn_user',
            clientId: this.clientId,
            token: token // Include the token for server-side verification
          });
        } else {
          // Update the countdown display
          this.updateConnectionStatus(true, `Spawning in ${remainingTime / 1000}...`);
        }
      }, countdownInterval);
    }
  }
  
  /**
   * Handle incoming WebSocket messages
   * @param {MessageEvent} event The WebSocket message event
   */
  onMessage(event) {
    console.log('WebSocket message received:', event.data);
    try {
      const data = JSON.parse(event.data);
      console.log('Parsed WebSocket message:', data);
      this.handleServerMessage(data);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }
  
  /**
   * Handle WebSocket connection close
   */
  onClose() {
    console.log('WebSocket connection closed');
    this.connected = false;
    
    // Update connection status in the UI
    this.updateConnectionStatus(false);
    
    // Attempt to reconnect if not exceeding max attempts
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      // Use exponential backoff for reconnect delay
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay);
      
      // Increase delay for next attempt (exponential backoff)
      this.reconnectDelay *= 2;
    } else {
      console.error('Maximum reconnect attempts reached. Please refresh the page.');
    }
  }
  
  /**
   * Handle WebSocket errors
   * @param {Event} error The WebSocket error event
   */
  onError(error) {
    console.error('WebSocket error:', error);
  }
  
  /**
   * Handle messages from the server
   * @param {Object} data The message data
   */
  handleServerMessage(data) {
    console.log('Handling server message of type:', data.type);
    switch (data.type) {
      case 'initial':
        // Handle initial user data
        console.log('Received initial data with', data.users ? data.users.length : 0, 'users');
        this.handleInitialData(data.users || []);
        break;
        
      case 'new_user':
        // Handle new user added
        console.log('Received new user data:', data.user);
        if (data.user) {
          console.log('Adding user from server with client_id:', data.user.client_id);
          console.log('Current user ID:', this.world.userId);
          
          // Check if this is the current user
          const isCurrentUser = data.user.client_id === this.world.userId;
          
          // Add the isCurrentUser flag to the user data
          const userData = {
            ...data.user,
            isCurrentUser
          };
          
          // If this is our user and we already have it, don't add it again
          if (isCurrentUser) {
            const existingUser = this.world.findUserGeek();
            if (existingUser) {
              console.log('Current user already exists, updating properties');
              
              // Update properties if needed
              if (userData.active !== undefined) existingUser.active = userData.active;
              
              // Focus the camera on the existing user
              console.log('Focusing camera on existing user');
              this.world.focusCameraOnGeek(existingUser, true);
              
              // Update status to show the user is active
              this.updateConnectionStatus(true, 'Active');
              
              break;
            }
          }
          
          const addedUser = this.world.addUserFromServer(userData);
          console.log('User added, returned object:', addedUser);
          
          // If this is our user, focus the camera on it
          if (isCurrentUser) {
            console.log('This is our user, focusing camera on it');
            
            // Update status to show the user is dropping
            this.updateConnectionStatus(true, 'Dropping...');
            
            // Focus the camera on the user's geek immediately
            if (addedUser) {
              console.log('Calling focusCameraOnGeek with:', addedUser);
              // Set returnToSky to true to return to sky view after the geek lands
              this.world.focusCameraOnGeek(addedUser, true);
              
              // Update status to active after the geek lands
              setTimeout(() => {
                this.updateConnectionStatus(true, 'Active');
              }, 5000); // Wait 5 seconds for the drop animation to complete
            } else {
              console.error('Added user object is null or undefined');
              this.updateConnectionStatus(true, 'Active'); // Fallback
            }
          } else {
            console.log('Not our user, not focusing camera');
          }
        } else {
          console.error('Received new_user message without user data');
        }
        break;
        
      case 'user_status':
        // Handle user status change
        console.log('Received user status change:', data);
        if (data.clientId && data.active !== undefined) {
          this.world.updateUserStatus(data.clientId, data.active);
        } else {
          console.error('Received user_status message with missing data');
        }
        break;
        
      case 'remove_user':
        // Handle user removal
        console.log('Received remove user with ID:', data.id);
        if (data.id !== undefined) {
          this.world.removeUserById(data.id);
        } else {
          console.error('Received remove_user message without ID');
        }
        break;
        
      case 'clear_all_users':
        // Handle clearing all users
        console.log('Received clear_all_users command');
        this.world.clearUsers();
        break;
        
      case 'error':
        // Handle error messages from the server
        console.error('Received error from server:', data.message);
        // Update the status display
        const userStatusElement = document.getElementById('user-status');
        if (userStatusElement) {
          userStatusElement.textContent = 'Error: ' + data.message;
          userStatusElement.style.color = '#EA4335'; // Red
        }
        
        // Show alert for authentication errors
        if (data.message.includes('authentication') || data.message.includes('token')) {
          alert('Authentication error: ' + data.message);
        }
        break;
        
      case 'warning':
        // Handle warning messages from the server
        console.warn('Received warning from server:', data.message);
        break;
        
      default:
        console.log('Unknown message type:', data.type);
    }
  }
  
  /**
   * Handle initial data from the server
   * @param {Array} users Array of user data
   */
  handleInitialData(users) {
    console.log(`Received initial data with ${users.length} users`);
    
    // Clear existing users
    this.world.clearUsers();
    
    // Add each user from the server
    users.forEach(userData => {
      this.world.addUserFromServer(userData);
    });
  }
  
  /**
   * Send a message to the server
   * @param {Object} data The message data
   */
  send(data) {
    if (this.connected && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('Cannot send message, WebSocket is not connected');
    }
  }
  
  /**
   * Add a new user
   * @param {Object} user The user data
   */
  addUser(user) {
    if (this.connected) {
      this.send({
        type: 'add_user',
        position: user.position,
        size: user.size,
        color: user.color
      });
    }
  }
  
  /**
   * Remove a user
   * @param {number} id The ID of the user to remove
   */
  removeUser(id) {
    if (this.connected) {
      this.send({
        type: 'remove_user',
        id: id
      });
    }
  }
  
  /**
   * Truncate the users table (remove all users)
   */
  truncateUsers() {
    if (this.connected) {
      this.send({
        type: 'truncate_users'
      });
      console.log('Sent request to truncate users table');
    }
  }
  
  /**
   * Close the WebSocket connection
   */
  close() {
    if (this.socket) {
      this.socket.close();
    }
  }
  
  /**
   * Update the connection status in the UI
   * @param {boolean} connected Whether the connection is established
   * @param {string} [customMessage] Optional custom message to display
   */
  updateConnectionStatus(connected, customMessage) {
    try {
      console.log(`Updating connection status: ${connected ? 'connected' : 'disconnected'}${customMessage ? ', message: ' + customMessage : ''}`);
      
      const userStatusElement = document.getElementById('user-status');
      if (userStatusElement) {
        if (connected) {
          userStatusElement.textContent = customMessage || 'Connected';
          userStatusElement.style.color = '#4CAF50'; // Green
        } else {
          userStatusElement.textContent = customMessage || 'Disconnected';
          userStatusElement.style.color = '#EA4335'; // Red
        }
      }
    } catch (error) {
      console.error('Error updating connection status:', error);
    }
  }
} 