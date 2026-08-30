const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const indianCities = require('../utils/indianCities');
const { verifyToken } = require('../middleware/auth.middleware');
const { hashAadhaar, withoutAadhaar } = require('../utils/aadhaar');
const {
  sendForgotPasswordOTP,
  sendWelcomeEmail,
  sendPasswordResetSuccessEmail
} = require('../utils/mailer');

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, rememberMe, city, state, aadhaarNumber, aadhaar, aadhaarHash: ignoredAadhaarHash, ...rest } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    
    // Check if user already exists (case-insensitive)
    const existing = await User.findOne({
      email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i')
    });
    
    if (existing) {
      return res.status(409).json({ error: 'This email is already registered. Please sign in.' });
    }

    // Password strength check (optional safety)
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Lookup city coordinates if city is provided
    let location = undefined;
    if (city) {
      const match = indianCities.find(c => c.city.toLowerCase() === String(city).trim().toLowerCase());
      if (match) {
        location = { type: 'Point', coordinates: [match.lng, match.lat] };
      }
    }

    const OfficialAchievement = require('../models/OfficialAchievement');

    const aadhaarHash = aadhaarNumber || aadhaar ? hashAadhaar(aadhaarNumber || aadhaar) : null;
    if ((aadhaarNumber || aadhaar) && !aadhaarHash) {
      return res.status(400).json({ error: 'Aadhaar number must contain exactly 12 digits.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userPayload = {
      name: String(name).trim(),
      email: cleanEmail,
      passwordHash,
      role,
      city,
      state,
      aadhaarHash,
      ...rest
    };
    if (location) userPayload.location = location;

    const user = await User.create(userPayload);
    const athleteIdStr = `ATH-${user._id.toString().slice(-8).toUpperCase()}`;
    user.athleteId = athleteIdStr;
    await user.save();

    // Auto-link historical official results by Aadhaar hash only.
    if (role === 'athlete') {
      const matchCriteria = [];
      if (user.aadhaarHash) matchCriteria.push({ aadhaarHash: user.aadhaarHash });
      if (matchCriteria.length > 0) {
        await OfficialAchievement.updateMany(
          { athleteUserId: null, $or: matchCriteria },
          { $set: { athleteUserId: user._id, athleteId: athleteIdStr } }
        ).catch(e => console.error('Historical achievement auto-link error:', e));
      }
    }
    
    const expiresIn = rememberMe ? '30d' : '7d';
    const jwtSecret = process.env.JWT_SECRET || 'trackathlete_sih_secret_2026';
    const token = jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn });
    
    const userObj = withoutAadhaar(user);
    delete userObj.passwordHash;
    delete userObj.resetPasswordOTP;

    // Send Welcome Email asynchronously via Brevo
    sendWelcomeEmail({ toEmail: cleanEmail, name: user.name, role: user.role }).catch(err => {
      console.error('[Welcome Email Error]', err.message);
    });

    res.status(201).json({ token, user: userObj });
  } catch (err) {
    console.error('Signup Error:', err);
    res.status(500).json({ error: 'Signup failed. ' + (err.message || '') });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, role, rememberMe } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({
      email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i')
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    
    if (role && user.role !== role && user.role !== 'admin') {
      return res.status(403).json({
        error: `This account is registered as ${user.role.toUpperCase()}. Please select the ${user.role.toUpperCase()} tab to sign in.`
      });
    }
    
    const expiresIn = rememberMe ? '30d' : '7d';
    const jwtSecret = process.env.JWT_SECRET || 'trackathlete_sih_secret_2026';
    const token = jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn });
    
    const userObj = user.toObject();
    delete userObj.passwordHash;
    delete userObj.resetPasswordOTP;

    res.json({ token, user: userObj });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({
      email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i')
    });

    if (!user) {
      // Security best practice: respond with positive message without revealing user non-existence
      return res.json({ message: 'If an account exists for that email, a password reset code has been sent.' });
    }

    // Generate secure 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const resetToken = crypto.randomBytes(32).toString('hex');
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.resetPasswordOTP = otp;
    user.resetPasswordOTPExpires = otpExpiry;
    user.resetPasswordToken = resetToken;
    user.resetPasswordTokenExpires = otpExpiry;
    await user.save();

    // Send Brevo email with OTP
    await sendForgotPasswordOTP({ toEmail: cleanEmail, name: user.name, otp });

    res.json({
      message: 'Password reset OTP code sent successfully to your email.',
      email: cleanEmail
    });
  } catch (err) {
    console.error('Forgot Password Error:', err);
    res.status(500).json({ error: 'Failed to process forgot password request. ' + (err.message || '') });
  }
});

// POST /api/auth/verify-reset-otp
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and 6-digit OTP are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanOTP = String(otp).trim();

    const user = await User.findOne({
      email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i'),
      resetPasswordOTP: cleanOTP,
      resetPasswordOTPExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired OTP code. Please request a new code.' });
    }

    res.json({
      valid: true,
      resetToken: user.resetPasswordToken,
      message: 'OTP verified successfully. You may now reset your password.'
    });
  } catch (err) {
    console.error('Verify OTP Error:', err);
    res.status(500).json({ error: 'Failed to verify OTP code.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, resetToken, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    let query = { resetPasswordOTPExpires: { $gt: new Date() } };

    if (resetToken) {
      query.resetPasswordToken = String(resetToken).trim();
    } else if (cleanEmail && otp) {
      query.email = new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');
      query.resetPasswordOTP = String(otp).trim();
    } else {
      return res.status(400).json({ error: 'Verification code or reset token is required.' });
    }

    const user = await User.findOne(query);

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired password reset link/code.' });
    }

    // Hash new password
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpires = undefined;
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpires = undefined;
    await user.save();

    // Send confirmation email asynchronously via Brevo
    sendPasswordResetSuccessEmail({ toEmail: user.email, name: user.name }).catch(err => {
      console.error('[Password Changed Email Error]', err.message);
    });

    res.json({ message: 'Password has been reset successfully. You can now sign in with your new password.' });
  } catch (err) {
    console.error('Reset Password Error:', err);
    res.status(500).json({ error: 'Failed to reset password. ' + (err.message || '') });
  }
});

// GET /api/auth/me - Protected session check
router.get('/me', verifyToken, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
