/**
 * WebSocket Client for User World
 * Handles real-time communication with the backend server
 */
export class WebSocketClient {
  constructor(world) {
    this.world = world;
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second delay
    
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
    this.reconnectDelay = 1000;
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
          this.world.addUserFromServer(data.user);
        } else {
          console.error('Received new_user message without user data');
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
} 