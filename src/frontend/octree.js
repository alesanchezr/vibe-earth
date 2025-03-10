import {
  Vector3,
  Box3,
  Material,
  Object3D,
  Mesh,
  BoxGeometry,
  MeshStandardMaterial,
  BufferGeometry,
  BufferAttribute,
  Points,
  PointsMaterial,
} from "three";

/**
 * Octree options
 * @typedef {Object} OctreeOptions
 * @property {Box3} [bounds] - Boundary box
 * @property {number} [size] - Size of the octree
 * @property {Vector3} [min] - Minimum boundary point
 * @property {Vector3} [max] - Maximum boundary point
 * @property {Vector3[]} [points] - Initial points to add
 * @property {number} [capacity] - Maximum capacity before subdivision
 */

/**
 * Octree for efficient 3D space management
 */
export class Octree {
  /**
   * Create a new Octree
   * @param {OctreeOptions} opts - Octree options
   */
  constructor(opts = {}) {
    this.points = [];

    if (opts.bounds) {
      this.boundary = opts.bounds.clone();
    } else if (opts.size) {
      const s = opts.size;
      this.boundary = new Box3(new Vector3(-s, -s, -s), new Vector3(s, s, s));
    } else if (opts.min || opts.max) {
      const min = opts.min || new Vector3(-1, -1, -1);
      const max = opts.max || new Vector3(1, 1, 1);
      this.boundary = new Box3(min, max);
    } else if (opts.points && opts.points.length > 0) {
      const min = opts.points[0].clone();
      const max = opts.points[0].clone();
      for (const p of opts.points) {
        min.x = Math.min(min.x, p.x);
        min.y = Math.min(min.y, p.y);
        min.z = Math.min(min.z, p.z);

        max.x = Math.max(max.x, p.x);
        max.y = Math.max(max.y, p.y);
        max.z = Math.max(max.z, p.z);
      }
      this.boundary = new Box3(min, max);
    } else {
      this.boundary = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
    }

    this.capacity = opts.capacity || 4;
    this.subdivisions = undefined;

    if (opts.points) {
      for (const p of opts.points) {
        this.insertXYZ(p.x, p.y, p.z);
      }
    }
  }

