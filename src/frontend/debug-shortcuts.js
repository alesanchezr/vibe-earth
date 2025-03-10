/**
 * Debug Shortcuts Module
 * Contains admin/debug keyboard shortcuts and UI elements
 * This file can be easily disabled or removed in production
 */
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

export class DebugShortcuts {
    /**
     * Initialize debug shortcuts
     * @param {Object} world - Reference to the World instance
     */
    constructor(world) {
        this.world = world;
        this.isShiftKeyDown = false;
        this.keyboardShortcutsModal = null;
        
        // Create UI elements
        this.createKeyboardShortcutsModal();
        this.createCenterCrossIndicator();
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('Debug shortcuts initialized');
    }
    
    /**
     * Set up event listeners for debug shortcuts
     */
    setupEventListeners() {
        // Keyboard keydown events
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Keyboard keyup events
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        // Handle case where shift key is released outside the window
        window.addEventListener('blur', () => {
            this.isShiftKeyDown = false;
            
            // Hide the keyboard shortcuts modal
            if (this.keyboardShortcutsModal) {
                this.keyboardShortcutsModal.style.display = 'none';
            }
        });
    }
    
    /**
     * Handle keydown events
     * @param {KeyboardEvent} event - The keyboard event
     */
    handleKeyDown(event) {
        // Track shift key state
        if (event.key === 'Shift' && !this.isShiftKeyDown) {
            this.isShiftKeyDown = true;
            
            // Show the keyboard shortcuts modal
            if (this.keyboardShortcutsModal) {
                this.keyboardShortcutsModal.style.display = 'block';
            }
        }
        
        // Handle keyboard shortcuts
        if (this.isShiftKeyDown) {
            // Shift + Delete: Clear all online users
            if (event.key === 'Delete') {
                console.log('Clearing all online users...');
                this.world.truncateUsers();
            }
            
            // Shift + C: Toggle center cross indicator
            if (event.key === 'c' || event.key === 'C') {
                console.log('Toggling center cross indicator...');
                this.toggleCenterCrossIndicator();
            }
            // A: Add a random user (keep this shortcut as is)
            if (event.key === 'a' || event.key === 'A') {
                console.log('Adding a random user...');
                this.world.addRandomUser();
            }
        } else {
            console.log('Shift key is not down');
        }
    }
    
    /**
     * Handle keyup events
     * @param {KeyboardEvent} event - The keyboard event
     */
    handleKeyUp(event) {
        // Track shift key state
        if (event.key === 'Shift') {
            this.isShiftKeyDown = false;
            
            // Hide the keyboard shortcuts modal
            if (this.keyboardShortcutsModal) {
                this.keyboardShortcutsModal.style.display = 'none';
            }
        }
    }
    
    /**
     * Create a keyboard shortcuts cheatsheet modal
     */
    createKeyboardShortcutsModal() {
        // Create the modal container
        const modal = document.createElement('div');
        modal.id = 'keyboard-shortcuts-modal';
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        modal.style.color = 'white';
        modal.style.padding = '20px';
        modal.style.borderRadius = '8px';
        modal.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
        modal.style.zIndex = '2000';
        modal.style.minWidth = '300px';
        modal.style.display = 'none'; // Hidden by default
        modal.style.fontFamily = 'Arial, sans-serif';
        
        // Create the header
        const header = document.createElement('h2');
        header.textContent = 'Admin Debug Shortcuts';
        header.style.margin = '0 0 15px 0';
        header.style.textAlign = 'center';
        header.style.fontSize = '18px';
        header.style.borderBottom = '1px solid rgba(255, 255, 255, 0.3)';
        header.style.paddingBottom = '10px';
        
        // Create the shortcuts list
        const shortcutsList = document.createElement('div');
        shortcutsList.style.display = 'grid';
        shortcutsList.style.gridTemplateColumns = 'auto 1fr';
        shortcutsList.style.gap = '8px 15px';
        shortcutsList.style.alignItems = 'center';
        
        // Define the shortcuts
        const shortcuts = [
            { key: 'Shift + Delete', description: 'Clear all online users' },
            { key: 'Shift + C', description: 'Toggle center cross indicator' },
            { key: 'A', description: 'Add a random user' }
        ];
        
        // Add each shortcut to the list
        shortcuts.forEach(shortcut => {
            const keyElement = document.createElement('div');
            keyElement.textContent = shortcut.key;
            keyElement.style.fontWeight = 'bold';
            keyElement.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            keyElement.style.padding = '4px 8px';
            keyElement.style.borderRadius = '4px';
            keyElement.style.textAlign = 'center';
            
            const descriptionElement = document.createElement('div');
            descriptionElement.textContent = shortcut.description;
            
            shortcutsList.appendChild(keyElement);
            shortcutsList.appendChild(descriptionElement);
        });
        
        // Add a note at the bottom
        const note = document.createElement('div');
        note.textContent = 'Hold Shift to show this menu (Admin Only)';
        note.style.marginTop = '15px';
        note.style.fontSize = '12px';
        note.style.opacity = '0.7';
        note.style.textAlign = 'center';
        note.style.fontStyle = 'italic';
        
        // Assemble the modal
        modal.appendChild(header);
        modal.appendChild(shortcutsList);
        modal.appendChild(note);
        
        // Add the modal to the document body
        document.body.appendChild(modal);
        
        // Store a reference to the modal
        this.keyboardShortcutsModal = modal;
    }
    
