# 2D Online World Visualization

A simple visualization of people coming online using Three.js and Vite.

## Features

- People appear as colorful bubbles that pop into the scene
- New person joins every 20 seconds
- Click on "People Online" to manually add a person
- Pan around the canvas by dragging
- Zoom in/out with mouse wheel or pinch gesture
- Bubbles never overlap with each other
- Gentle floating animation for each bubble

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn

### Installation

1. Clone the repository or download the source code
2. Install dependencies:

```bash
npm install
# or
yarn
```

### Development

Run the development server:

```bash
npm run dev
# or
yarn dev
```

This will start a local development server, usually at http://localhost:5173

### Building for Production

Build the project for production:

```bash
npm run build
# or
yarn build
```

The built files will be in the `dist` directory.

### Preview Production Build

To preview the production build:

```bash
npm run preview
# or
yarn preview
```

## Controls

- **Pan**: Click and drag on the canvas
- **Zoom**: Use mouse wheel or pinch gesture (on touch devices)
- **Add Person**: Click on the "People Online" box in the top-left corner

## Project Structure

- `src/main.js` - Entry point
- `src/OnlineWorldApp.js` - Main application class
- `src/Person.js` - Person class for individual bubbles
- `src/style.css` - Styles for the application

## Technologies Used

- Three.js - 3D library
- Tween.js - Animation library
- Vite - Build tool and development server 