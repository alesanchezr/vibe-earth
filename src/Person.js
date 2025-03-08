/**
 * Person Class
 * Represents a person in the online world visualization
 */
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';

/**
 * Represents a person in the 3D world
 */
export class Person {
    /**
     * Create a new Person
     * @param {Object} options - Configuration options
     * @param {number} options.size - Size of the person bubble
     * @param {number} options.color - Color of the person bubble (hex)
     * @param {Object} options.position - Position {x, y} in the scene
     * @param {THREE.Scene} options.scene - The Three.js scene to add to
     * @param {number} options.cameraY - Optional camera height
     */
    constructor(options) {
        this.size = options.size;
        this.color = options.color;
        
        // Handle both position formats (x,y) or (x,z)
        this.position = {
            x: options.position.x,
            y: 0, // In 3D, y is up/down
            z: options.position.z || options.position.y // Support both z and y for backward compatibility
        };
        
        this.scene = options.scene;
        this.cameraY = options.cameraY || 4000; // Get camera height or default to 4km
        
        // Animation properties
        this.floatSpeed = 0.5 + Math.random() * 0.5;
        this.floatAmplitude = 2 + Math.random() * 3;
        this.floatOffset = Math.random() * Math.PI * 2;
        this.originalY = this.position.y;
        this.isFloating = false; // Start with floating disabled until physics simulation completes
        
        // Physics properties - EXTREME SPEED with NO BOUNCING
        // Add small random horizontal velocity for more interesting falling motion
        this.velocity = { 
            x: (Math.random() - 0.5) * 50, // Increased random x velocity
            y: -200, // Much higher initial downward velocity
            z: (Math.random() - 0.5) * 50  // Increased random z velocity
        };
        this.acceleration = { x: 0, y: -500, z: 0 }; // Extreme gravity acceleration
        this.isSimulating = true; // Whether physics simulation is active
        this.groundLevel = 0; // Y-coordinate of the ground
        
        // Create the mesh
        this.mesh = this.createMesh();
        
        // Add to scene
        this.scene.add(this.mesh);
        
        // Start position high above the camera
        const startHeight = this.cameraY + 1000; // 1000 units above the camera (which is now at 4km)
        this.mesh.position.set(this.position.x, startHeight, this.position.z);
        
        // Set the initial position for physics simulation
        this.position.y = startHeight;
    }
    
