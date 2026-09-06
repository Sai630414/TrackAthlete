const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to verify JWT token in Authorization header
 */
async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No authentication token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET || 'trackathlete_sih_secret_2026';
    const decoded = jwt.verify(token, jwtSecret);

    if (decoded.role === 'federation') {
      const Federation = require('../models/Federation');
      const fed = await Federation.findById(decoded.id).select('-passwordHash -loginOTPHash -activationOTPHash');
      if (!fed) {
        return res.status(401).json({ error: 'Invalid authentication session. Federation record no longer exists.' });
      }
      req.user = {
        _id: fed._id,
        id: fed._id,
        role: 'federation',
        federationId: fed.federationId,
        name: fed.name,
        sport: fed.sport,
        officialEmail: fed.officialEmail
      };
      return next();
    }
    if (decoded.role === 'organizer') {
      const Organizer = require('../models/Organizer');
      const organizer = await Organizer.findById(decoded.id);
      if (!organizer || organizer.accountStatus !== 'active') return res.status(401).json({ error: 'Invalid organizer session.' });
      req.user = { _id: organizer._id, id: organizer._id, role: 'organizer', organizerId: organizer.organizerId, name: organizer.name, email: organizer.email };
      return next();
    }

    const user = await User.findById(decoded.id).select('-passwordHash -resetPasswordOTP');
    if (!user) {
      return res.status(401).json({ error: 'Invalid authentication session. User no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
}

/**
 * Role-based authorization middleware generator
 */
function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (req.user.role === 'admin') {
      return next(); // Admin has override access
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Role '${req.user.role}' is not authorized for this resource.` });
    }
    next();
  };
}

module.exports = {
  verifyToken,
  requireRoles
};
