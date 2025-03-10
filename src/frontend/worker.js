import { Biome } from './biome';
import UberNoise from 'uber-noise';

onmessage = function(e) {
  const { type, data } = e.data;

  if (type === 'createGeometry') {
    try {
      const [geometry, oceanGeometry, vegetation] = createGeometry(data);
      
      // Convert geometry data to transferable format
      const positions = new Float32Array(geometry.positions);
      const colors = new Float32Array(geometry.colors);
      const normals = new Float32Array(geometry.normals);

      const oceanPositions = new Float32Array(oceanGeometry.positions);
      const oceanColors = new Float32Array(oceanGeometry.colors);
      const oceanNormals = new Float32Array(oceanGeometry.normals);
      const oceanMorphPositions = new Float32Array(oceanGeometry.morphPositions);
      const oceanMorphNormals = new Float32Array(oceanGeometry.morphNormals);

      postMessage({
        type: 'geometry',
        data: {
          positions: positions.buffer,
          colors: colors.buffer,
          normals: normals.buffer,
          oceanPositions: oceanPositions.buffer,
          oceanColors: oceanColors.buffer,
          oceanNormals: oceanNormals.buffer,
          oceanMorphPositions: oceanMorphPositions.buffer,
          oceanMorphNormals: oceanMorphNormals.buffer,
          vegetation
        }
      }, [
        positions.buffer,
        colors.buffer,
        normals.buffer,
        oceanPositions.buffer,
        oceanColors.buffer,
        oceanNormals.buffer,
        oceanMorphPositions.buffer,
        oceanMorphNormals.buffer
      ]);
    } catch (error) {
      console.error('Error in worker:', error);
      postMessage({
        type: 'error',
        error: error.message
      });
    }
  }
};

function createGeometry(planetOptions) {
  const detail = Math.min(planetOptions.detail ?? 50, 5);
  const mainGeometry = createIcosahedronGeometry(detail);
  const oceanGeometry = createIcosahedronGeometry(detail);

  const biome = new Biome(planetOptions.biome);
  const vertices = mainGeometry.positions;
  const oceanVertices = oceanGeometry.positions;
  const faceCount = vertices.length / 9;
  const faceSize = (Math.PI * 4) / faceCount;

  // Initialize arrays
  const colors = new Float32Array(vertices.length);
  const oceanColors = new Float32Array(oceanVertices.length);
  const normals = new Float32Array(vertices.length);
  const oceanNormals = new Float32Array(oceanVertices.length);
  const oceanMorphPositions = [];
  const oceanMorphNormals = [];
  const placedVegetation = {};

  // Setup scatter noise
  const scatterAmount = (planetOptions.scatter ?? 1.2) * faceSize;
  const scatterNoise = new UberNoise({
    min: -scatterAmount / 2,
    max: scatterAmount / 2,
    scale: 100,
    seed: 0
  });

  // Process each face
  for (let i = 0; i < vertices.length; i += 9) {
    const a = [vertices[i], vertices[i + 1], vertices[i + 2]];
    const b = [vertices[i + 3], vertices[i + 4], vertices[i + 5]];
    const c = [vertices[i + 6], vertices[i + 7], vertices[i + 8]];

    const oceanA = [oceanVertices[i], oceanVertices[i + 1], oceanVertices[i + 2]];
    const oceanB = [oceanVertices[i + 3], oceanVertices[i + 4], oceanVertices[i + 5]];
    const oceanC = [oceanVertices[i + 6], oceanVertices[i + 7], oceanVertices[i + 8]];

    // Calculate face center
    const mid = [
      (a[0] + b[0] + c[0]) / 3,
      (a[1] + b[1] + c[1]) / 3,
      (a[2] + b[2] + c[2]) / 3
    ];

    // Process vertices
    [a, b, c].forEach((v, j) => {
      // Apply scatter
      const scatter = [
        scatterNoise.get(v),
        scatterNoise.get(v[1] + 100, v[2] - 100, v[0] + 100),
        scatterNoise.get(v[2] - 200, v[0] + 200, v[1] - 200)
      ];

      v[0] += scatter[0];
      v[1] += scatter[1];
      v[2] += scatter[2];

      // Normalize and scale
      const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      const height = biome.getHeight(v);
      v[0] = (v[0] / length) * (height + 1);
      v[1] = (v[1] / length) * (height + 1);
      v[2] = (v[2] / length) * (height + 1);

      // Update vertices
      vertices[i + j * 3] = v[0];
      vertices[i + j * 3 + 1] = v[1];
      vertices[i + j * 3 + 2] = v[2];

      // Handle ocean vertices
      const oceanV = j === 0 ? oceanA : j === 1 ? oceanB : oceanC;
      oceanV[0] += scatter[0];
      oceanV[1] += scatter[1];
      oceanV[2] += scatter[2];

      const oceanLength = Math.sqrt(oceanV[0] * oceanV[0] + oceanV[1] * oceanV[1] + oceanV[2] * oceanV[2]);
      const seaHeight = biome.getSeaHeight(v);
      oceanV[0] = (oceanV[0] / oceanLength) * (seaHeight + 1);
      oceanV[1] = (oceanV[1] / oceanLength) * (seaHeight + 1);
      oceanV[2] = (oceanV[2] / oceanLength) * (seaHeight + 1);

      oceanVertices[i + j * 3] = oceanV[0];
      oceanVertices[i + j * 3 + 1] = oceanV[1];
      oceanVertices[i + j * 3 + 2] = oceanV[2];
      oceanMorphPositions.push(oceanV[0], oceanV[1], oceanV[2]);
    });

    // Calculate normals
    const normal = calculateNormal(a, b, c);
    [i, i + 3, i + 6].forEach((idx, j) => {
      normals[idx] = normal[0];
      normals[idx + 1] = normal[1];
      normals[idx + 2] = normal[2];
    });

    const oceanNormal = calculateNormal(oceanA, oceanB, oceanC);
    [i, i + 3, i + 6].forEach((idx, j) => {
      oceanNormals[idx] = oceanNormal[0];
      oceanNormals[idx + 1] = oceanNormal[1];
      oceanNormals[idx + 2] = oceanNormal[2];
      oceanMorphNormals.push(oceanNormal[0], oceanNormal[1], oceanNormal[2]);
    });

    // Set colors
    const normalizedHeight = (biome.getHeight(a) + biome.getHeight(b) + biome.getHeight(c)) / 3;
    const steepness = Math.acos(Math.abs(dot(normal, mid)));

    const color = biome.getColor(mid, normalizedHeight, steepness);
    if (color) {
      [i, i + 3, i + 6].forEach(idx => {
        colors[idx] = Math.min(1, color.r * 1.2);
        colors[idx + 1] = Math.min(1, color.g * 1.2);
        colors[idx + 2] = Math.min(1, color.b * 1.2);
      });
    }

    const oceanColor = biome.getSeaColor(mid, normalizedHeight);
    if (oceanColor) {
      [i, i + 3, i + 6].forEach(idx => {
        oceanColors[idx] = Math.min(1, oceanColor.r * 1.2);
        oceanColors[idx + 1] = Math.min(1, oceanColor.g * 1.2);
        oceanColors[idx + 2] = Math.min(1, oceanColor.b * 1.2);
      });
    }

    // Place vegetation
    if (biome.options.vegetation) {
      biome.options.vegetation.items.forEach(vegetation => {
        if (Math.random() < faceSize * (vegetation.density ?? 1)) {
          if (vegetation.minimumHeight !== undefined && normalizedHeight < vegetation.minimumHeight) return;
          if (vegetation.maximumHeight !== undefined && normalizedHeight > vegetation.maximumHeight) return;
          if (vegetation.minimumSlope !== undefined && steepness < vegetation.minimumSlope) return;
          if (vegetation.maximumSlope !== undefined && steepness > vegetation.maximumSlope) return;

          if (!placedVegetation[vegetation.name]) {
            placedVegetation[vegetation.name] = [];
          }

          const position = [...a];
          const length = Math.sqrt(position[0] * position[0] + position[1] * position[1] + position[2] * position[2]);
          position[0] /= length;
          position[1] /= length;
          position[2] /= length;

          placedVegetation[vegetation.name].push(position);
        }
      });
    }
  }

  return [
    { positions: vertices, colors, normals },
    { 
      positions: oceanVertices, 
      colors: oceanColors, 
      normals: oceanNormals,
      morphPositions: oceanMorphPositions,
      morphNormals: oceanMorphNormals
    },
    placedVegetation
  ];
}

