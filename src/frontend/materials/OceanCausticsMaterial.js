import { MeshStandardMaterial } from 'three';

export class PlanetMaterialWithCaustics extends MeshStandardMaterial {
    constructor(parameters) {
        // Remove shape from parameters before passing to parent
        const { shape, ...meshStandardParams } = parameters;
        
        // Set default material properties
        const defaultParams = {
            color: 0x4285F4,  // Google blue
            metalness: 0.5,
            roughness: 0.5,
            transparent: true,
            opacity: 0.8,
            vertexColors: true,  // Enable vertex colors
            ...meshStandardParams
        };
        
        // Call parent constructor with parameters
        super(defaultParams);
    }

    update() {
        // No need to update anything
    }
}

export default PlanetMaterialWithCaustics; 