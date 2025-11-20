# Setting Up Backend on Your Laptop

This guide will help you set up and run the SumiTask backend server on your local machine.

## Prerequisites

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** (optional, if cloning from repository)

## Quick Start

### 1. Install Dependencies

Open a terminal in the `backend` directory and run:

```bash
cd backend
npm install
```

This will install all required dependencies.

### 2. Set Up Environment Variables

A `.env` file has been created for you with default local development settings. The backend will work with these defaults for basic functionality.

**Important:** Some features require additional configuration:
- **Google OAuth** (optional): For Google login - requires Google Cloud credentials
- **Twilio** (optional): For WhatsApp integration - requires Twilio account
- **Cloudinary** (optional): For cloud file storage - files will be stored locally if not set
- **Email** (optional): For email notifications - not required for basic functionality

### 3. Initialize Database

Run the database migration to create the necessary tables:

```bash
npm run migrate
```

This will create the SQLite database file at `./database/sumitask.db`.

### 4. Start the Backend Server

#### Development Mode (with auto-reload):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

The server will start on **http://localhost:5000**

You should see output like:
```
Server is running on port 5000
Database initialized successfully
```

## Verifying the Setup

### Check if Server is Running

Open your browser or use curl:

```bash
curl http://localhost:5000/health
```

You should get a response like:
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.45
}
```

### Test API Endpoint

```bash
curl http://localhost:5000/api/auth/check
```

## Configuration

### Default Settings

The backend is configured with these defaults for local development:

- **Port**: 5000
- **Database**: SQLite (file-based, no setup required)
- **CORS**: Enabled for localhost:3000 (frontend)
- **Rate Limiting**: Lenient (1000 requests per 15 minutes)
- **File Uploads**: Stored locally in `./uploads` directory

### Changing the Port

Edit the `.env` file and change:
```env
PORT=5000
```

### Frontend Connection

The backend is configured to accept requests from:
- `http://localhost:3000` (default Vite dev server)
- `http://localhost:5173` (Vite default port)

If your frontend runs on a different port, update the CORS configuration in `server.js` or add it to the `FRONTEND_URL` in `.env`.

## Database

### SQLite Database

The backend uses SQLite by default, which is perfect for local development:

- **Location**: `./database/sumitask.db`
- **No installation required**: SQLite is included with Node.js
- **Auto-created**: The database is created automatically when you run migrations

### Viewing the Database

You can use SQLite browser tools to view the database:
- **DB Browser for SQLite**: [Download here](https://sqlitebrowser.org/)
- **VS Code Extension**: SQLite Viewer
- **Command Line**: `sqlite3 database/sumitask.db`

## Features Available Without Configuration

These features work immediately without any additional setup:

✅ **Task Management**: Create, read, update, delete tasks
✅ **User Authentication**: Guest user creation (no Google OAuth needed)
✅ **Database**: SQLite database (no setup required)
✅ **File Uploads**: Local file storage
✅ **API Endpoints**: All core API endpoints
✅ **Revision System**: Spaced repetition scheduling
✅ **PDF Generation**: Generate PDF reports

## Optional Features (Require Configuration)

### Google OAuth (Optional)

To enable Google login:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add to `.env`:
   ```env
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

### WhatsApp Integration (Optional)

To enable WhatsApp features:

1. Sign up for [Twilio](https://www.twilio.com/)
2. Get your Account SID and Auth Token
3. Set up a WhatsApp sandbox
4. Add to `.env`:
   ```env
   TWILIO_ACCOUNT_SID=your-account-sid
   TWILIO_AUTH_TOKEN=your-auth-token
   TWILIO_PHONE_NUMBER=whatsapp:+14155238886
   ```

### Cloudinary (Optional)

For cloud file storage:

1. Sign up for [Cloudinary](https://cloudinary.com/)
2. Get your credentials
3. Add to `.env`:
   ```env
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

## Running with Frontend

### Option 1: Run Backend Separately

1. **Terminal 1** - Backend:
   ```bash
   cd backend
   npm run dev
   ```

2. **Terminal 2** - Frontend:
   ```bash
   cd frontend
   npm run dev
   ```

### Option 2: Run with Electron Desktop App

1. Start the backend:
   ```bash
   cd backend
   npm run dev
   ```

2. Start the Electron app:
   ```bash
   cd frontend
   npm run electron:dev
   ```

The Electron app will automatically start the backend server in development mode.

## Troubleshooting

### Port Already in Use

If port 5000 is already in use:

1. Find the process using the port:
   ```bash
   # Windows
   netstat -ano | findstr :5000
   
   # Mac/Linux
   lsof -i :5000
   ```

2. Kill the process or change the port in `.env`

### Database Errors

If you get database errors:

1. Delete the database file:
   ```bash
   rm database/sumitask.db
   ```

2. Run migrations again:
   ```bash
   npm run migrate
   ```

### CORS Errors

If you see CORS errors:

1. Check that `FRONTEND_URL` in `.env` matches your frontend URL
2. Verify the frontend is running on the correct port
3. Check `server.js` CORS configuration

### Module Not Found Errors

If you get module errors:

1. Delete `node_modules`:
   ```bash
   rm -rf node_modules
   ```

2. Reinstall dependencies:
   ```bash
   npm install
   ```

## Next Steps

1. ✅ Backend is running on http://localhost:5000
2. ✅ Start the frontend to connect to the backend
3. ✅ Test the application
4. ✅ Configure optional features as needed

## API Documentation

Once the server is running, you can test the API endpoints:

- **Health Check**: `GET http://localhost:5000/health`
- **Check Auth**: `GET http://localhost:5000/api/auth/check`
- **Create Guest User**: `POST http://localhost:5000/api/auth/guest`

For more API documentation, see the `README.md` file.

## Support

If you encounter any issues:

1. Check the logs in `./logs/` directory
2. Verify all dependencies are installed
3. Ensure Node.js version is 18 or higher
4. Check that port 5000 is available
5. Verify database permissions

---

**Backend is now ready to use!** 🎉

Start the server with `npm run dev` and your frontend can connect to `http://localhost:5000`.