// Helper functions
function copyVector(target, source, offset) {
  target[0] = source[offset];
  target[1] = source[offset + 1];
  target[2] = source[offset + 2];
}

function distance(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function calculateNormal(a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  
  const normal = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0]
  ];
  
  const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
  if (length > 0) {
    normal[0] /= length;
    normal[1] /= length;
    normal[2] /= length;
  }
  
  const center = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
  const dotProduct = normal[0] * center[0] + normal[1] * center[1] + normal[2] * center[2];
  if (dotProduct < 0) {
    normal[0] = -normal[0];
    normal[1] = -normal[1];
    normal[2] = -normal[2];
  }
  
  return normal;
}

function createIcosahedronGeometry(detail) {
  const positions = [];
  const phi = (1 + Math.sqrt(5)) / 2;
  const vertices = [
    [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
    [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1]
  ];
  
  const faces = [
    // Top pentagon
    [0, 8, 4], [0, 4, 5], [0, 5, 9], [0, 9, 1], [0, 1, 8],
    // Upper middle
    [1, 9, 7], [1, 7, 6], [1, 6, 8],
    // Lower middle
    [2, 3, 11], [2, 11, 5], [2, 5, 4], [2, 4, 10],
    [3, 2, 10], [3, 10, 6], [3, 6, 7], [3, 7, 11],
    // Bottom pentagon
    [4, 8, 10], [5, 11, 9], [6, 10, 8], [7, 9, 11]
  ];

  const midpoints = new Map();
  
  function getMidpoint(a, b) {
    const key = [a, b].sort().join(',');
    if (!midpoints.has(key)) {
      const va = vertices[a];
      const vb = vertices[b];
      const mid = normalize([
        (va[0] + vb[0]) / 2,
        (va[1] + vb[1]) / 2,
        (va[2] + vb[2]) / 2
      ]);
      vertices.push(mid);
      midpoints.set(key, vertices.length - 1);
    }
    return midpoints.get(key);
  }

  for (let i = 0; i < detail; i++) {
    const newFaces = [];
    for (const face of faces) {
      const a = face[0];
      const b = face[1];
      const c = face[2];
      
      const ab = getMidpoint(a, b);
      const bc = getMidpoint(b, c);
      const ca = getMidpoint(c, a);
      
      newFaces.push(
        [a, ab, ca],    // Top triangle
        [ab, b, bc],    // Right triangle
        [ca, bc, c],    // Bottom triangle
        [ab, bc, ca]    // Center triangle
      );
    }
    faces.length = 0;
    faces.push(...newFaces);
  }
  
  for (const face of faces) {
    for (const index of face) {
      const vertex = vertices[index];
      positions.push(vertex[0], vertex[1], vertex[2]);
    }
  }
  
  return { positions };
}

function normalize(v) {
  const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
} 