  /**
   * Subdivide the octree into 8 smaller octrees
   */
  subdivide() {
    // if already subdivided exit silently
    if (this.subdivisions !== undefined) return;

    // divide each dimension => 2 * 2 * 2 = 8 subdivisions
    const size = new Vector3();
    const subdivisions = [];
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          const min = this.boundary.min.clone();
          const max = this.boundary.max.clone();
          this.boundary.getSize(size);
          size.divideScalar(2);

          min.x += x * size.x;
          min.y += y * size.y;
          min.z += z * size.z;
          max.x -= (1 - x) * size.x;
          max.y -= (1 - y) * size.y;
          max.z -= (1 - z) * size.z;

          subdivisions.push(
            new Octree({
              min: min,
              max: max,
              capacity: this.capacity,
            }),
          );
        }
      }
    }
    this.subdivisions = subdivisions;
  }

  /**
   * Query points within a distance of a position
   * @param {Vector3} pos - Position to query around
   * @param {number} dist - Distance to query
   * @returns {Vector3[]} - Points within the distance
   */
  query(pos, dist = 1) {
    const points = this.queryBoxXYZ(pos.x, pos.y, pos.z, dist);
    return points.filter((p) => p.distanceTo(pos) < dist);
  }

  /**
   * Query points within a distance of a position (x,y,z)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} z - Z coordinate
   * @param {number} dist - Distance to query
   * @returns {Vector3[]} - Points within the distance
   */
  queryXYZ(x, y, z, dist) {
    const point = new Vector3(x, y, z);
    return this.query(point, dist);
  }

  /**
   * Query points within a box around a position (x,y,z)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} z - Z coordinate
   * @param {number} s - Size of the box
   * @returns {Vector3[]} - Points within the box
   */
  queryBoxXYZ(x, y, z, s) {
    const min = new Vector3(x - s, y - s, z - s);
    const max = new Vector3(x + s, y + s, z + s);
    const box = new Box3(min, max);
    return this.queryBox(box);
  }

  /**
   * Query points within a box
   * @param {Box3} box - Box to query
   * @param {Vector3[]} found - Array to store found points
   * @returns {Vector3[]} - Points within the box
   */
  queryBox(box, found = []) {
    if (!box.intersectsBox(this.boundary)) return found;

    for (const p of this.points) {
      if (box.containsPoint(p)) found.push(p);
    }
    
    if (this.subdivisions) {
      for (const sub of this.subdivisions) {
        sub.queryBox(box, found);
      }
    }
    
    return found;
  }

  /**
   * Check if no points are closer than dist to point
   * @param {Vector3} pos - Position to check
   * @param {number} dist - Distance to check
   * @returns {boolean} - True if no points are closer than dist
   */
  minDist(pos, dist) {
    return this.query(pos, dist).length < 1;
  }

  /**
   * Insert a point with optional data
   * @param {Vector3} pos - Position to insert
   * @param {any} data - Optional data to attach to the point
   * @returns {boolean} - True if the point was inserted
   */
  insert(pos, data = undefined) {
    return this.insertPoint(pos, data);
  }

  /**
   * Insert a point at (x,y,z) with optional data
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} z - Z coordinate
   * @param {any} data - Optional data to attach to the point
   * @returns {boolean} - True if the point was inserted
   */
  insertXYZ(x, y, z, data = undefined) {
    return this.insertPoint(new Vector3(x, y, z), data);
  }

  /**
   * Insert a point with optional data
   * @param {Vector3} p - Position to insert
   * @param {any} data - Optional data to attach to the point
   * @returns {boolean} - True if the point was inserted
   */
  insertPoint(p, data = undefined) {
    p = p.clone();

    if (data) p.data = data;

    if (!this.boundary.containsPoint(p)) return false;

    if (this.points.length < this.capacity) {
      this.points.push(p);
      return true;
    } else {
      this.subdivide();
      let added = false;
      for (const sub of this.subdivisions || []) {
        if (sub.insertPoint(p, data)) added = true;
      }
      return added;
    }
  }

  /**
   * Get all points in the octree
   * @returns {Vector3[]} - All points in the octree
   */
  all() {
    const points = [...this.points];
    
    if (this.subdivisions) {
      for (const sub of this.subdivisions) {
        points.push(...sub.all());
      }
    }
    
    return points;
  }

  /**
   * Visualize the octree boxes
   * @param {Material} mat - Material to use for the boxes
   * @param {Object3D} parent - Parent object to add the boxes to
   * @returns {Object3D} - Parent object with boxes added
   */
  showBoxes(mat, parent = undefined) {
    const size = new Vector3();
    this.boundary.getSize(size);

    const box = new BoxGeometry(size.x * 2, size.y * 2, size.z * 2);
    const mesh = new Mesh(
      box,
      mat || new MeshStandardMaterial({ wireframe: true })
    );
    
    this.boundary.getCenter(mesh.position);

    parent = parent || new Object3D();
    parent.add(mesh);

    if (this.subdivisions) {
      for (const sub of this.subdivisions) sub.showBoxes(mat, parent);
    }
    
    return parent;
  }

  /**
   * Visualize the octree points
   * @param {Object} opts - Visualization options
   * @returns {Points} - Points object
   */
  show(opts = {}) {
    const pointsOnly = opts.pointsOnly;
    let mat = opts.mat;
    const points = this.all();

    const pointsGeo = new BufferGeometry();
    const positionData = new Float32Array(points.length * 3);
    const colorData = new Float32Array(points.length * 3);

    if (opts.p && opts.min) {
      for (const point of points) {
        point.close = false;
      }
      const q = this.query(opts.p, opts.min);

      for (const point of q) {
        point.close = true;
      }
    }

    for (let i = 0; i < points.length; i++) {
      positionData[i * 3] = points[i].x;
      positionData[i * 3 + 1] = points[i].y;
      positionData[i * 3 + 2] = points[i].z;

      colorData[i * 3] = points[i].close ? 1 : 0.7;
      colorData[i * 3 + 1] = points[i].close ? 0 : 0.7;
      colorData[i * 3 + 2] = points[i].close ? 0 : 0.7;
    }

    pointsGeo.setAttribute('position', new BufferAttribute(positionData, 3));
    pointsGeo.setAttribute('color', new BufferAttribute(colorData, 3));

    const pointsMat = mat || new PointsMaterial({
      size: opts.size || 0.05,
      sizeAttenuation: opts.sizeAttenuation !== false,
      vertexColors: true
    });

    return new Points(pointsGeo, pointsMat);
  }
} 