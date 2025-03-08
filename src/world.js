/**
 * 3D Online World Visualization
 * A simple visualization of people coming online using Three.js with a top-down camera view
 */
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import { Person } from './Person.js';

export class World {
    constructor() {
        // Configuration
        this.config = {
            joinInterval: 20000, // New person every 20 seconds
            maxPeople: 50,       // Maximum number of people to show
            colors: [
                0x4285F4, // Blue
                0xEA4335, // Red
                0xFBBC05, // Yellow
                0x34A853, // Green
                0x9C27B0, // Purple
                0xFF9800  // Orange
            ],
            minSize: 20,
            maxSize: 50,
            minZoom: 0.5,        // Minimum zoom level
            maxZoom: 3.0,        // Maximum zoom level
            zoomSpeed: 0.1,      // Zoom speed factor
            collisionIterations: 10,  // Max iterations for collision resolution
            cameraInertia: 0.95,      // Camera inertia factor (0-1) - higher means more inertia
            cameraDamping: 0.2,       // Camera movement damping factor - higher means faster response
            cameraMovementSpeed: 2.0   // Base speed multiplier for camera movement
        };
        
        // Initialize properties
        this.people = [];
        this.zoomLevel = 1.0;
        this.targetZoomLevel = 1.0;
        this.isPanning = false;
        this.lastPanPosition = { x: 0, y: 0 };
        this.lastPinchDistance = 0;
        
        // Camera movement with inertia
        this.cameraVelocity = { x: 0, z: 0 };
        this.targetCameraPosition = { x: 0, y: 1000, z: 0 };
        
        // Initialize Three.js
        this.initThree();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start the simulation
        this.startSimulation();
    }

