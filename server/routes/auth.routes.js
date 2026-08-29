const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const indianCities = require('../utils/indianCities');

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, rememberMe, city, state, ...rest } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required.' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'This email is already registered.' });

    // Lookup city coordinates if city is provided
    let location = undefined;
    if (city) {
      const match = indianCities.find(c => c.city.toLowerCase() === String(city).trim().toLowerCase());
      if (match) {
        location = { type: 'Point', coordinates: [match.lng, match.lat] };
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userPayload = { name, email, passwordHash, role, city, state, ...rest };
    if (location) userPayload.location = location;

    const user = await User.create(userPayload);
    
    const expiresIn = rememberMe ? '30d' : '7d';
    const jwtSecret = process.env.JWT_SECRET || 'trackathlete_sih_secret_2026';
    const token = jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn });
    
    const userObj = user.toObject();
    delete userObj.passwordHash;

    res.status(201).json({ token, user: userObj });
  } catch (err) {
    res.status(500).json({ error: 'Signup failed', details: err.message });
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
    const user = await User.findOne({ email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i') });
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
    
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });
    
    if (role && user.role !== role && user.role !== 'admin') {
      return res.status(403).json({ error: `This account is registered as ${user.role}. Please select the ${user.role.toUpperCase()} tab to sign in.` });
    }
    
    const expiresIn = rememberMe ? '30d' : '7d';
    const jwtSecret = process.env.JWT_SECRET || 'trackathlete_sih_secret_2026';
    const token = jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn });
    
    const userObj = user.toObject();
    delete userObj.passwordHash;

    res.json({ token, user: userObj });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

module.exports = router;
