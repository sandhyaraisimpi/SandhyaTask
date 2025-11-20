# SumiTask Backend API

A comprehensive backend API for SumiTask - a modern task management and spaced repetition application designed for students and self-learners.

## 🚀 Features

- **Task Management**: Create, update, delete, and track tasks with priorities and categories
- **Spaced Repetition**: Intelligent revision scheduling with customizable intervals
- **PDF Generation**: Generate daily, weekly, and custom date reports
- **WhatsApp Integration**: Manage tasks via WhatsApp commands
- **File Upload**: Upload PDFs and blank page revisions
- **User Authentication**: Google OAuth integration
- **Settings Management**: User preferences and notification settings
- **Audit Logging**: Comprehensive activity tracking

## 🛠️ Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: SQLite (with PostgreSQL support)
- **Authentication**: Google OAuth 2.0 via Passport.js
- **File Upload**: Multer with Sharp for image processing
- **PDF Generation**: PDFKit
- **Validation**: Express-validator
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate limiting

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Google OAuth credentials (for authentication)
- Twilio account (for WhatsApp integration - optional)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sumitask/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # Database Configuration
   DB_PATH=./database/sumitask.db
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRES_IN=7d
   
   # Google OAuth Configuration
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback
   
   # Twilio Configuration (WhatsApp) - Optional
   TWILIO_ACCOUNT_SID=your-twilio-account-sid
   TWILIO_AUTH_TOKEN=your-twilio-auth-token
   TWILIO_PHONE_NUMBER=whatsapp:+14155238886
   
   # Frontend URL (CORS)
   FRONTEND_URL=http://localhost:5173
   ```

4. **Initialize the database**
   ```bash
   npm run migrate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## 🗄️ Database Schema

The application uses SQLite with the following main tables:

- **users**: User accounts and profiles
- **tasks**: Task management with priorities and categories
- **revisions**: Spaced repetition scheduling
- **pdfs**: Uploaded PDF documents
- **blank_pages**: Revision page uploads
- **settings**: User preferences
- **audit_logs**: Activity tracking
- **whatsapp_logs**: WhatsApp interaction logs

## 📡 API Endpoints

### Authentication
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/google/callback` - OAuth callback
- `POST /api/auth/logout` - Logout user

### Tasks
- `GET /api/tasks` - Get user tasks with filters
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `PATCH /api/tasks/:id/complete` - Mark task as complete

### Revisions
- `GET /api/revisions` - Get user revisions
- `GET /api/revisions/task/:taskId` - Get revisions for specific task
- `PATCH /api/revisions/:id/complete` - Mark revision as complete
- `PATCH /api/revisions/:id/reschedule` - Reschedule revision
- `GET /api/revisions/stats` - Get revision statistics

### PDF Generation
- `GET /api/pdf/today` - Generate today's PDF report
- `GET /api/pdf/date/:date` - Generate PDF for specific date
- `GET /api/pdf/weekly` - Generate weekly report

### WhatsApp Integration
- `POST /api/whatsapp/webhook` - WhatsApp webhook endpoint
- Supports commands: Add, Done, List, Report, Missed, Help

### Settings
- `GET /api/settings` - Get user settings
- `PATCH /api/settings` - Update settings
- `PATCH /api/settings/profile` - Update profile
- `GET /api/settings/themes` - Get available themes
- `GET /api/settings/interval-presets` - Get revision presets

### File Upload
- `POST /api/upload/pdf` - Upload PDF document
- `POST /api/upload/blank-page` - Upload blank page revision
- `GET /api/upload/pdfs` - Get user's PDFs
- `GET /api/upload/blank-pages` - Get user's blank pages
- `DELETE /api/upload/:fileType/:fileId` - Delete uploaded file

## 🔐 Authentication

The API uses Google OAuth 2.0 for authentication. Users can:

1. Sign in with their Google account
2. Receive a JWT token for API access
3. Use the token in the `Authorization` header: `Bearer <token>`

## 📱 WhatsApp Integration

Users can manage tasks via WhatsApp using natural language commands:

- **Add tasks**: `Add: Submit essay by 5pm`
- **Mark complete**: `Done: Submit essay`
- **List tasks**: `List` (today), `List tomorrow`, `List 2024-01-15`
- **Get reports**: `Report` (daily summary)
- **View missed**: `Missed` (overdue tasks)
- **Get help**: `Help`

## 📊 PDF Reports

The API generates comprehensive PDF reports including:

- Daily task summaries
- Weekly progress reports
- Custom date ranges
- Task completion statistics
- Revision progress tracking
- Motivational quotes

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Environment Variables for Production
- Set `NODE_ENV=production`
- Use a strong `JWT_SECRET`
- Configure proper CORS origins
- Set up SSL/TLS certificates
- Use a production database (PostgreSQL recommended)

## 📝 Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run migrate` - Initialize database schema
- `npm run seed` - Seed database with sample data
- `npm test` - Run tests
- `npm run lint` - Run ESLint

## 🔧 Configuration

### Database
- Default: SQLite (file-based)
- Production: PostgreSQL (recommended)
- Connection string via `DB_PATH` environment variable

### File Upload
- Local storage with configurable path
- Cloudinary integration for cloud storage
- Image optimization with Sharp
- File size limits and type validation

### Security
- Helmet for security headers
- CORS configuration
- Rate limiting
- Input validation
- SQL injection prevention

## 🐛 Troubleshooting

### Common Issues

1. **Database connection errors**
   - Ensure database directory exists
   - Check file permissions
   - Verify `DB_PATH` environment variable

2. **Google OAuth errors**
   - Verify Google OAuth credentials
   - Check callback URL configuration
   - Ensure HTTPS in production

3. **File upload issues**
   - Check upload directory permissions
   - Verify file size limits
   - Ensure proper file types

4. **WhatsApp integration**
   - Verify Twilio credentials
   - Check webhook URL configuration
   - Ensure proper message format

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API endpoints

---

**SumiTask Backend** - Plan, revise, and achieve — the Suman way. 