    /**
     * Create a black cross indicator in the center of the screen
     */
    createCenterCrossIndicator() {
        // Create a container for the cross
        const crossContainer = document.createElement('div');
        crossContainer.id = 'center-cross-indicator';
        crossContainer.style.position = 'absolute';
        crossContainer.style.top = '50%';
        crossContainer.style.left = '50%';
        crossContainer.style.transform = 'translate(-50%, -50%)';
        crossContainer.style.pointerEvents = 'none'; // Make it non-interactive
        crossContainer.style.zIndex = '1000'; // Ensure it's above other elements
        
        // Create the horizontal line of the cross
        const horizontalLine = document.createElement('div');
        horizontalLine.style.position = 'absolute';
        horizontalLine.style.width = '24px';
        horizontalLine.style.height = '3px';
        horizontalLine.style.backgroundColor = 'black';
        horizontalLine.style.top = '50%';
        horizontalLine.style.left = '50%';
        horizontalLine.style.transform = 'translate(-50%, -50%)';
        // Add a white border for better visibility
        horizontalLine.style.boxShadow = '0 0 2px white';
        
        // Create the vertical line of the cross
        const verticalLine = document.createElement('div');
        verticalLine.style.position = 'absolute';
        verticalLine.style.width = '3px';
        verticalLine.style.height = '24px';
        verticalLine.style.backgroundColor = 'black';
        verticalLine.style.top = '50%';
        verticalLine.style.left = '50%';
        verticalLine.style.transform = 'translate(-50%, -50%)';
        // Add a white border for better visibility
        verticalLine.style.boxShadow = '0 0 2px white';
        
        // Create a label container
        const labelContainer = document.createElement('div');
        labelContainer.style.position = 'absolute';
        labelContainer.style.top = 'calc(50% + 15px)';
        labelContainer.style.left = '50%';
        labelContainer.style.transform = 'translateX(-50%)';
        labelContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        labelContainer.style.padding = '4px 8px';
        labelContainer.style.borderRadius = '3px';
        labelContainer.style.whiteSpace = 'nowrap';
        labelContainer.style.fontSize = '10px';
        labelContainer.style.color = 'black';
        labelContainer.style.fontFamily = 'monospace';
        
        // Create title label
        const titleLabel = document.createElement('div');
        titleLabel.textContent = 'Planet Center';
        titleLabel.style.fontWeight = 'bold';
        titleLabel.style.marginBottom = '2px';
        titleLabel.style.textAlign = 'center';
        
        // Create coordinates label
        const coordsLabel = document.createElement('div');
        coordsLabel.id = 'center-cross-coordinates';
        coordsLabel.style.display = 'grid';
        coordsLabel.style.gridTemplateColumns = 'auto 1fr';
        coordsLabel.style.gap = '4px 8px';
        coordsLabel.style.fontSize = '9px';
        
        // Add coordinate rows
        const coords = [
            { label: 'X:', id: 'center-cross-x', color: '#E53935' },
            { label: 'Y:', id: 'center-cross-y', color: '#43A047' },
            { label: 'Z:', id: 'center-cross-z', color: '#1E88E5' },
            { label: 'θ:', id: 'center-cross-theta', color: '#FB8C00' },
            { label: 'φ:', id: 'center-cross-phi', color: '#8E24AA' }
        ];
        
        coords.forEach(coord => {
            const label = document.createElement('div');
            label.textContent = coord.label;
            label.style.color = coord.color;
            label.style.fontWeight = 'bold';
            
            const value = document.createElement('div');
            value.id = coord.id;
            value.textContent = '0.000';
            
            coordsLabel.appendChild(label);
            coordsLabel.appendChild(value);
        });
        
        // Assemble the label container
        labelContainer.appendChild(titleLabel);
        labelContainer.appendChild(coordsLabel);
        
        // Add the lines and label to the container
        crossContainer.appendChild(horizontalLine);
        crossContainer.appendChild(verticalLine);
        crossContainer.appendChild(labelContainer);
        
        // Add the container to the document body
        document.body.appendChild(crossContainer);
        
        // Store a reference to the cross container
        this.centerCrossIndicator = crossContainer;
        
        // Initially hide the cross indicator
        this.centerCrossIndicator.style.display = 'none';
        
        // Start updating coordinates
        this.startCoordinateUpdates();
    }
    
