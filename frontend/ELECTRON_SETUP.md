# SumiTask Desktop App Setup

This guide explains how to run and build the SumiTask desktop application using Electron.

## Prerequisites

- Node.js (>= 18.0.0)
- npm or yarn
- Backend server dependencies installed (run `npm install` in the `backend` directory)

## Development

### Running the Desktop App in Development Mode

1. **Install dependencies** (if not already installed):
   ```bash
   cd frontend
   npm install
   ```

2. **Start the desktop app**:
   ```bash
   npm run electron:dev
   ```

   This command will:
   - Start the Vite dev server on port 3000
   - Start the backend server on port 5000
   - Launch the Electron window
   - Open DevTools automatically

### Manual Development Setup

If you prefer to run the servers separately:

1. **Terminal 1 - Start backend server**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Terminal 2 - Start frontend dev server**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Terminal 3 - Start Electron**:
   ```bash
   cd frontend
   npm run electron
   ```

## Building for Production

### Build the Desktop App

1. **Build the app** (creates distributable packages):
   ```bash
   cd frontend
   npm run electron:build
   ```

   This will:
   - Build the React frontend
   - Package the Electron app
   - Create installers in the `release` directory

### Build Options

- **Create unpacked directory** (for testing):
  ```bash
  npm run electron:pack
  ```

- **Create distributable without publishing**:
  ```bash
  npm run electron:dist
  ```

## Platform-Specific Builds

### Windows
- Creates NSIS installer and portable executable
- Output: `release/SumiTask Setup X.X.X.exe` and `release/SumiTask X.X.X.exe`

### macOS
- Creates DMG and ZIP files
- Output: `release/SumiTask-X.X.X.dmg` and `release/SumiTask-X.X.X-mac.zip`

### Linux
- Creates AppImage, DEB, and RPM packages
- Output: Various formats in `release/` directory

## Production Considerations

### Backend Server

**Important:** Currently, the desktop app in production mode requires the backend server to be running separately. The app connects to `http://localhost:5000` for the API.

**Options for production:**

1. **Run backend separately** (current setup):
   - Install and run the backend server as a service or background process
   - Users need to start the backend server before using the desktop app
   - Backend should be running on `http://localhost:5000`

2. **Bundle backend with Electron** (future enhancement):
   - Modify `electron/main.cjs` to start the backend server automatically in production
   - Include backend code and dependencies in the Electron package
   - This creates a truly standalone desktop app
   - Requires additional configuration and increases app size

### Environment Variables

Create a `.env` file in the `backend` directory with necessary environment variables (see `backend/env.example`).

## Troubleshooting

### Backend Server Not Starting

- Ensure Node.js is installed and in your PATH
- Check that the backend directory exists at `../backend` relative to the frontend
- Verify backend dependencies are installed: `cd backend && npm install`

### Port Already in Use

- Change the ports in `electron/main.cjs` if 3000 or 5000 are already in use
- Update `frontend/src/services/api.ts` if you change the backend port

### Build Fails

- Ensure all dependencies are installed
- Check that the build directory (`dist`) is created after running `npm run build:electron`
- Verify Node.js version is >= 18.0.0

### App Window is Blank

- Check the console for errors (DevTools should open in development)
- Verify the Vite dev server is running on port 3000
- Check that the backend server is running on port 5000

## File Structure

```
frontend/
├── electron/
│   ├── main.cjs          # Electron main process
│   └── preload.cjs       # Preload script (security)
├── dist/                 # Built frontend files (generated)
├── release/              # Built desktop app packages (generated)
└── package.json          # Electron configuration
```

## Security

The Electron app uses:
- **Context Isolation**: Enabled for security
- **Node Integration**: Disabled in renderer process
- **Preload Script**: Exposes safe APIs to renderer
- **Web Security**: Enabled to prevent XSS attacks

## Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Builder Documentation](https://www.electron.build/)
- [Vite Documentation](https://vitejs.dev/)

