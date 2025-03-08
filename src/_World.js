/**
 * 2D Online World Visualization
 * A simple visualization of people coming online using Three.js
 */
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import { Person } from './person.js';

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
            dragThreshold: 5     // Minimum distance to consider a drag (pixels)
        };

        // State
        this.people = [];
        this.counter = 0;
        
        // Panning state
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.cameraPosition = { x: 0, y: 0 };
        
        // Zoom state
        this.zoomLevel = 1.0;
        this.pinchDistance = 0;
        
        // Dragging state
        this.isDragging = false;
        this.draggedPerson = null;
        this.dragStart = { x: 0, y: 0, time: 0 };
        this.lastDragPosition = { x: 0, y: 0, time: 0 };
        this.dragVelocity = { x: 0, y: 0 };
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize the application
     */
    init() {
        this.initThree();
        this.setupEventListeners();
        this.startSimulation();
        
        // Start animation loop
        this.animate();
        
        // Debug: Add a person immediately
        console.log("Initializing application, adding first person");
        this.addPerson();
    }

    // Initialize Three.js scene
    initThree() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);
        
        // Create camera (orthographic for 2D)
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera = new THREE.OrthographicCamera(
            width / -2, width / 2, 
            height / 2, height / -2, 
            1, 1000
        );
        this.camera.position.z = 10;
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('worldCanvas'),
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Create raycaster for picking
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Add a grid helper for debugging
        const gridHelper = new THREE.GridHelper(1000, 100);
        gridHelper.rotation.x = Math.PI / 2;
        this.scene.add(gridHelper);
    }

    // Set up event listeners
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Canvas panning and dragging
        const canvas = this.renderer.domElement;
        
        // Mouse events for desktop
        canvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
        window.addEventListener('mousemove', (e) => this.onPointerMove(e));
        window.addEventListener('mouseup', (e) => this.onPointerUp(e));
        
        // Touch events for mobile
        canvas.addEventListener('touchstart', (e) => this.onPointerDown(e));
        window.addEventListener('touchmove', (e) => this.onPointerMove(e));
        window.addEventListener('touchend', (e) => this.onPointerUp(e));
        
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
        
        // Zoom with mouse wheel
        canvas.addEventListener('wheel', (e) => this.onZoom(e));
        
        // Zoom with pinch gesture
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                this.onPinchStart(e);
            }
        });
        
        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                this.onPinchMove(e);
            }
        });
    }
    
    // Handle pointer down (mouse or touch)
    onPointerDown(event) {
        // Don't start if clicking on the stats box
        if (event.target.closest('#stats')) {
            return;
        }
        
        // Get pointer position
        const pointer = this.getPointerPosition(event);
        
        // Convert to world coordinates
        const worldPos = this.screenToWorld(pointer.x, pointer.y);
        
        // Check if we're clicking on a person
        const clickedPerson = this.findPersonAtPosition(worldPos);
        
        if (clickedPerson) {
            // Start dragging the person
            this.isDragging = true;
            this.draggedPerson = clickedPerson;
            this.dragStart = { 
                x: worldPos.x, 
                y: worldPos.y, 
                time: Date.now() 
            };
            this.lastDragPosition = { 
                x: worldPos.x, 
                y: worldPos.y, 
                time: Date.now() 
            };
            
            // Tell the person it's being dragged
            clickedPerson.startDrag(worldPos);
            
            // Set cursor
            this.renderer.domElement.style.cursor = 'grabbing';
        } else {
            // Start panning the camera
            this.isPanning = true;
            this.panStart = pointer;
            this.cameraPosition = { 
                x: this.camera.position.x, 
                y: this.camera.position.y 
            };
            
            // Set cursor
            this.renderer.domElement.style.cursor = 'move';
        }
    }
    
    // Handle pointer move (mouse or touch)
    onPointerMove(event) {
        // Get pointer position
        const pointer = this.getPointerPosition(event);
        
        // Convert to world coordinates
        const worldPos = this.screenToWorld(pointer.x, pointer.y);
        
        // Handle dragging
        if (this.isDragging && this.draggedPerson) {
            // Prevent default to avoid scrolling on mobile
            event.preventDefault();
            
            // Update person position
            this.draggedPerson.updateDrag(worldPos);
            
            // Calculate drag velocity
            const now = Date.now();
            const dt = (now - this.lastDragPosition.time) / 1000; // seconds
            
            if (dt > 0) {
                this.dragVelocity = {
                    x: (worldPos.x - this.lastDragPosition.x) / dt,
                    y: (worldPos.y - this.lastDragPosition.y) / dt
                };
                
                // Limit velocity
                const maxVelocity = 100;
                const velocityMagnitude = Math.sqrt(
                    this.dragVelocity.x * this.dragVelocity.x + 
                    this.dragVelocity.y * this.dragVelocity.y
                );
                
                if (velocityMagnitude > maxVelocity) {
                    const scale = maxVelocity / velocityMagnitude;
                    this.dragVelocity.x *= scale;
                    this.dragVelocity.y *= scale;
                }
            }
            
            // Update last position
            this.lastDragPosition = { 
                x: worldPos.x, 
                y: worldPos.y, 
                time: now 
            };
            
            return;
        }
        
        // Handle panning
        if (this.isPanning) {
            // Prevent default to avoid scrolling on mobile
            event.preventDefault();
            
            // Calculate movement delta
            const deltaX = pointer.x - this.panStart.x;
            const deltaY = pointer.y - this.panStart.y;
            
            // Update camera position (move in opposite direction of drag)
            // Adjust for zoom level to maintain consistent panning speed
            this.camera.position.x = this.cameraPosition.x - (deltaX / this.zoomLevel);
            this.camera.position.y = this.cameraPosition.y + (deltaY / this.zoomLevel);
        }
    }
    
    // Handle pointer up (mouse or touch)
    onPointerUp(event) {
        // End dragging
        if (this.isDragging && this.draggedPerson) {
            // Apply velocity to the person
            this.draggedPerson.endDrag(this.dragVelocity);
            this.draggedPerson = null;
            this.isDragging = false;
        }
        
        // End panning
        this.isPanning = false;
        
        // Reset cursor
        this.renderer.domElement.style.cursor = 'default';
    }
    
    // Get pointer position (works for both mouse and touch)
    getPointerPosition(event) {
        if (event.type.startsWith('touch')) {
            // Touch event
            if (event.touches.length > 0) {
                return {
                    x: event.touches[0].clientX,
                    y: event.touches[0].clientY
                };
            } else if (event.changedTouches && event.changedTouches.length > 0) {
                return {
                    x: event.changedTouches[0].clientX,
                    y: event.changedTouches[0].clientY
                };
            }
            return { x: 0, y: 0 };
        } else {
            // Mouse event
            return {
                x: event.clientX,
                y: event.clientY
            };
        }
    }
    
    // Convert screen coordinates to world coordinates
    screenToWorld(screenX, screenY) {
        // Convert to normalized device coordinates (-1 to +1)
        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = ((screenX - rect.left) / rect.width) * 2 - 1;
        const y = -((screenY - rect.top) / rect.height) * 2 + 1;
        
        // Create a ray from the camera
        this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
        
        // Calculate the point where the ray intersects the z=0 plane
        const distance = -this.camera.position.z / this.raycaster.ray.direction.z;
        const worldPos = this.raycaster.ray.origin.clone().add(
            this.raycaster.ray.direction.clone().multiplyScalar(distance)
        );
        
        return { x: worldPos.x, y: worldPos.y };
    }
    
    // Find a person at the given position
    findPersonAtPosition(position) {
        for (const person of this.people) {
            if (person.containsPoint(position)) {
                return person;
            }
        }
        return null;
    }
    
    // Handle mouse wheel zoom
    onZoom(event) {
        event.preventDefault();
        
        // Determine zoom direction
        const delta = -Math.sign(event.deltaY);
        const zoomFactor = 1 + (delta * this.config.zoomSpeed);
        
        // Apply zoom
        this.applyZoom(zoomFactor);
    }
    
    // Start pinch zoom
    onPinchStart(event) {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        
        // Calculate initial distance between touch points
        this.pinchDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
    }
    
    // Handle pinch zoom movement
    onPinchMove(event) {
        event.preventDefault();
        
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        
        // Calculate new distance
        const newDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        
        // Calculate zoom factor based on pinch distance change
        const zoomFactor = newDistance / this.pinchDistance;
        this.pinchDistance = newDistance;
        
        // Apply zoom
        this.applyZoom(zoomFactor);
    }
    
    // Apply zoom to camera
    applyZoom(zoomFactor) {
        // Calculate new zoom level
        const newZoomLevel = this.zoomLevel * zoomFactor;
        
        // Clamp zoom level to min/max
        this.zoomLevel = Math.max(
            this.config.minZoom,
            Math.min(this.config.maxZoom, newZoomLevel)
        );
        
        // Update camera zoom
        this.updateCameraZoom();
    }
    
    // Update camera zoom based on current zoom level
    updateCameraZoom() {
        const width = window.innerWidth / this.zoomLevel;
        const height = window.innerHeight / this.zoomLevel;
        
        this.camera.left = width / -2;
        this.camera.right = width / 2;
        this.camera.top = height / 2;
        this.camera.bottom = height / -2;
        
        this.camera.updateProjectionMatrix();
    }
    
    // Handle window resize
    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Update camera with current zoom level
        this.camera.left = (width / this.zoomLevel) / -2;
        this.camera.right = (width / this.zoomLevel) / 2;
        this.camera.top = (height / this.zoomLevel) / 2;
        this.camera.bottom = (height / this.zoomLevel) / -2;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }

    // Start the simulation
    startSimulation() {
        // Set interval to add new people
        this.joinInterval = setInterval(() => {
            this.addPerson();
        }, this.config.joinInterval);
    }

    // Add a new person to the scene
    addPerson() {
        console.log("Adding new person");
        
        // Random size
        const size = Math.random() * (this.config.maxSize - this.config.minSize) + this.config.minSize;
        
        // Random color
        const colorIndex = Math.floor(Math.random() * this.config.colors.length);
        const color = this.config.colors[colorIndex];
        
        // Find a position without collisions
        const position = this.findNonCollidingPosition(size);
        
        // Create new person
        const person = new Person({
            size: size,
            color: color,
            position: position,
            scene: this.scene
        });
        
        // Animate entry
        person.animateEntry();
        
        // Add to people array
        this.people.push(person);
        
        // Update counter
        this.counter++;
        document.getElementById('counter').textContent = this.counter;
        
        // Remove oldest person if we exceed the maximum
        if (this.people.length > this.config.maxPeople) {
            const oldestPerson = this.people.shift();
            oldestPerson.animateExit(() => {
                // Cleanup happens in the animateExit callback
            });
        }
    }
    
    // Find a position that doesn't collide with existing people
    findNonCollidingPosition(radius) {
        // Calculate visible area based on camera position and zoom
        const viewWidth = window.innerWidth / this.zoomLevel;
        const viewHeight = window.innerHeight / this.zoomLevel;
        
        const minX = this.camera.position.x - viewWidth / 2;
        const maxX = this.camera.position.x + viewWidth / 2;
        const minY = this.camera.position.y - viewHeight / 2;
        const maxY = this.camera.position.y + viewHeight / 2;
        
        // Initial random position
        let position = {
            x: Math.random() * (maxX - minX) + minX,
            y: Math.random() * (maxY - minY) + minY
        };
        
        // If no people yet, return the initial position
        if (this.people.length === 0) {
            return position;
        }
        
        // Try to find a non-colliding position
        let iterations = 0;
        while (this.hasCollision(position, radius) && iterations < this.config.collisionIterations) {
            // Try a new random position
            position = {
                x: Math.random() * (maxX - minX) + minX,
                y: Math.random() * (maxY - minY) + minY
            };
            iterations++;
        }
        
        // If we still have collisions after max iterations, use force-based separation
        if (this.hasCollision(position, radius)) {
            position = this.resolveCollisions(position, radius);
        }
        
        return position;
    }
    
    // Check if a position collides with any existing person
    hasCollision(position, radius) {
        for (const person of this.people) {
            if (person.collidesWithPosition(position, radius)) {
                return true;
            }
        }
        return false;
    }
    
    // Resolve collisions using force-based separation
    resolveCollisions(position, radius) {
        // Start with the proposed position
        let resolvedPosition = { ...position };
        
        // Apply separation forces from all colliding people
        for (let i = 0; i < 5; i++) { // Multiple iterations for better separation
            let hasCollision = false;
            
            for (const person of this.people) {
                // Get person position
                const personPosition = person.getPosition();
                const personRadius = person.size;
                
                // Calculate distance
                const dx = resolvedPosition.x - personPosition.x;
                const dy = resolvedPosition.y - personPosition.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Check for collision
                if (distance < radius + personRadius) {
                    hasCollision = true;
                    
                    // Calculate separation force (stronger when closer)
                    const overlap = radius + personRadius - distance;
                    const forceX = dx === 0 ? (Math.random() * 2 - 1) : dx / distance;
                    const forceY = dy === 0 ? (Math.random() * 2 - 1) : dy / distance;
                    
                    // Apply force to move away from collision
                    resolvedPosition.x += forceX * overlap * 1.1; // Slightly stronger to ensure separation
                    resolvedPosition.y += forceY * overlap * 1.1;
                }
            }
            
            // If no more collisions, we're done
            if (!hasCollision) break;
        }
        
        return resolvedPosition;
    }
    
    // Update physics and check for collisions between people
    updatePhysics() {
        // Update physics for each person
        for (const person of this.people) {
            person.updatePhysics();
        }
        
        // Check for collisions between people
        for (let i = 0; i < this.people.length; i++) {
            for (let j = i + 1; j < this.people.length; j++) {
                this.people[i].collideWith(this.people[j]);
            }
        }
    }

    // Animation loop
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update physics and collisions
        this.updatePhysics();
        
        // Update floating animation for each person
        const time = Date.now() * 0.001; // Current time in seconds
        this.people.forEach(person => {
            person.updateFloating(time);
        });
        
        TWEEN.update();
        this.renderer.render(this.scene, this.camera);
    }
} 