import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { dbHelpers } from './database.js';
import { logHelpers } from '../utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure Google OAuth strategy
const clientID = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

// Check if Google OAuth is properly configured
if (!clientID || !clientSecret || clientID === 'your-google-client-id' || clientSecret === 'your-google-client-secret') {
  console.warn('Google OAuth is not properly configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.');
  // Don't register the strategy if not configured
  // Export a minimal passport configuration
} else {

passport.use(new GoogleStrategy({
  clientID: clientID,
  clientSecret: clientSecret,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
  passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists
    let user = await dbHelpers.get(
      'SELECT user_id, name, email, google_id, is_guest FROM users WHERE google_id = ?',
      [profile.id]
    );

    if (user) {
      // Update last login
      await dbHelpers.run(
        'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [user.user_id]
      );
      
      logHelpers.logAuth('google_login_existing', user.user_id, true);
      return done(null, user);
    }

    // Check if user exists with same email
    user = await dbHelpers.get(
      'SELECT user_id, name, email, google_id, is_guest FROM users WHERE email = ?',
      [profile.emails[0].value]
    );

    if (user) {
      // Update with Google ID
      await dbHelpers.run(
        'UPDATE users SET google_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [profile.id, user.user_id]
      );
      
      logHelpers.logAuth('google_link_existing', user.user_id, true);
      return done(null, user);
    }

    // Create new user
    const result = await dbHelpers.run(
      'INSERT INTO users (name, email, google_id, is_guest) VALUES (?, ?, ?, FALSE)',
      [
        profile.displayName,
        profile.emails[0].value,
        profile.id
      ]
    );

    const newUser = {
      user_id: result.lastID,
      name: profile.displayName,
      email: profile.emails[0].value,
      google_id: profile.id,
      is_guest: false
    };

    // Create default settings for new user
    await dbHelpers.run(
      'INSERT INTO settings (user_id, theme, reminder_time, whatsapp_enabled, default_intervals) VALUES (?, ?, ?, ?, ?)',
      [result.lastID, 'light', '09:00:00', true, '[1,3,7,14]']
    );

    logHelpers.logAuth('google_register', newUser.user_id, true);
    done(null, newUser);
  } catch (error) {
    logHelpers.logAuth('google_strategy_error', null, false);
    done(error, null);
  }
}));
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.user_id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await dbHelpers.get(
      'SELECT user_id, name, email, google_id, is_guest FROM users WHERE user_id = ?',
      [id]
    );
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport; 