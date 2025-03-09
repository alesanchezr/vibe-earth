# Vibe Earth

A 3D visualization of users connecting to a shared virtual planet.

## Project Structure

This project has a monorepo-like structure with:

- **Frontend**: Built with Vite and Three.js, located in `src/frontend`
- **Backend**: Node.js server with WebSocket support, located in `src/backend`

## Setup

### 1. Install Dependencies

```bash
# Install backend dependencies
cd src/backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Set up Supabase

1. Create a free Supabase account at [supabase.com](https://supabase.com)
2. Create a new project
3. Once your project is created, go to Project Settings > API
4. Copy the "Project URL" and "anon/public" key
5. Create a `.env` file in the `src/frontend` directory with the following content:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Replace `your-project-url` and `your-anon-key` with the values from your Supabase project.

### 3. Set up the Database

1. Run the database migrations:

```bash
cd src/backend
npm run migrate
```

### 4. Start the Application

```bash
# Start the backend server
cd src/backend
node server.js

# In a separate terminal, start the frontend
cd src/frontend
npm run dev
```

## Features

- Anonymous authentication with Supabase
- Real-time user presence
- 3D visualization of users on a planet
- Day/night cycle
- First-person perspective (press Tab to toggle)
- Offline users shown in gray (toggle visibility with the button)

## Troubleshooting

If the planet is not showing:
- Check the browser console for errors
- Make sure Three.js and its dependencies are properly loaded
- Try clearing your browser cache and reloading

If the status indicator shows "Connecting...":
- Check if the backend server is running
- Check if the WebSocket connection is established
- Check the browser console for connection errors

## Running the Application

### Running Backend Only

```bash
npm run dev
```

This starts the backend server with nodemon for automatic reloading during development.

### Running Frontend Only

```bash
npm run frontend
```

This starts the Vite development server for the frontend. The frontend will connect to the backend at `localhost:3000`.

### Running Both Frontend and Backend

```bash
npm run dev:all
```

This uses concurrently to run both the frontend and backend development servers simultaneously.

## Building for Production

1. Build the frontend:

```bash
npm run frontend:build
```

2. Start the production server:

```bash
npm start
```

The production server will serve the built frontend files and handle API requests.

## Project Scripts

- `npm run setup`: Install dependencies for both frontend and backend
- `npm run dev`: Start the backend development server with nodemon
- `npm run frontend`: Start the frontend development server with Vite
- `npm run dev:all`: Start both frontend and backend development servers
- `npm run frontend:build`: Build the frontend for production
- `npm run frontend:preview`: Preview the production build locally
- `npm start`: Start the production server
- `npm run migrate`: Run database migrations
- `npm run migrate:up`: Run pending migrations
- `npm run migrate:down`: Revert the last migration 