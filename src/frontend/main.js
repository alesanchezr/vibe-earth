/**
 * Main entry point for the Geek World Visualization
 */
import './style.css';
import { World } from './World.js';
import { signInAnonymously } from './supabase-client.js';

console.log("Application script loaded");

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM loaded, initializing Geek World");
    
    try {
        // Update status display
        updateStatusDisplay('Authenticating...', 'yellow');
        
        // Sign in anonymously with Supabase
        console.log("Signing in anonymously with Supabase...");
        let userId = null;
        let session = null;
        
        try {
            session = await signInAnonymously();
            userId = session?.user?.id;
            console.log("Authenticated with Supabase, user ID:", userId);
        } catch (error) {
            console.error("Authentication error:", error);
            updateStatusDisplay('Authentication failed: ' + error.message, 'red');
            // Show error message to user
            alert('Authentication failed: ' + error.message);
            return; // Stop initialization if authentication fails
        }
        
        // Update user ID display
        const userIdElement = document.getElementById('user-id');
        if (userIdElement && userId) {
            // Show only the first 8 characters of the user ID for privacy
            const shortId = userId.substring(0, 8) + '...';
            userIdElement.textContent = shortId;
        }
        
        // Update status display
        updateStatusDisplay('Initializing world...', 'yellow');
        
        // Create the World instance with the authenticated user
        console.log("Creating World instance with userId:", userId);
        
        if (!userId) {
            console.error("userId is null or undefined, cannot create World instance");
            updateStatusDisplay('Authentication failed: No user ID', 'red');
            return;
        }
        
        const app = new World(userId);
        console.log("World instance created successfully:", app);
        
        // Store the app instance on window for debugging
        window.worldApp = app;
        console.log("World instance stored on window.worldApp for debugging");
        
        // Update status display
        updateStatusDisplay('Connected', 'green');
    } catch (error) {
        console.error("Error initializing application:", error);
        updateStatusDisplay('Initialization failed: ' + error.message, 'red');
    }
});

/**
 * Update the status display in the UI
 * @param {string} message The status message
 * @param {string} color The color of the status message
 */
function updateStatusDisplay(message, color) {
    const userStatusElement = document.getElementById('user-status');
    if (userStatusElement) {
        userStatusElement.textContent = message;
        
        // Set color based on status
        switch (color) {
            case 'green':
                userStatusElement.style.color = '#4CAF50';
                break;
            case 'red':
                userStatusElement.style.color = '#EA4335';
                break;
            case 'yellow':
                userStatusElement.style.color = '#FBBC05';
                break;
            case 'orange':
                userStatusElement.style.color = '#FF9800';
                break;
            default:
                userStatusElement.style.color = '#FFFFFF';
        }
    }
} 