    // Initialize Three.js scene
    initThree() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);
        
        // Create camera (perspective for 3D with top-down view)
        const width = window.innerWidth;
        const height = window.innerHeight;
        const aspectRatio = width / height;
        this.camera = new THREE.PerspectiveCamera(
            60, // Field of view
            aspectRatio,
            1,
            2000
        );
        
        // Position camera above the scene looking down (twice as far)
        this.camera.position.set(0, 1000, 0); // Increased from 500 to 1000
        this.camera.lookAt(0, 0, 0);
        this.camera.up.set(0, 0, -1); // This makes "up" in the view aligned with negative z-axis
        
        // Initialize target camera position to match current position
        this.targetCameraPosition = {
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z
        };
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('worldCanvas'),
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Add a grid helper for debugging
        const gridHelper = new THREE.GridHelper(1000, 100);
        this.scene.add(gridHelper);
        
        // Add a ground plane
        const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
        const groundMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x90EE90,  // Light green
            transparent: true,
            opacity: 0.5
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        this.ground.position.y = 0; // Position at y=0
        this.scene.add(this.ground);
        
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        // Add directional light (simulating sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 100, 0);
        directionalLight.lookAt(0, 0, 0);
        this.scene.add(directionalLight);
    }

    /**
     * Set up event listeners for interaction
     */
    setupEventListeners() {
        // Mouse wheel for zooming
        window.addEventListener('wheel', this.onZoom.bind(this), { passive: false });
        
        // Mouse events for panning
        window.addEventListener('mousedown', this.onPanStart.bind(this));
        window.addEventListener('mousemove', this.onPanMove.bind(this));
        window.addEventListener('mouseup', this.onPanEnd.bind(this));
        window.addEventListener('mouseleave', this.onPanEnd.bind(this));
        
        // Touch events for panning and pinch-zoom
        window.addEventListener('touchstart', this.onPanStart.bind(this), { passive: false });
        window.addEventListener('touchmove', this.onPanMove.bind(this), { passive: false });
        window.addEventListener('touchend', this.onPanEnd.bind(this));
        
        // Window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Prevent context menu on right-click
        window.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Add person on stats box click
        const statsBox = document.getElementById('stats');
        statsBox.addEventListener('click', () => this.addPerson());
        
        // Add hover effect to stats box
        statsBox.addEventListener('mouseenter', () => {
            statsBox.style.cursor = 'pointer';
            statsBox.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
            statsBox.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
        });
        
        statsBox.addEventListener('mouseleave', () => {
            statsBox.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            statsBox.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.1)';
        });
    }
    
    /**
     * Handle mouse wheel zoom
     * @param {WheelEvent} event Mouse wheel event
     */
    onZoom(event) {
        // Prevent default scrolling behavior
        event.preventDefault();
        
        // Calculate zoom factor based on wheel delta
        // Normalize wheel delta across browsers
        const delta = -Math.sign(event.deltaY);
        const zoomFactor = 1 + (delta * this.config.zoomSpeed);
        
        // Apply zoom
        this.applyZoom(zoomFactor);
    }
    
    /**
     * Handle pinch start for touch zoom
     * @param {TouchEvent} event Touch start event
     */
    onPinchStart(event) {
        // Need at least two touch points
        if (event.touches.length < 2) return;
        
        // Get the two touch points
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        
        // Calculate initial distance between touch points
        this.lastPinchDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
    }
    
    /**
     * Handle pinch move for touch zoom
     * @param {TouchEvent} event Touch move event
     */
    onPinchMove(event) {
        // Need at least two touch points
        if (event.touches.length < 2) return;
        
        // Prevent default behavior
        event.preventDefault();
        
        // Get the two touch points
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        
        // Calculate new distance
        const newDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        
        // Calculate zoom factor based on pinch distance change
        const zoomFactor = newDistance / this.lastPinchDistance;
        this.lastPinchDistance = newDistance;
        
        // Apply zoom
        this.applyZoom(zoomFactor);
    }
    
    /**
     * Apply zoom factor
     * @param {number} zoomFactor Factor to zoom by (>1 to zoom in, <1 to zoom out)
     */
    applyZoom(zoomFactor) {
        // Calculate new zoom level
        this.targetZoomLevel *= zoomFactor;
        
        // Clamp to min/max zoom
        this.targetZoomLevel = Math.max(this.config.minZoom, 
                               Math.min(this.config.maxZoom, this.targetZoomLevel));
        
        // Update camera
        this.updateCameraZoom();
    }
    
    /**
     * Update camera position based on zoom level
     */
    updateCameraZoom() {
        // Smoothly interpolate current zoom towards target zoom
        this.zoomLevel += (this.targetZoomLevel - this.zoomLevel) * 0.1;
        
        // In a 3D top-down view, zooming means moving the camera closer to or further from the ground
        // Get the current look-at point (where the camera is pointing)
        const lookAtPoint = new THREE.Vector3(this.camera.position.x, 0, this.camera.position.z);
        
        // Calculate new camera height based on zoom level
        // Higher zoom level = lower camera height (closer to ground)
        const baseHeight = 1000; // Base height at zoom level 1.0
        const newHeight = baseHeight / this.zoomLevel;
        
        // Update camera position, maintaining x and z coordinates
        this.camera.position.y = newHeight;
        
        // Update target camera position y-coordinate
        this.targetCameraPosition.y = newHeight;
        
        // Ensure camera is still looking at the same point on the ground
        this.camera.lookAt(lookAtPoint);
    }
    
    /**
     * Handle pan start
     * @param {Event} event Mouse or touch start event
     */
    onPanStart(event) {
        // Only start panning on left mouse button (button 0)
        if (event.type === 'mousedown' && event.button !== 0) return;
        
        // Prevent default behavior
        event.preventDefault();
        
        // Set panning flag
        this.isPanning = true;
        
        // Store initial position
        if (event.touches) {
            // Handle touch events
            if (event.touches.length === 2) {
                // Two-finger touch - handle as pinch zoom
                this.onPinchStart(event);
                return;
            } else if (event.touches.length === 1) {
                // Single touch - handle as pan
                this.lastPanPosition.x = event.touches[0].clientX;
                this.lastPanPosition.y = event.touches[0].clientY;
            }
        } else {
            // Handle mouse events
            this.lastPanPosition.x = event.clientX;
            this.lastPanPosition.y = event.clientY;
        }
    }
    
    /**
     * Handle pan movement
     * @param {Event} event Mouse or touch move event
     */
    onPanMove(event) {
        if (!this.isPanning) return;
        
        // Get current position
        let currentX, currentY;
        if (event.touches) {
            // Touch event
            if (event.touches.length !== 1) return; // Only handle single touch
            currentX = event.touches[0].clientX;
            currentY = event.touches[0].clientY;
        } else {
            // Mouse event
            currentX = event.clientX;
            currentY = event.clientY;
        }
        
        // Calculate movement delta
        const deltaX = currentX - this.lastPanPosition.x;
        const deltaY = currentY - this.lastPanPosition.y;
        
        // Update last position
        this.lastPanPosition.x = currentX;
        this.lastPanPosition.y = currentY;
        
        // Scale movement based on zoom level and camera height
        // The higher the camera, the faster the movement should be
        const cameraHeightFactor = this.camera.position.y / 1000; // Normalize by base height
        const movementScale = (1 / this.zoomLevel) * cameraHeightFactor * this.config.cameraMovementSpeed;
        
        // Update camera velocity (invert direction to make it feel like dragging the world)
        // For x-axis: moving mouse right should move camera left (and vice versa)
        // For z-axis: moving mouse down should move camera forward/down in the scene (and vice versa)
        this.cameraVelocity.x = -deltaX * movementScale;
        this.cameraVelocity.z = -deltaY * movementScale; // Reversed direction for more intuitive control
        
        // Update target camera position
        this.targetCameraPosition.x = this.camera.position.x + this.cameraVelocity.x;
        this.targetCameraPosition.z = this.camera.position.z + this.cameraVelocity.z;
    }
    
    /**
     * Handle pan end
     */
    onPanEnd() {
        this.isPanning = false;
        
        // Don't immediately stop - let inertia continue in the animate method
        // The velocity will gradually decrease due to the inertia factor
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
        
        console.log("Window resized, new dimensions:", width, "x", height);
    }

    /**
     * Start the simulation
     */
    startSimulation() {
        console.log("Starting simulation...");
        
        // Start animation loop
        this.animate(0);
        console.log("Animation loop started");
        
        // Add initial people
        const initialCount = 10;
        console.log(`Adding ${initialCount} initial people`);
        for (let i = 0; i < initialCount; i++) {
            console.log(`Adding person ${i + 1}`);
            this.addPerson();
        }
        
        // Schedule adding more people periodically
        const nextInterval = this.config.joinInterval * (0.5 + Math.random());
        console.log(`Scheduled next person in ${nextInterval/1000} seconds`);
        this.nextPersonTimeout = setTimeout(() => this.addPerson(), nextInterval);
    }

    /**
     * Add a new person to the world
     */
    addPerson() {
        console.log("Attempting to add a new person...");
        
        // Don't add more people if we've reached the maximum
        if (this.people.length >= this.config.maxPeople) {
            console.log("Maximum people reached, removing oldest person");
            // Remove the oldest person first
            const oldestPerson = this.people.shift();
            oldestPerson.animateExit(() => {
                oldestPerson.remove();
            });
        }
        
        // Random size between min and max
        const size = this.config.minSize + 
            Math.random() * (this.config.maxSize - this.config.minSize);
            
        // Random color from the config
        const colorIndex = Math.floor(Math.random() * this.config.colors.length);
        const color = this.config.colors[colorIndex];
        
        console.log("Finding non-colliding position for new person");
        // Find a position that doesn't collide with existing people
        const position = this.findNonCollidingPosition(size);
        console.log("Position found:", position);
        
        // Create the person
        const person = new Person({
            size: size,
            color: color,
            position: position,
            scene: this.scene
        });
        
        console.log("Person created with size:", size, "color:", color.toString(16));
        
        // Add to our array
        this.people.push(person);
        console.log("Total people in scene:", this.people.length);
        
        // Update counter display if it exists
        const counterElement = document.getElementById('counter');
        if (counterElement) {
            counterElement.textContent = this.people.length;
        }
        
        // Schedule the next person
        const nextInterval = this.config.joinInterval * (0.5 + Math.random());
        console.log("Scheduling next person in", nextInterval/1000, "seconds");
        this.nextPersonTimeout = setTimeout(() => this.addPerson(), nextInterval);
        
        return person;
    }
    
    /**
     * Find a position that doesn't collide with existing people
     * @param {number} radius Radius of the new person
     * @returns {Object} Position {x, z}
     */
    findNonCollidingPosition(radius) {
        // Calculate the bounds based on the current camera view
        const frustumHeight = 2 * Math.tan(this.camera.fov * Math.PI / 360) * this.camera.position.y;
        const frustumWidth = frustumHeight * this.camera.aspect;
        
        // Add some margin
        const margin = 100;
        const bounds = {
            minX: -frustumWidth / 2 + margin,
            maxX: frustumWidth / 2 - margin,
            minZ: -frustumHeight / 2 + margin,
            maxZ: frustumHeight / 2 - margin
        };
        
        // Try random positions until we find one without collisions
        let attempts = 0;
        const maxAttempts = 100;
        
        while (attempts < maxAttempts) {
            // Generate random position within bounds
            const position = {
                x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
                z: bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ)
            };
            
            // Check if this position collides with any existing person
            if (!this.hasCollision(position, radius)) {
                return position;
            }
            
            attempts++;
        }
        
        // If we couldn't find a non-colliding position after max attempts,
        // try to resolve collisions from a random position
        const position = {
            x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
            z: bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ)
        };
        
        return this.resolveCollisions(position, radius);
    }
    
    /**
     * Check if a position collides with any existing person
     * @param {Object} position Position to check {x, z}
     * @param {number} radius Radius of the new person
     * @returns {boolean} True if collision detected
     */
    hasCollision(position, radius) {
        return this.people.some(person => person.collidesWithPosition(position, radius));
    }
    
    /**
     * Resolve collisions by moving the position away from colliding people
     * @param {Object} position Initial position {x, z}
     * @param {number} radius Radius of the new person
     * @returns {Object} Resolved position {x, z}
     */
    resolveCollisions(position, radius) {
        const resolvedPosition = { x: position.x, z: position.z };
        
        // Maximum iterations to prevent infinite loops
        const maxIterations = this.config.collisionIterations;
        let iterations = 0;
        
        while (iterations < maxIterations) {
            let hasCollision = false;
            
            // Check collisions with all people
            for (const person of this.people) {
                const personPos = person.getPosition();
                const dx = resolvedPosition.x - personPos.x;
                const dz = resolvedPosition.z - personPos.z;
                const distance = Math.sqrt(dx * dx + dz * dz);
                const minDistance = radius + person.size;
                
                // If collision detected
                if (distance < minDistance) {
                    hasCollision = true;
                    
                    // Calculate normalized direction vector
                    const nx = dx / distance || 0;
                    const nz = dz / distance || 0;
                    
                    // Move position away from collision
                    const moveDistance = minDistance - distance + 1; // Add 1 for a small buffer
                    resolvedPosition.x += nx * moveDistance;
                    resolvedPosition.z += nz * moveDistance;
                }
            }
            
            // If no collisions, we're done
            if (!hasCollision) {
                break;
            }
            
            iterations++;
        }
        
        return resolvedPosition;
    }

    /**
     * Animation loop
     * @param {number} currentTime Current time from requestAnimationFrame
     */
    animate(currentTime) {
        // Log animation frame every 100 frames to avoid console spam
        if (!this.frameCount) this.frameCount = 0;
        this.frameCount++;
        
        if (this.frameCount % 100 === 0) {
            console.log(`Animation frame ${this.frameCount}, people count: ${this.people.length}`);
        }
        
        requestAnimationFrame((time) => this.animate(time));
        
        // Calculate delta time for physics
        if (!this.lastTime) this.lastTime = currentTime || 0;
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;
        
        // Apply camera inertia and smooth movement
        if (!this.isPanning) {
            // Apply inertia to camera velocity when not actively panning
            this.cameraVelocity.x *= this.config.cameraInertia;
            this.cameraVelocity.z *= this.config.cameraInertia;
            
            // Stop very small movements to prevent endless tiny adjustments
            if (Math.abs(this.cameraVelocity.x) < 0.01) this.cameraVelocity.x = 0;
            if (Math.abs(this.cameraVelocity.z) < 0.01) this.cameraVelocity.z = 0;
            
            // Update target position based on velocity
            this.targetCameraPosition.x += this.cameraVelocity.x;
            this.targetCameraPosition.z += this.cameraVelocity.z;
        }
        
        // Smoothly move camera towards target position
        this.camera.position.x += (this.targetCameraPosition.x - this.camera.position.x) * this.config.cameraDamping;
        this.camera.position.z += (this.targetCameraPosition.z - this.camera.position.z) * this.config.cameraDamping;
        
        // Keep the camera looking at the ground below it
        this.camera.lookAt(this.camera.position.x, 0, this.camera.position.z);
        
        // Update each person
        const time = Date.now() * 0.001; // Current time in seconds
        this.people.forEach(person => {
            person.update(deltaTime, time);
        });
        
        TWEEN.update(currentTime);
        this.renderer.render(this.scene, this.camera);
    }
}