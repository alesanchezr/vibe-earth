import { Color } from 'three';

const noColor = new Color(0xff00cc);

/**
 * @typedef {Object} ColorGradientStop
 * @property {number} position - Position in the gradient (0-1)
 * @property {Color|ColorGradient} value - Color or nested gradient
 * @property {Function} [mod] - Optional modifier function
 */

/**
 * @typedef {Object} ColorGradientOptions
 * @property {Array<[number, number|Color|ColorGradient|ColorGradientOptions, Function?]>} [stops] - Array of gradient stops
 * @property {Array<number|Color|ColorGradient|ColorGradientOptions>} [between] - Colors to interpolate between
 * @property {number} [min] - Minimum value for between interpolation
 * @property {number} [max] - Maximum value for between interpolation
 * @property {boolean} [hsl] - Whether to use HSL interpolation
 * @property {Function} [mod] - Default modifier function
 */

export class ColorGradient {
    /**
     * Create a new color gradient
     * @param {ColorGradientOptions|Array<[number, number]>} opts Gradient options
     */
    constructor(opts = {}) {
        this.stops = [];
        this.hsl = false;
        this.isColorGradient = true;
        this.defaultMod = undefined;

        if (opts instanceof Array) {
            opts = { stops: opts };
        }

        this.hsl = opts.hsl ?? false;
        this.defaultMod = opts.mod;

        if (opts.between) {
            this.addBetween(opts.between, opts.min, opts.max);
        }
        if (opts.stops) {
            this.addStops(opts.stops);
        }
    }

    /**
     * Add multiple stops to the gradient
     * @param {Array<[number, number|Color|ColorGradient|ColorGradientOptions, Function?]>} arr Array of stops
     */
    addStops(arr) {
        for (const s of arr) {
            this.addStop(s);
        }
    }

    /**
     * Add evenly spaced stops between min and max
     * @param {Array<number|Color|ColorGradient|ColorGradientOptions>} arr Array of colors
     * @param {number} min Minimum value
     * @param {number} max Maximum value
     */
    addBetween(arr, min = -1, max = 1) {
        if (arr.length < 2) {
            console.warn('ColorGradient: addBetween requires at least 2 stops');
        }

        const step = (max - min) / (arr.length - 1);
        for (let i = 0; i < arr.length; i++) {
            this.addStop([i * step + min, arr[i]]);
        }
    }

    /**
     * Add a single stop to the gradient
     * @param {[number, number|Color|ColorGradient|ColorGradientOptions, Function?]|ColorGradientStop} stop Stop to add
     */
    addStop(stop) {
        let pos, mixObject, mod;

        if (stop instanceof Array) {
            pos = stop[0];
            mixObject = stop[1];
            if (stop.length > 2) mod = stop[2];
        } else {
            pos = stop.position;
            mixObject = stop.value;
            mod = stop.mod;
        }

        if (typeof mixObject === 'number') {
            mixObject = new Color(mixObject);
        } else if (!(mixObject instanceof Color) && !(mixObject instanceof ColorGradient)) {
            mixObject = new ColorGradient(mixObject);
        }

        let i = 0;
        while (i < this.stops.length && pos > this.stops[i].position) i++;

        this.stops.splice(i, 0, {
            position: pos,
            value: mixObject,
            mod: mod
        });
    }

    /**
     * Get color at a specific index
     * @param {number} i Index
     * @param {number} [y] Optional y coordinate
     * @param {number} [z] Optional z coordinate
     * @param {number} [w] Optional w coordinate
     * @returns {Color|undefined} Color at index
     */
    colorAtIndex(i, y, z, w) {
        if (i < 0 || i >= this.stops.length) return;

        let c = this.stops[i].value;
        if (c instanceof ColorGradient) {
            c = c.get(y, z, w);
        } else {
            c = c.clone();
        }
        return c;
    }

    /**
     * Get number of dimensions in the gradient
     * @returns {number} Number of dimensions
     */
    dimensions() {
        let maxD = 0;
        for (const s of this.stops) {
            if (s.value instanceof ColorGradient) {
                maxD = Math.max(s.value.dimensions(), maxD);
            }
        }
        return maxD + 1;
    }

    /**
     * Mix between two colors at specific indices
     * @param {number} i First index
     * @param {number} j Second index
     * @param {number} amt Amount to mix (0-1)
     * @param {number} [y] Optional y coordinate
     * @param {number} [z] Optional z coordinate
     * @param {number} [w] Optional w coordinate
     * @returns {Color|undefined} Mixed color
     */
    mix(i, j, amt, y, z, w) {
        if (i < 0 || i >= this.stops.length || j < 0 || j >= this.stops.length) return;

        amt = Math.min(Math.max(0, amt), 1);

        const firstColor = this.colorAtIndex(i, y, z, w);
        if (!firstColor) return;

        if (i === j) return firstColor;

        const stop = this.stops[j];
        if (stop.mod) {
            amt = stop.mod(amt);
        }
        if (this.defaultMod) {
            amt = this.defaultMod(amt);
        }

        const secondColor = this.colorAtIndex(j, y, z, w);
        if (!secondColor) return firstColor;

        if (this.hsl) {
            firstColor.lerpHSL(secondColor, amt);
        } else {
            firstColor.lerp(secondColor, amt);
        }

        return firstColor;
    }

    /**
     * Get color at a specific position
     * @param {number} x Position (0-1)
     * @param {number} [y] Optional y coordinate
     * @param {number} [z] Optional z coordinate
     * @param {number} [w] Optional w coordinate
     * @returns {Color} Color at position
     */
    get(x = 0, y, z, w) {
        if (this.stops.length < 1) return noColor;

        if (x <= this.stops[0].position || this.stops.length === 1) {
            return this.mix(0, 0, 0, y, z, w) ?? noColor;
        }

        for (let i = 0; i < this.stops.length - 1; i++) {
            const s1 = this.stops[i].position;
            const s2 = this.stops[i + 1].position;
            if (s1 <= x && x <= s2) {
                const amt = (x - s1) / (s2 - s1);
                return this.mix(i, i + 1, amt, y, z, w) ?? noColor;
            }
        }
        return this.mix(this.stops.length - 1, this.stops.length - 1, 0, y, z, w) ?? noColor;
    }

    /**
     * Create a gradient between colors
     * @param {Array<number|Color|ColorGradient|ColorGradientOptions>} arr Array of colors
     * @param {number} min Minimum value
     * @param {number} max Maximum value
     * @returns {ColorGradient} New gradient
     */
    static between(arr, min, max) {
        return new ColorGradient({
            between: arr,
            min: min,
            max: max
        });
    }
} 