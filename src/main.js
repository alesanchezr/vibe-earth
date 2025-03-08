/**
 * Main entry point for the Online World Visualization
 */
import './style.css';
import { World } from './World.js';

console.log("Application script loaded");

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded, initializing application");
    
    try {
        console.log("Creating World instance");
        const app = new World();
        console.log("World instance created successfully:", app);
        
        // Store the app instance on window for debugging
        window.worldApp = app;
        console.log("World instance stored on window.worldApp for debugging");
    } catch (error) {
        console.error("Error initializing application:", error);
    }
}); 