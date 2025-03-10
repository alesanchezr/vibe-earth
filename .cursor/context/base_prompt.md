# Vibe Earth - 3D Online World Visualization

## Project Architecture

### Core Components

1. **World Class** (`src/frontend/World.js`)
   - Main orchestrator for the 3D visualization
   - Manages scene, camera, renderer, and user interactions
   - Handles WebSocket connections and real-time updates
   - Controls camera movements and user tracking

2. **Planet Class** (`src/frontend/Planet.js`)
   - Handles planet geometry generation and rendering
   - Manages atmosphere and ocean effects
   - Controls planet rotation and positioning
   - Uses Web Workers for geometry generation

3. **Geek Class** (`src/frontend/Geek.js`)
   - Represents individual users in the world
   - Handles user animations and physics
   - Manages user positioning and collision detection

4. **Sky Class** (`src/frontend/Sky.js`)
   - Controls day/night cycle
   - Manages sky color transitions
   - Handles lighting changes

### Rendering System

#### Planet Rendering

1. **Geometry Generation**
   - Uses Web Workers for parallel processing
   - Generates sphere geometry with customizable detail level
   - Applies noise for terrain variation
   - Creates separate meshes for land and ocean

2. **Materials**
   - Land: Custom shader material with vertex colors
   - Ocean: Transparent material with caustics
   - Atmosphere: Custom shader with glow effect

3. **Biome System**
   - Uses noise functions for biome distribution
   - Supports multiple terrain types (mountains, beaches, etc.)
   - Handles vegetation placement based on biome rules

#### Position Calculation

1. **Spherical Coordinates**
   ```javascript
   // Convert spherical coordinates to Cartesian
   const phi = Math.acos(-1 + (2 * Math.random()));
   const theta = Math.random() * Math.PI * 2;
   const x = Math.sin(phi) * Math.cos(theta);
   const y = Math.sin(phi) * Math.sin(theta);
   const z = Math.cos(phi);
   ```

2. **Surface Normal Calculation**
   ```javascript
   // For any point on the sphere, the normal is the normalized position vector
   const normal = position.clone().normalize();
   ```

3. **Object Placement**
   - Objects are placed on the planet surface
   - Orientation is calculated using surface normal
   - Collision detection uses spherical distance

### Key Concepts

1. **Planet Scale**
   - Base radius: 3000 units
   - Camera distance: 1.5x to 5x radius
   - Atmosphere height: 15% of radius

2. **Coordinate System**
   - Origin (0,0,0) at planet center
   - Y-axis points up
   - X and Z axes form the equatorial plane

3. **Time System**
   - Day duration: 30 minutes
   - Time of day: 0 to 1 (0 = midnight, 0.5 = noon)
   - Smooth transitions between day/night states

### Development Guidelines

1. **Adding New Features**
   - Consider Web Worker usage for heavy computations
   - Maintain proper cleanup in dispose methods
   - Use TWEEN for smooth animations
   - Respect the global debug flag for logging

2. **Performance Considerations**
   - Use instancing for repeated objects
   - Implement level of detail for distant objects
   - Batch material updates
   - Use object pooling for particles

3. **Debug Mode**
   - Set `debug: true` in Planet options for detailed logging
   - Use `setDebug(true)` for global debug output
   - Console logs are filtered based on debug state

### Common Operations

1. **Adding Objects to Planet Surface**
   ```javascript
   // Get random position
   const position = planet.getRandomPosition();
   
   // Scale to planet surface
   position.multiplyScalar(planetRadius);
   
   // Calculate orientation
   const normal = position.clone().normalize();
   const up = new THREE.Vector3(0, 1, 0);
   const matrix = new THREE.Matrix4();
   matrix.lookAt(position, new THREE.Vector3(0,0,0), up);
   ```

2. **Updating Colors Based on Time**
   ```javascript
   // Update atmosphere color
   const timeOfDay = sky.getTimeOfDay();
   const color = atmosphereGradient.get(timeOfDay);
   
   // Update vegetation colors
   planet.updateColor(timeOfDay);
   ```

3. **Camera Positioning**
   ```javascript
   // Position relative to planet
   const orbitHeight = planetRadius * 1.5;
   camera.position.set(0, orbitHeight, 0);
   camera.lookAt(0, 0, 0);
   ```

### Error Handling

1. **Common Issues**
   - Check planet.ready before operations
   - Verify object existence before access
   - Handle WebSocket disconnections
   - Manage memory cleanup

2. **Debugging Tips**
   - Enable debug mode for detailed logs
   - Check console for Web Worker messages
   - Verify coordinate transformations
   - Monitor frame rate and memory usage 