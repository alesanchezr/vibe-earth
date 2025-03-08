# Geek World

A 3D visualization of geeks coming online on a spherical planet.

## Project Structure

This project has a monorepo-like structure with:

- **Frontend**: Built with Vite and Three.js, located in `src/frontend`
- **Backend**: Node.js server with WebSocket support, located in `src/backend`

## Setup

1. Install dependencies for both frontend and backend:

```bash
npm run setup
```

2. Set up your database (PostgreSQL):
   - Create a database for the project
   - Create a `.env` file in the `src/backend` directory with your database connection string:

```
DATABASE_URL=postgres://username:password@localhost:5432/geekworld
PORT=3000
```

3. Run database migrations:

```bash
npm run migrate:up
```

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