    /**
     * Create the mesh for this person as a cute water drop with a face
     * @returns {THREE.Group} The created mesh group
     */
    createMesh() {
        // Create a group to hold all the parts of the water drop
        const group = new THREE.Group();
        
        // Create the main water drop body (teardrop shape)
        const dropGeometry = new THREE.SphereGeometry(this.size, 16, 16);
        
        // Slightly squash the sphere to make it more drop-like
        dropGeometry.scale(1, 1.2, 1);
        
        // Create material with no specular highlights to prevent whitish appearance
        const dropMaterial = new THREE.MeshLambertMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.9,
            emissive: new THREE.Color(this.color).multiplyScalar(0.2), // Slight self-illumination
            emissiveIntensity: 0.2,
            reflectivity: 0,
            flatShading: false
        });
        
        const dropBody = new THREE.Mesh(dropGeometry, dropMaterial);
        
        // Add a slight taper at the top for a water drop look
        dropBody.scale.set(1, 1, 1);
        dropBody.position.y = this.size * 0.2; // Raise slightly to account for the taper
        
        // Add the body to the group
        group.add(dropBody);
        
        // Create the face (only visible when zoomed in)
        this.createFace(group);
        
        // Position the entire group so the bottom of the drop is at y=0
        group.position.y = this.size;
        
        // Add a slight random rotation for more visual interest
        group.rotation.y = Math.random() * Math.PI * 2;
        
        return group;
    }
    
    /**
     * Create a cute face for the water drop
     * @param {THREE.Group} group The group to add the face to
     */
    createFace(group) {
        // Create eyes (white spheres with black pupils)
        const eyeSize = this.size * 0.2;
        const eyeSpacing = this.size * 0.3;
        const eyeHeight = this.size * 0.3;
        const eyeForward = this.size * 0.7; // Position eyes toward the front
        
        // Eye whites
        const eyeGeometry = new THREE.SphereGeometry(eyeSize, 8, 8);
        const eyeMaterial = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            transparent: false,
            emissive: 0x444444,
            emissiveIntensity: 0.1
        });
        
        // Left eye
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-eyeSpacing, eyeHeight, eyeForward);
        group.add(leftEye);
        
        // Right eye
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(eyeSpacing, eyeHeight, eyeForward);
        group.add(rightEye);
        
        // Pupils (small black spheres)
        const pupilSize = eyeSize * 0.5;
        const pupilGeometry = new THREE.SphereGeometry(pupilSize, 6, 6);
        const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        
        // Left pupil
        const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        leftPupil.position.set(0, 0, eyeSize * 0.6);
        leftEye.add(leftPupil);
        
        // Right pupil
        const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        rightPupil.position.set(0, 0, eyeSize * 0.6);
        rightEye.add(rightPupil);
        
        // Create a happy mouth (curved line)
        const mouthWidth = this.size * 0.5;
        const mouthHeight = this.size * 0.1;
        const mouthY = eyeHeight - this.size * 0.4;
        
        // Create a smile using a curved tube geometry
        const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(-mouthWidth/2, mouthY, eyeForward),
            new THREE.Vector3(0, mouthY - mouthHeight, eyeForward + mouthHeight * 0.5),
            new THREE.Vector3(mouthWidth/2, mouthY, eyeForward)
        );
        
        const mouthGeometry = new THREE.TubeGeometry(curve, 10, mouthHeight * 0.3, 8, false);
        const mouthMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
        
        group.add(mouth);
        
        // Randomly add rosy cheeks to some water drops
        if (Math.random() > 0.5) {
            const cheekSize = this.size * 0.15;
            const cheekGeometry = new THREE.SphereGeometry(cheekSize, 8, 8);
            const cheekMaterial = new THREE.MeshLambertMaterial({
                color: 0xff9999,
                transparent: true,
                opacity: 0.6
            });
            
            // Left cheek
            const leftCheek = new THREE.Mesh(cheekGeometry, cheekMaterial);
            leftCheek.position.set(-eyeSpacing * 1.2, mouthY + cheekSize, eyeForward - cheekSize * 0.5);
            group.add(leftCheek);
            
            // Right cheek
            const rightCheek = new THREE.Mesh(cheekGeometry, cheekMaterial);
            rightCheek.position.set(eyeSpacing * 1.2, mouthY + cheekSize, eyeForward - cheekSize * 0.5);
            group.add(rightCheek);
        }
    }
    
    /**
     * Start the floating animation after impact
     */
    animateEntry() {
        // Create a cute squash and stretch animation for impact
        
        // First, squash the water drop
        new TWEEN.Tween(this.mesh.scale)
            .to({ x: 1.3, y: 0.7, z: 1.3 }, 150)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                // Then bounce back with a slight overshoot
                new TWEEN.Tween(this.mesh.scale)
                    .to({ x: 0.9, y: 1.2, z: 0.9 }, 150)
                    .easing(TWEEN.Easing.Cubic.Out)
                    .onComplete(() => {
                        // Finally settle to normal scale
                        new TWEEN.Tween(this.mesh.scale)
                            .to({ x: 1, y: 1, z: 1 }, 200)
                            .easing(TWEEN.Easing.Elastic.Out)
                            .start();
                    })
                    .start();
            })
            .start();
        
        // Make the water drop do a happy little wiggle
        this.wiggleHappily();
    }
    
    /**
     * Make the water drop do a happy little wiggle
     */
    wiggleHappily() {
        // Find the face parts
        if (this.mesh.children.length < 3) return;
        
        // Wiggle the entire drop from side to side
        const originalRotation = this.mesh.rotation.y;
        const wiggleAmount = 0.2;
        
        // First wiggle left
        new TWEEN.Tween(this.mesh.rotation)
            .to({ y: originalRotation - wiggleAmount }, 150)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                // Then wiggle right
                new TWEEN.Tween(this.mesh.rotation)
                    .to({ y: originalRotation + wiggleAmount }, 300)
                    .easing(TWEEN.Easing.Cubic.InOut)
                    .onComplete(() => {
                        // Then back to center
                        new TWEEN.Tween(this.mesh.rotation)
                            .to({ y: originalRotation }, 150)
                            .easing(TWEEN.Easing.Cubic.In)
                            .start();
                    })
                    .start();
            })
            .start();
        
        // Make the eyes do a happy squint
        setTimeout(() => {
            const leftEye = this.mesh.children[1];
            const rightEye = this.mesh.children[2];
            
            if (leftEye && rightEye) {
                // Squint eyes (scale down vertically, scale up horizontally)
                new TWEEN.Tween(leftEye.scale)
                    .to({ y: 0.6, x: 1.2, z: 1.2 }, 300)
                    .easing(TWEEN.Easing.Cubic.Out)
                    .onComplete(() => {
                        // Return to normal after a delay
                        setTimeout(() => {
                            new TWEEN.Tween(leftEye.scale)
                                .to({ y: 1, x: 1, z: 1 }, 300)
                                .easing(TWEEN.Easing.Cubic.InOut)
                                .start();
                        }, 500);
                    })
                    .start();
                    
                new TWEEN.Tween(rightEye.scale)
                    .to({ y: 0.6, x: 1.2, z: 1.2 }, 300)
                    .easing(TWEEN.Easing.Cubic.Out)
                    .onComplete(() => {
                        // Return to normal after a delay
                        setTimeout(() => {
                            new TWEEN.Tween(rightEye.scale)
                                .to({ y: 1, x: 1, z: 1 }, 300)
                                .easing(TWEEN.Easing.Cubic.InOut)
                                .start();
                        }, 500);
                    })
                    .start();
            }
        }, 150);
    }
    
    /**
     * Update physics simulation
     * @param {number} deltaTime Time since last update in seconds
     */
    updatePhysics(deltaTime) {
        if (!this.isSimulating) return;
        
        // Cap deltaTime to prevent issues with very large jumps
        const dt = Math.min(deltaTime, 0.05);
        
        // Apply acceleration to velocity
        this.velocity.x += this.acceleration.x * dt;
        this.velocity.y += this.acceleration.y * dt;
        this.velocity.z += this.acceleration.z * dt;
        
        // Apply terminal velocity limit for more realistic falling
        const terminalVelocity = -3000; // Extreme terminal velocity
        if (this.velocity.y < terminalVelocity) {
            this.velocity.y = terminalVelocity;
        }
        
        // Apply velocity to position
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.position.z += this.velocity.z * dt;
        
        // Check for ground collision
        if (this.position.y < this.groundLevel + this.size) {
            // Stop at ground level - no bouncing
            this.position.y = this.groundLevel + this.size;
            
            // Create impact wave effect
            this.createImpactWave();
            
            // Stop simulating immediately
            this.isSimulating = false;
            this.isFloating = true;
            
            // Start floating animation
            this.animateEntry();
        }
        
        // Update mesh position
        this.mesh.position.x = this.position.x;
        this.mesh.position.z = this.position.z;
        
        // For water drops, we want to keep the bottom at ground level
        // The group's y position is already set to this.size in createMesh
        this.mesh.position.y = this.position.y;
        
        // Add a slight wobble to the water drop as it falls
        if (this.velocity.y < -100) {
            const wobbleAmount = Math.min(Math.abs(this.velocity.y) / 1000, 0.2);
            const wobbleFreq = 10;
            const wobble = Math.sin(Date.now() * 0.01 * wobbleFreq) * wobbleAmount;
            
            // Squash and stretch based on velocity
            this.mesh.scale.y = 1 - wobbleAmount + wobble;
            this.mesh.scale.x = this.mesh.scale.z = 1 + wobbleAmount * 0.5 - wobble * 0.5;
        }
    }
    
    /**
     * Create an expanding wave effect at the impact point
     */
    createImpactWave() {
        // Calculate impact force based on velocity
        const impactForce = Math.min(Math.abs(this.velocity.y) / 100, 10);
        const maxRadius = this.size * 10 * impactForce; // Scale wave size with impact force
        
        // For performance with many people, only create the main wave and flash
        this.createWaveRing(0.1, 0.5, maxRadius, 800, 0.7); // Main wave
        
        // Add a flash of light at impact point
        const flashGeometry = new THREE.CircleGeometry(this.size * 2, 16);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.set(this.position.x, 0.2, this.position.z);
        flash.rotation.x = Math.PI / 2;
        this.scene.add(flash);
        
        // Animate the flash fading quickly
        new TWEEN.Tween(flashMaterial)
            .to({ opacity: 0 }, 200)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                this.scene.remove(flash);
                flashMaterial.dispose();
                flashGeometry.dispose();
            })
            .start();
        
        // Only create dust particles for larger people (performance optimization)
        if (this.size > 25 && Math.random() < 0.3) {
            this.createDustParticles(5); // Reduced particle count
        }
    }
    
    /**
     * Create a single wave ring with the given parameters
     */
    createWaveRing(innerRadius, outerRadius, maxRadius, duration, opacity) {
        // Create a ring geometry for the wave
        const waveGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 16);
        const waveMaterial = new THREE.MeshBasicMaterial({
            color: 0xdddddd,
            transparent: true,
            opacity: opacity,
            side: THREE.DoubleSide
        });
        
        const wave = new THREE.Mesh(waveGeometry, waveMaterial);
        
        // Position the wave at ground level
        wave.position.set(this.position.x, 0.1, this.position.z); // Slightly above ground to avoid z-fighting
        wave.rotation.x = Math.PI / 2; // Rotate to be horizontal
        
        // Add to scene
        this.scene.add(wave);
        
        // Scale animation
        new TWEEN.Tween(wave.scale)
            .to({ x: maxRadius, y: maxRadius, z: 1 }, duration)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
        
        // Opacity animation
        new TWEEN.Tween(waveMaterial)
            .to({ opacity: 0 }, duration)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                // Remove the wave from the scene when animation completes
                this.scene.remove(wave);
                waveMaterial.dispose();
                waveGeometry.dispose();
            })
            .start();
    }
    
    /**
     * Create dust particles that fly outward from the impact point
     * @param {number} particleCount Number of particles to create
     */
    createDustParticles(particleCount = 10) {
        const particleSize = this.size / 6;
        
        for (let i = 0; i < particleCount; i++) {
            // Create a small sphere for each particle
            const geometry = new THREE.SphereGeometry(particleSize * (0.5 + Math.random() * 0.5), 4, 4);
            const material = new THREE.MeshBasicMaterial({
                color: 0xcccccc,
                transparent: true,
                opacity: 0.5 + Math.random() * 0.3
            });
            
            const particle = new THREE.Mesh(geometry, material);
            
            // Position at impact point
            particle.position.set(
                this.position.x,
                0.1 + Math.random() * 0.3,
                this.position.z
            );
            
            this.scene.add(particle);
            
            // Random direction outward
            const angle = Math.random() * Math.PI * 2;
            const distance = this.size * (2 + Math.random() * 3);
            
            // Calculate target position
            const targetX = this.position.x + Math.cos(angle) * distance;
            const targetY = 0.5 + Math.random() * 1.5; // Lower height
            const targetZ = this.position.z + Math.sin(angle) * distance;
            
            // Animate position - flying outward and up, then down
            new TWEEN.Tween(particle.position)
                .to({ x: targetX, y: targetY, z: targetZ }, 200 + Math.random() * 100)
                .easing(TWEEN.Easing.Cubic.Out)
                .onComplete(() => {
                    // Fall back down
                    new TWEEN.Tween(particle.position)
                        .to({ y: 0 }, 100 + Math.random() * 150)
                        .easing(TWEEN.Easing.Cubic.In)
                        .start();
                })
                .start();
            
            // Animate opacity - fade out
            new TWEEN.Tween(material)
                .to({ opacity: 0 }, 300 + Math.random() * 200)
                .easing(TWEEN.Easing.Cubic.In)
                .delay(200)
                .onComplete(() => {
                    this.scene.remove(particle);
                    material.dispose();
                    geometry.dispose();
                })
                .start();
        }
    }
    
    /**
     * Drop the person to the ground
     */
    drop() {
        this.isSimulating = true;
        this.isFloating = false;
        this.velocity = { x: 0, y: 0, z: 0 };
    }
    
    /**
     * Animate the exit of this person
     * @param {Function} onComplete Callback when animation completes
     */
    animateExit(onComplete) {
        // Stop floating
        this.isFloating = false;
        
        // Make the water drop look surprised
        this.lookSurprised();
        
        // After the surprised look, start rising and fading
        setTimeout(() => {
            // Animate moving up and fading out
            const startY = this.mesh.position.y;
            
            // First, make the drop stretch upward as if being pulled
            new TWEEN.Tween(this.mesh.scale)
                .to({ y: 1.5, x: 0.8, z: 0.8 }, 400)
                .easing(TWEEN.Easing.Cubic.Out)
                .start();
            
            // Then move upward
            new TWEEN.Tween(this.mesh.position)
                .to({ y: startY + 150 }, 1000)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
            
            // Find the body (first child)
            const body = this.mesh.children[0];
            if (body && body.material) {
                // Fade out the body
                new TWEEN.Tween(body.material)
                    .to({ opacity: 0 }, 800)
                    .easing(TWEEN.Easing.Cubic.In)
                    .delay(200)
                    .onComplete(() => {
                        if (onComplete) onComplete();
                    })
                    .start();
            } else {
                // Fallback if body not found
                setTimeout(() => {
                    if (onComplete) onComplete();
                }, 1000);
            }
            
            // Add a spin as it rises
            new TWEEN.Tween(this.mesh.rotation)
                .to({ y: this.mesh.rotation.y + Math.PI * 2 }, 1000)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
        }, 500);
    }
    
    /**
     * Make the water drop look surprised
     */
    lookSurprised() {
        // Find the face parts
        if (this.mesh.children.length < 4) return;
        
        const leftEye = this.mesh.children[1];
        const rightEye = this.mesh.children[2];
        const mouth = this.mesh.children[3];
        
        if (leftEye && rightEye) {
            // Make eyes wide with surprise
            new TWEEN.Tween(leftEye.scale)
                .to({ y: 1.5, x: 1.5, z: 1.5 }, 300)
                .easing(TWEEN.Easing.Elastic.Out)
                .start();
                
            new TWEEN.Tween(rightEye.scale)
                .to({ y: 1.5, x: 1.5, z: 1.5 }, 300)
                .easing(TWEEN.Easing.Elastic.Out)
                .start();
        }
        
        if (mouth) {
            // Change mouth to an "O" shape of surprise
            // First, remove the current mouth
            this.mesh.remove(mouth);
            mouth.geometry.dispose();
            mouth.material.dispose();
            
            // Create a circular mouth
            const mouthRadius = this.size * 0.15;
            const mouthGeometry = new THREE.CircleGeometry(mouthRadius, 16);
            const mouthMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
            const newMouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
            
            // Position the mouth
            const eyeHeight = this.size * 0.3;
            const eyeForward = this.size * 0.7;
            const mouthY = eyeHeight - this.size * 0.4;
            newMouth.position.set(0, mouthY, eyeForward);
            newMouth.rotation.y = Math.PI; // Face forward
            
            this.mesh.add(newMouth);
        }
        
        // Add a little jump of surprise
        const currentY = this.mesh.position.y;
        new TWEEN.Tween(this.mesh.position)
            .to({ y: currentY + this.size * 0.5 }, 150)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                new TWEEN.Tween(this.mesh.position)
                    .to({ y: currentY }, 150)
                    .easing(TWEEN.Easing.Cubic.In)
                    .start();
            })
            .start();
    }
    
    /**
     * Update the floating animation
     * @param {number} time Current time in seconds
     */
    updateFloating(time) {
        if (!this.isFloating) return;
        
        // Initialize wandering properties if they don't exist
        if (!this.wanderProperties) {
            this.initializeWandering();
        }
        
        // Calculate floating height based on sine wave
        const floatHeight = this.floatAmplitude * Math.sin(time * this.floatSpeed + this.floatOffset);
        
        // Apply wandering movement
        this.updateWandering(time);
        
        // Apply to mesh position (y position is handled separately for floating)
        this.mesh.position.y = this.originalY + this.size + floatHeight;
        
        // Add a gentle bobbing effect to the water drop
        const bobAmount = 0.05;
        const bobFreq = 1.5;
        const bob = Math.sin(time * bobFreq + this.floatOffset * 2) * bobAmount;
        
        // Squash and stretch slightly for a more lively water drop
        this.mesh.scale.y = 1 + bob;
        this.mesh.scale.x = this.mesh.scale.z = 1 - bob * 0.5;
        
        // Add a gentle rotation
        this.mesh.rotation.y += 0.005;
        
        // Make the eyes blink occasionally
        if (Math.random() < 0.002) {
            this.blinkEyes();
        }
        
        // Occasionally change wandering direction
        if (Math.random() < 0.01) {
            this.changeWanderingDirection();
        }
    }
    
    /**
     * Initialize wandering properties
     */
    initializeWandering() {
        this.wanderProperties = {
            // Store initial drop position
            initialX: this.position.x,
            initialZ: this.position.z,
            // Current position is already set
            // Maximum distance to wander from initial position (in feet/units)
            maxDistance: this.size * 3 + Math.random() * this.size * 2, // 3-5x size
            // Current direction of movement (radians)
            direction: Math.random() * Math.PI * 2,
            // Speed of movement
            speed: 0.2 + Math.random() * 0.3, // Slow, gentle movement
            // Time until next direction change
            directionChangeTime: 0,
            // Whether currently moving or paused
            isMoving: Math.random() > 0.3, // 70% chance to start moving
            // Time until next movement state change
            stateChangeTime: 5 + Math.random() * 5
        };
    }
    
    /**
     * Update the wandering movement
     * @param {number} time Current time in seconds
     */
    updateWandering(time) {
        const wp = this.wanderProperties;
        
        // Check if it's time to change movement state (moving/paused)
        if (wp.stateChangeTime <= time) {
            wp.isMoving = !wp.isMoving;
            wp.stateChangeTime = time + 3 + Math.random() * 7; // Change state every 3-10 seconds
            
            // If starting to move, pick a new direction
            if (wp.isMoving) {
                this.changeWanderingDirection();
                
                // Do a little "getting ready to move" animation
                this.prepareToMove();
            }
        }
        
        // Only move if in moving state
        if (wp.isMoving) {
            // Calculate new position
            const moveStep = wp.speed * 0.1; // Small step size for smooth movement
            const newX = this.position.x + Math.cos(wp.direction) * moveStep;
            const newZ = this.position.z + Math.sin(wp.direction) * moveStep;
            
            // Calculate distance from initial position
            const dx = newX - wp.initialX;
            const dz = newZ - wp.initialZ;
            const distanceFromStart = Math.sqrt(dx * dx + dz * dz);
            
            // Only move if within max distance, otherwise change direction
            if (distanceFromStart <= wp.maxDistance) {
                this.position.x = newX;
                this.position.z = newZ;
                this.mesh.position.x = newX;
                this.mesh.position.z = newZ;
                
                // Rotate to face movement direction
                const targetRotation = wp.direction + Math.PI / 2; // Add 90 degrees to face direction of travel
                this.mesh.rotation.y = this.smoothRotation(this.mesh.rotation.y, targetRotation, 0.1);
            } else {
                // If we've reached the boundary, turn back toward center
                const angleToCenter = Math.atan2(wp.initialZ - this.position.z, wp.initialX - this.position.x);
                wp.direction = angleToCenter + (Math.random() - 0.5) * Math.PI * 0.5; // Add some randomness
            }
        }
    }
    
    /**
     * Change the wandering direction
     */
    changeWanderingDirection() {
        const wp = this.wanderProperties;
        
        // If near the boundary, turn back toward center
        const dx = this.position.x - wp.initialX;
        const dz = this.position.z - wp.initialZ;
        const distanceFromStart = Math.sqrt(dx * dx + dz * dz);
        
        if (distanceFromStart > wp.maxDistance * 0.7) {
            // Close to max distance, turn back toward center
            const angleToCenter = Math.atan2(wp.initialZ - this.position.z, wp.initialX - this.position.x);
            wp.direction = angleToCenter + (Math.random() - 0.5) * Math.PI * 0.5; // Add some randomness
        } else {
            // Otherwise, choose a random new direction
            wp.direction += (Math.random() - 0.5) * Math.PI; // Change by up to +/- 90 degrees
        }
    }
    
    /**
     * Smooth rotation between angles
     * @param {number} current Current angle
     * @param {number} target Target angle
     * @param {number} factor Smoothing factor (0-1)
     * @returns {number} New angle
     */
    smoothRotation(current, target, factor) {
        // Normalize angles
        while (current > Math.PI) current -= Math.PI * 2;
        while (current < -Math.PI) current += Math.PI * 2;
        while (target > Math.PI) target -= Math.PI * 2;
        while (target < -Math.PI) target += Math.PI * 2;
        
        // Find shortest direction
        let delta = target - current;
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        
        // Apply smoothing
        return current + delta * factor;
    }
    
    /**
     * Animate preparation to move
     */
    prepareToMove() {
        // Do a little anticipation squash before moving
        new TWEEN.Tween(this.mesh.scale)
            .to({ y: 0.9, x: 1.1, z: 1.1 }, 300)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                new TWEEN.Tween(this.mesh.scale)
                    .to({ y: 1, x: 1, z: 1 }, 200)
                    .easing(TWEEN.Easing.Cubic.Out)
                    .start();
            })
            .start();
    }
    
    /**
     * Make the water drop blink its eyes
     */
    blinkEyes() {
        // Find the eye meshes (first two children after the body)
        const leftEye = this.mesh.children[1];
        const rightEye = this.mesh.children[2];
        
        if (!leftEye || !rightEye) return;
        
        // Store original scale
        const originalScaleY = leftEye.scale.y;
        
        // Close eyes (squash vertically)
        new TWEEN.Tween(leftEye.scale)
            .to({ y: 0.1 }, 100)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                // Open eyes
                new TWEEN.Tween(leftEye.scale)
                    .to({ y: originalScaleY }, 100)
                    .easing(TWEEN.Easing.Cubic.Out)
                    .start();
            })
            .start();
            
        new TWEEN.Tween(rightEye.scale)
            .to({ y: 0.1 }, 100)
            .easing(TWEEN.Easing.Cubic.Out)
            .onComplete(() => {
                new TWEEN.Tween(rightEye.scale)
                    .to({ y: originalScaleY }, 100)
                    .easing(TWEEN.Easing.Cubic.Out)
                    .start();
            })
            .start();
    }
    
    /**
     * Update this person
     * @param {number} deltaTime Time since last update in seconds
     * @param {number} time Current time in seconds
     */
    update(deltaTime, time) {
        if (this.isSimulating) {
            this.updatePhysics(deltaTime);
        } else if (this.isFloating) {
            this.updateFloating(time);
        }
    }
    
    /**
     * Get the current position
     * @returns {Object} Position with x, y, z coordinates
     */
    getPosition() {
        return {
            x: this.position.x,
            y: this.position.y,
            z: this.position.z
        };
    }
    
    /**
     * Check if this person collides with the given position
     * @param {Object} position Position to check
     * @param {number} otherRadius Radius of the other object
     * @returns {boolean} True if collision detected
     */
    collidesWithPosition(position, otherRadius) {
        // Use current position which may have changed due to wandering
        const dx = this.position.x - position.x;
        const dz = this.position.z - position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        return distance < (this.size + otherRadius);
    }
    
    /**
     * Remove this person from the scene
     */
    remove() {
        if (this.mesh && this.scene) {
            this.scene.remove(this.mesh);
            
            // Dispose of geometry and material
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
        }
    }
} 