    /**
     * Start updating the center cross coordinates
     */
    startCoordinateUpdates() {
        // Update coordinates immediately
        this.updateCenterCrossCoordinates();
        
        // Update coordinates periodically
        this.coordinateUpdateInterval = setInterval(() => {
            this.updateCenterCrossCoordinates();
        }, 100); // Update 10 times per second
    }
    
    /**
     * Update the center cross coordinates based on planet rotation
     */
    updateCenterCrossCoordinates() {
        if (!this.centerCrossIndicator || this.centerCrossIndicator.style.display === 'none') {
            return; // Don't update if not visible
        }
        
        if (!this.world.planet || !this.world.planet.mesh) {
            return; // Don't update if planet not available
        }
        
        // Get the planet rotation
        const rotation = this.world.planet.mesh.rotation;
        
        // Calculate the coordinates at the center of the screen
        // This is the point directly in front of the camera on the planet surface
        
        // Start with a ray from the camera to the center of the screen
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.world.camera);
        
        // Check if the ray intersects with the planet
        const intersects = raycaster.intersectObject(this.world.planet.mesh);
        
        if (intersects.length > 0) {
            // Get the intersection point
            const point = intersects[0].point;
            
            // Calculate spherical coordinates
            const radius = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
            const theta = Math.atan2(point.z, point.x); // Longitude
            const phi = Math.acos(point.y / radius); // Latitude
            
            // Update the coordinate labels
            document.getElementById('center-cross-x').textContent = point.x.toFixed(3);
            document.getElementById('center-cross-y').textContent = point.y.toFixed(3);
            document.getElementById('center-cross-z').textContent = point.z.toFixed(3);
            document.getElementById('center-cross-theta').textContent = (theta * 180 / Math.PI).toFixed(1) + '°';
            document.getElementById('center-cross-phi').textContent = (phi * 180 / Math.PI).toFixed(1) + '°';
        } else {
            // If no intersection, show the rotation angles
            document.getElementById('center-cross-x').textContent = '---';
            document.getElementById('center-cross-y').textContent = '---';
            document.getElementById('center-cross-z').textContent = '---';
            document.getElementById('center-cross-theta').textContent = (rotation.y * 180 / Math.PI).toFixed(1) + '°';
            document.getElementById('center-cross-phi').textContent = (rotation.x * 180 / Math.PI).toFixed(1) + '°';
        }
    }
    
    /**
     * Toggle the visibility of the center cross indicator
     * @param {boolean} [visible] If provided, set to this visibility state, otherwise toggle
     * @returns {boolean} The new visibility state
     */
    toggleCenterCrossIndicator(visible) {
        if (!this.centerCrossIndicator) {
            return false;
        }
        
        // If visible parameter is provided, set to that state
        // Otherwise toggle the current state
        if (visible !== undefined) {
            this.centerCrossIndicator.style.display = visible ? 'block' : 'none';
        } else {
            const currentDisplay = this.centerCrossIndicator.style.display;
            this.centerCrossIndicator.style.display = (currentDisplay === 'none') ? 'block' : 'none';
        }
        
        return this.centerCrossIndicator.style.display !== 'none';
    }
    
    /**
     * Clean up event listeners and DOM elements
     */
    dispose() {
        // Remove event listeners
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        
        // Clear the coordinate update interval
        if (this.coordinateUpdateInterval) {
            clearInterval(this.coordinateUpdateInterval);
            this.coordinateUpdateInterval = null;
        }
        
        // Remove DOM elements
        if (this.keyboardShortcutsModal) {
            document.body.removeChild(this.keyboardShortcutsModal);
        }
        
        if (this.centerCrossIndicator) {
            document.body.removeChild(this.centerCrossIndicator);
        }
        
        console.log('Debug shortcuts disposed');
    }
} 