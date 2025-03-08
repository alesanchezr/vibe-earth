/**
 * 3D Online World Visualization
 * A simple visualization of geeks coming online using Three.js on a spherical planet
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import TWEEN from '@tweenjs/tween.js';
import { Geek } from './Geek.js';
import { WebSocketClient } from './websocket-client.js';
import { ApiClient } from './api-client.js';
import { Planet } from './Planet.js';
import { Sky } from './Sky.js';

export class World {
    constructor() {
        // Configuration
        this.config = {
            maxUsers: 100,            // Maximum number of users to show
            colors: [
                0x4285F4, // Blue
                0xEA4335, // Red
                0xFBBC05, // Yellow
                0x34A853, // Green
                0x9C27B0, // Purple
                0xFF9800  // Orange
            ],
            minSize: 15,               // Minimum user size
            maxSize: 40,               // Maximum user size
            minZoom: 0.25,             // Minimum zoom level
            maxZoom: 4.0,              // Maximum zoom level
            zoomSpeed: 0.1,            // Zoom speed factor
            collisionIterations: 5,    // Collision detection iterations
            cameraInertia: 0.95,       // Camera inertia factor
            cameraDamping: 0.2,        // Camera movement damping factor
            cameraMovementSpeed: 2.0,  // Base speed for camera movement
            maxHeight: 12000,          // Maximum camera height
            planetRadius: 3000,        // Planet radius
            dayDuration: 30 * 60 * 1000, // Day duration in milliseconds (30 minutes)
            skyColors: {
                day: 0x87CEEB,         // Sky blue
                sunset: 0xFFA07A,      // Light salmon
                night: 0x000033        // Dark blue
            },
            groundColors: {
                day: 0xA5D6A7,         // Green
                night: 0x2E7D32        // Dark green
            }
        };
        
        // Initialize properties
        this.users = [];  // Array of users in the world
        this.zoomLevel = 1.0;
        this.targetZoomLevel = 1.0;
        this.lastTime = Date.now();
        this._receivedServerStats = false;  // Flag to track if we've received stats from the server
        
        // Initialize Three.js
        this.initThree();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize UI displays
        this.updateCounterDisplay();
        
        // Initialize WebSocket client
        this.wsClient = new WebSocketClient(this);
        
        // Initialize API client
        this.apiClient = new ApiClient();
        
        // Initialize the 3D world
        this.initializeWorld();
    }
    
    /**
     * Initialize Three.js scene, camera, renderer
     */
    initThree() {
        
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Default sky blue
        
        // Create camera (perspective for 3D with top-down view)
        const width = window.innerWidth;
        const height = window.innerHeight;
        const aspectRatio = width / height;
        this.camera = new THREE.PerspectiveCamera(
            60, // Field of view
            aspectRatio,
            1,
            50000 // Far plane
        );
        
        // Position camera above the planet
        const orbitHeight = this.config.planetRadius + 4500;
        this.camera.position.set(0, orbitHeight, 0);
        this.camera.lookAt(0, 0, 0);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('worldCanvas'),
            antialias: true,
            alpha: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Enable shadows
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Ensure proper depth handling
        this.renderer.sortObjects = true;
        this.renderer.autoClear = true;
        
        // Create the planet
        this.planet = new Planet({
            scene: this.scene,
            radius: this.config.planetRadius,
            colors: this.config.groundColors
        });
        
        console.log("Creating sky...");
        // Create the sky
        this.sky = new Sky({
            scene: this.scene,
            renderer: this.renderer,
            colors: this.config.skyColors,
            dayDuration: this.config.dayDuration
        });
        
        // The sky will automatically sync with the server
        // No need to call initTimeOfDay() anymore
        
        // Set up orbit controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true; // Add smooth damping
        this.controls.dampingFactor = 0.05;
        this.controls.rotateSpeed = 0.5; // Adjust rotation speed
        this.controls.minDistance = this.config.planetRadius * 1.1; // Don't allow camera too close to planet
        this.controls.maxDistance = this.config.planetRadius * 5; // Don't allow camera too far from planet
        
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Window resize event
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Mouse wheel event for zooming
        window.addEventListener('wheel', (event) => {
            // Prevent default scrolling
            event.preventDefault();
            
            // Calculate zoom direction
            const zoomDirection = event.deltaY > 0 ? 1 : -1;
            
            // Update target zoom level
            this.targetZoomLevel += zoomDirection * this.config.zoomSpeed;
            
            // Clamp to min/max zoom
            this.targetZoomLevel = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, this.targetZoomLevel));
            
            // Update the zoom indicator
            this.updateZoomIndicator();
        }, { passive: false });
        
        // Keyboard events
        window.addEventListener('keydown', (event) => {
            // Clear all users when pressing 'C'
            if (event.key === 'c' || event.key === 'C') {
                console.log('Truncating users table...');
                this.truncateUsers();
            }
            
            // Add a random user when pressing 'A'
            if (event.key === 'a' || event.key === 'A') {
                console.log('Adding a random user...');
                this.addRandomUser();
            }
        });
        
        // Prevent context menu on right-click
        window.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Add user on stats box click
        const statsBox = document.getElementById('stats');
        if (statsBox) {
            statsBox.addEventListener('click', () => this.addRandomUser());
            
            // Add hover effect to stats box
            statsBox.addEventListener('mouseenter', () => {
                statsBox.style.cursor = 'pointer';
                statsBox.style.transform = 'scale(1.05)';
                statsBox.style.transition = 'transform 0.2s ease-in-out';
            });
            
            statsBox.addEventListener('mouseleave', () => {
                statsBox.style.transform = 'scale(1)';
            });
        }
    }
    
    /**
     * Handle window resize
     */
    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Update camera aspect ratio
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        // Update renderer size
        this.renderer.setSize(width, height);
    }
    
    /**
     * Update the zoom indicator with the current camera height
     */
    updateZoomIndicator() {
        const zoomValueElement = document.getElementById('zoom-value');
        const fovValueElement = document.getElementById('fov-value');
        
        if (zoomValueElement && this.camera) {
            // Calculate actual height above the planet surface in km
            const distanceFromCenter = this.camera.position.length();
            const heightAboveSurface = distanceFromCenter - this.config.planetRadius;
            
            // Convert to km and format to 1 decimal place
            const heightInKm = (heightAboveSurface / 1000).toFixed(1);
            zoomValueElement.textContent = heightInKm;
        }
        
        if (fovValueElement && this.camera) {
            // Display the actual camera FOV
            const fov = Math.round(this.camera.fov);
            fovValueElement.textContent = fov;
        }
    }
    
    /**
     * Initialize the 3D world and start the rendering loop
     */
    initializeWorld() {
        console.log("Initializing 3D world...");
        
        // Start animation loop
        this.animate(0);
        
        // Start periodic stats update
        this.startStatsUpdates();
        
        console.log("3D world initialized");
    }
    
    /**
     * Start periodic stats updates from the server
     */
    startStatsUpdates() {
        // Update stats immediately
        this.fetchAndUpdateStats();
        
        // Then update every 10 seconds
        setInterval(() => {
            this.fetchAndUpdateStats();
        }, 10000);
    }
    
    /**
     * Fetch stats from the server and update the display
     */
    async fetchAndUpdateStats() {
        try {
            const stats = await this.apiClient.getStats();
            console.log('Received stats from server:', stats);
            
            // Mark that we've received server stats
            this._receivedServerStats = true;
            
            // Update the online users counter
            const counterElement = document.getElementById('counter');
            if (counterElement && stats.totalOnlineUsers !== undefined) {
                counterElement.textContent = stats.totalOnlineUsers;
            }
            
            // Update the total users counter
            const totalCounterElement = document.getElementById('total-counter');
            if (totalCounterElement && stats.totalUsers !== undefined) {
                totalCounterElement.textContent = stats.totalUsers;
            }
            
            // If we have day-night cycle information and a sky, update it
            if (stats.day_night_cycle && this.sky) {
                // The sky will handle syncing internally via its syncWithServer method
                // This is just a good opportunity to sync again if needed
                this.sky.syncWithServer().catch(error => {
                    console.warn('Failed to sync sky with server:', error);
                });
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    }
    
    /**
     * Add a new user to the world
     * This is only used for manual user creation, not for users from the server
     */
    addUser() {
        // Check if we've reached the maximum number of users
        if (this.users.length >= this.config.maxUsers) {
            console.log(`Maximum number of users (${this.config.maxUsers}) reached`);
            return;
        }
        
        // Generate random properties
        const size = this.config.minSize + Math.random() * (this.config.maxSize - this.config.minSize);
        const colorIndex = Math.floor(Math.random() * this.config.colors.length);
        const color = this.config.colors[colorIndex];
        
        // Find a position that doesn't collide with existing users
        const position = this.findNonCollidingPosition(size);
        
        // Create the new user
        const user = new Geek({
            size,
            color,
            position,
            scene: this.scene,
            cameraY: this.camera.position.y,
            planetRadius: this.config.planetRadius
        });
        
        // Add to the array
        this.users.push(user);
        
        // Update the counter display
        this.updateCounterDisplay();
        
        // Notify the server about the new user
        this.wsClient.addUser({
            position: position,
            size: size,
            color: color
        });
        
        console.log(`Added user #${this.users.length} at position:`, position);
    }
    
    /**
     * Add a user from server data
     * @param {Object} userData The user data from the server
     */
    addUserFromServer(userData) {
        // Convert database format to our format
        const position = {
            x: userData.position_x,
            y: userData.position_y,
            z: userData.position_z
        };
        
        // Ensure color is in the correct format
        let color = userData.color;
        
        // If color is a string that looks like a number, convert it to a number
        if (typeof color === 'string' && !isNaN(color)) {
            color = Number(color);
        }
        
        // Create the new user
        const user = new Geek({
            id: userData.id,
            size: userData.size,
            color: color,
            position: position,
            scene: this.scene,
            cameraY: this.camera.position.y,
            planetRadius: this.config.planetRadius
        });
        
        // Add to the array
        this.users.push(user);
        
        // Update the counter display
        this.updateCounterDisplay();
        
        console.log(`Added user #${this.users.length} from server with ID ${userData.id}`);
    }
    
    /**
     * Remove a user by ID
     * @param {number} id The user ID
     */
    removeUserById(id) {
        const index = this.users.findIndex(user => user.id === id);
        
        if (index !== -1) {
            // Remove the user from the scene
            this.users[index].remove();
            
            // Remove from the array
            this.users.splice(index, 1);
            
            // Update the counter display
            this.updateCounterDisplay();
            
            console.log(`Removed user with ID ${id}`);
        }
    }
    
    /**
     * Clear all users from the world
     */
    clearUsers() {
        // Remove all users from the scene
        this.users.forEach(user => user.remove());
        
        // Clear the array
        this.users = [];
        
        // Update the counter display
        this.updateCounterDisplay();
        
        console.log('Cleared all users');
    }
    
    /**
     * Add a random user via API
     */
    async addRandomUser() {
        try {
            const response = await this.apiClient.addRandomUser();
            console.log('Random user added via API:', response);
            
            if (response.success) {
                // The user will be added via WebSocket broadcast
                console.log('Waiting for WebSocket to add the user...');
            }
        } catch (error) {
            console.error('Error adding random user:', error);
        }
    }
    
    /**
     * Truncate the users table (remove all users)
     */
    async truncateUsers() {
        try {
            const response = await this.apiClient.truncateUsers();
            console.log('Users truncated via API:', response);
            
            if (response.success) {
                // The users will be cleared via WebSocket broadcast
                console.log('Waiting for WebSocket to clear users...');
            }
        } catch (error) {
            console.error('Error truncating users:', error);
        }
    }
    
    /**
     * Update the counter display with the local count of users
     * Note: This is now only used for immediate feedback when adding/removing users locally
     * The actual count will be updated by fetchAndUpdateStats() with server data
     */
    updateCounterDisplay() {
        // Only update if we haven't received server stats yet
        const counterElement = document.getElementById('counter');
        if (counterElement && !this._receivedServerStats) {
            counterElement.textContent = this.users.length;
        }
    }
    
    /**
     * Find a position on the planet surface that doesn't collide with existing users
     * @param {number} radius Radius of the new user
     * @returns {Object} Position {x, y, z} on the planet surface
     */
    findNonCollidingPosition(radius) {
        // Generate a random position on the sphere
        const position = this.planet.getRandomPosition();
        
        // Check for collisions with existing users
        for (let i = 0; i < this.config.collisionIterations; i++) {
            if (!this.hasNearbyCollision(position, radius)) {
                return position;
            }
            
            // Try a new random position
            const newPosition = this.planet.getRandomPosition();
            position.x = newPosition.x;
            position.y = newPosition.y;
            position.z = newPosition.z;
        }
        
        // If we couldn't find a non-colliding position after several attempts, just return the last one
        return position;
    }
    
    /**
     * Check if a position collides with any existing users
     * @param {Object} position Position to check
     * @param {number} radius Radius of the new user
     * @returns {boolean} True if there's a collision
     */
    hasNearbyCollision(position, radius) {
        for (const user of this.users) {
            const dx = user.position.x - position.x;
            const dy = user.position.y - position.y;
            const dz = user.position.z - position.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            // Check if the distance is less than the sum of the radii
            if (distance < radius + user.size) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Animation loop
     * @param {number} currentTime Current time in milliseconds
     */
    animate(currentTime) {
        // Request next frame
        requestAnimationFrame(this.animate.bind(this));
        
        // Calculate delta time in seconds
        const deltaTime = (currentTime - (this.lastTime || currentTime)) / 1000;
        this.lastTime = currentTime;
        
        // Cap delta time to prevent large jumps
        const dt = Math.min(deltaTime, 0.1);
        
        // Update orbit controls
        this.controls.update();
        
        // Update zoom indicator with current camera height
        this.updateZoomIndicator();
        
        // Update all users
        for (const user of this.users) {
            user.update(dt, currentTime / 1000);
        }
        
        // Update day/night cycle
        this.sky.update(dt, this.lerpColor, (timeOfDay) => {
            this.planet.updateColor(timeOfDay, this.lerpColor);
        });
        
        // Update TWEEN animations
        TWEEN.update(currentTime);
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * Interpolate between two colors
     * @param {number} color1 First color in hex format
     * @param {number} color2 Second color in hex format
     * @param {number} t Interpolation factor (0 to 1)
     * @returns {number} Interpolated color in hex format
     */
    lerpColor(color1, color2, t) {
        const r1 = (color1 >> 16) & 255;
        const g1 = (color1 >> 8) & 255;
        const b1 = color1 & 255;
        
        const r2 = (color2 >> 16) & 255;
        const g2 = (color2 >> 8) & 255;
        const b2 = color2 & 255;
        
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        
        return (r << 16) | (g << 8) | b;
    }
}