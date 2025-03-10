import { Color, Vector3 } from 'three';
import UberNoise from 'uber-noise';
import { ColorGradient } from './helper/colorgradient';
import { Octree } from './helper/octree';
import { biomePresets } from './presets';

export class Biome {
  constructor(options = {}) {
    if (options.preset) {
      const preset = biomePresets[options.preset];
      if (preset) {
        options = {
          ...preset,
          ...options,
        };
      }
    }

    this.options = options;
    this.min = -0.05;
    this.max = 0.05;

    // Initialize noise generators
    if (options.noise) {
      this.noise = new UberNoise(options.noise);
      this.min = options.noise.min ?? this.min;
      this.max = options.noise.max ?? this.max;
    }

    if (options.seaNoise) {
      this.seaNoise = new UberNoise(options.seaNoise);
    }

    // Initialize color gradients
    if (options.colors) {
      this.colors = new ColorGradient(options.colors);
    }

    if (options.seaColors) {
      this.seaColors = new ColorGradient(options.seaColors);
    }

    // Initialize vegetation octree
    this.vegetationPositions = new Octree();
  }

  getHeight(pos) {
    if (this.noise) {
      return this.noise.get(pos);
    }
    return 0;
  }

  getSeaHeight(pos) {
    if (this.seaNoise) {
      return this.seaNoise.get(pos);
    }
    return 0;
  }

  getColor(pos, normalizedHeight, steepness) {
    if (!this.colors) return null;

    const color = this.colors.get(normalizedHeight);
    if (!color) return null;

    // Apply steepness effect (make steep areas darker)
    const steepnessFactor = Math.max(0, 1 - steepness / (Math.PI / 2));
    color.multiplyScalar(0.7 + 0.3 * steepnessFactor);

    // Apply tint color if specified
    if (this.options.tintColor) {
      const tint = new Color(this.options.tintColor);
      color.lerp(tint, 0.2);
    }

    return color;
  }

  getSeaColor(pos, normalizedHeight) {
    if (!this.seaColors) return null;

    const color = this.seaColors.get(normalizedHeight);
    if (!color) return null;

    // Apply depth effect (make deeper areas darker)
    const depthFactor = Math.max(0, 1 + normalizedHeight);
    color.multiplyScalar(0.7 + 0.3 * depthFactor);

    return color;
  }

  addVegetation(item, position, normalizedHeight, steepness) {
    // Store vegetation in octree for efficient spatial queries
    this.vegetationPositions.insert(position.x, position.y, position.z, item);
  }

  itemsAround(position, radius) {
    return this.vegetationPositions.queryBoxXYZ(
      position.x,
      position.y,
      position.z,
      radius
    );
  }

  maxVegetationRadius() {
    let max = 0;
    for (const item of this.options.vegetation?.items ?? []) {
      if (item.ground?.radius) {
        max = Math.max(max, item.ground.radius);
      }
    }
    return max;
  }

  vegetationHeightAndColorForFace(a, b, c, color, sideLength) {
    const maxDist = this.maxVegetationRadius();
    const vegetations = this.itemsAround(a, maxDist + sideLength * 2);

    let heightA = 0;
    let heightB = 0;
    let heightC = 0;

    [a, b, c].forEach((p, j) => {
      for (const vegetation of vegetations) {
        if (!vegetation.data?.ground?.radius) continue;

        const distance = p.distanceTo(vegetation);
        if (distance < vegetation.data.ground.radius) {
          let amount = Math.max(0, 1 - distance / vegetation.data.ground.radius);
          amount = Math.pow(amount, 0.5);

          const height = (vegetation.data.ground?.raise ?? 0) * amount;

          if (j === 0) heightA += height;
          if (j === 1) heightB += height;
          if (j === 2) heightC += height;

          if (vegetation.data.ground.color) {
            const newColor = new Color(vegetation.data.ground.color);
            color.lerp(newColor, amount / 3);
          }
        }
      }
    });

    return {
      heightA,
      heightB,
      heightC,
      color,
    };
  }
} 