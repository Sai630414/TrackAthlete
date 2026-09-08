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
    const { name, email, password, role, rememberMe, city, state, address, aadhaarNumber, aadhaar, aadhaarHash: ignoredAadhaarHash, ...rest } = req.body;
    if (rest.sport) rest.sport = String(rest.sport).trim();
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
    if (role === 'athlete' && !aadhaarHash) {
      return res.status(400).json({ error: 'Athlete Aadhaar Number must contain exactly 12 digits.' });
    }
    if ((aadhaarNumber || aadhaar) && !aadhaarHash) {
      return res.status(400).json({ error: 'Aadhaar number must contain exactly 12 digits.' });
    }

    let parsedDob = undefined;
    let normalizedParentSports = undefined;
    let parentRelationship = undefined;
    let normalizedCoachSports = undefined;
    let coachCertBufferLength = 0;
    let normalizedCoachPrefs = undefined;
    let normalizedCoachLevels = undefined;
    let normalizedWorkTypes = undefined;

    if (role === 'parent') {
      if (!aadhaarNumber && !aadhaar) {
        return res.status(400).json({ error: 'Aadhaar number is required.' });
      }
      if (!aadhaarHash) {
        return res.status(400).json({ error: 'Parent Aadhaar number must contain exactly 12 digits.' });
      }
      if (!req.body.mobile || !String(req.body.mobile).trim()) {
        return res.status(400).json({ error: 'Mobile Number is required.' });
      }
      if (!req.body.childName || !String(req.body.childName).trim()) {
        return res.status(400).json({ error: "Child's Full Name is required." });
      }
      if (!req.body.childDob) {
        return res.status(400).json({ error: "Child's Date of Birth is required." });
      }
      parsedDob = new Date(req.body.childDob);
      if (isNaN(parsedDob.getTime())) {
        return res.status(400).json({ error: "Invalid Child's Date of Birth." });
      }
      const validRel = ['FATHER', 'MOTHER', 'LEGAL GUARDIAN', 'OTHER'];
      parentRelationship = String(req.body.relationshipToChild || '').toUpperCase().trim();
      if (!parentRelationship || !validRel.includes(parentRelationship)) {
        return res.status(400).json({ error: 'Relationship to Child is required and must be one of: FATHER, MOTHER, LEGAL GUARDIAN, OTHER.' });
      }

      let sportsList = Array.isArray(req.body.sports)
        ? req.body.sports
        : (req.body.childSport ? (Array.isArray(req.body.childSport) ? req.body.childSport : [req.body.childSport]) : []);
      sportsList = sportsList.map(s => String(s || '').trim()).filter(Boolean);
      if (sportsList.length === 0) {
        return res.status(400).json({ error: 'At least one sport is required.' });
      }

      normalizedParentSports = [];
      const seenSports = new Set();
      for (const sp of sportsList) {
        if (/[a-z]/.test(sp) || sp !== sp.toUpperCase()) {
          return res.status(400).json({ error: 'Please enter the sport in CAPITAL LETTERS.' });
        }
        const normKey = sp.toLowerCase();
        if (seenSports.has(normKey)) {
          return res.status(400).json({ error: 'This sport has already been added.' });
        }
        seenSports.add(normKey);
        normalizedParentSports.push(sp.toUpperCase());
      }

      if (req.body.confirmPassword !== undefined && req.body.confirmPassword !== password) {
        return res.status(400).json({ error: 'Passwords do not match.' });
      }

      if (req.body.agreeTerms === false || req.body.terms === false) {
        return res.status(400).json({ error: 'Please accept the Terms & Conditions and Privacy Policy.' });
      }
    }

    if (role === 'coach') {
      const coachMobile = req.body.mobile || req.body.phone;
      if (!coachMobile || !String(coachMobile).trim()) {
        return res.status(400).json({ error: 'Mobile Number is required.' });
      }
      if (!city || !String(city).trim()) {
        return res.status(400).json({ error: 'City is required.' });
      }
      if (!state || !String(state).trim()) {
        return res.status(400).json({ error: 'State is required.' });
      }

      let sportsList = Array.isArray(req.body.sports)
        ? req.body.sports
        : (req.body.sport ? (Array.isArray(req.body.sport) ? req.body.sport : [req.body.sport]) : []);
      sportsList = sportsList.map(s => String(s || '').trim()).filter(Boolean);
      if (sportsList.length === 0) {
        return res.status(400).json({ error: 'At least one sport is required.' });
      }

      normalizedCoachSports = [];
      const seenSports = new Set();
      for (const sp of sportsList) {
        if (/[a-z]/.test(sp) || sp !== sp.toUpperCase()) {
          return res.status(400).json({ error: 'Please enter the sport in CAPITAL LETTERS.' });
        }
        const normKey = sp.toLowerCase();
        if (seenSports.has(normKey)) {
          return res.status(400).json({ error: 'This sport has already been added.' });
        }
        seenSports.add(normKey);
        normalizedCoachSports.push(sp.toUpperCase());
      }

      if (req.body.yearsExperience === undefined || req.body.yearsExperience === null || req.body.yearsExperience === '' || isNaN(Number(req.body.yearsExperience)) || Number(req.body.yearsExperience) < 0) {
        return res.status(400).json({ error: 'Years of Experience is required.' });
      }

      // Certificate PDF validation
      const { certificateData, certificateFileName } = req.body;
      if (!certificateData || !certificateFileName) {
        return res.status(400).json({ error: 'Coaching Certificate PDF is required.' });
      }
      if (!String(certificateData).startsWith('data:application/pdf;base64,')) {
        return res.status(400).json({ error: 'Only PDF files are allowed for coaching certificates.' });
      }
      const base64Content = String(certificateData).split(',')[1] || '';
      coachCertBufferLength = Buffer.byteLength(base64Content, 'base64');
      if (coachCertBufferLength >= 2 * 1024 * 1024) {
        return res.status(400).json({ error: 'Coaching certificate PDF must be strictly less than 2 MB.' });
      }

      if (req.body.acceptingAthletes === undefined || req.body.acceptingAthletes === null || req.body.acceptingAthletes === '') {
        return res.status(400).json({ error: 'Please specify whether you are currently accepting new athletes.' });
      }

      let coachPreferences = req.body.coachingPreferences;
      if (typeof coachPreferences === 'string') {
        coachPreferences = [coachPreferences];
      }
      if (!Array.isArray(coachPreferences) || coachPreferences.length === 0) {
        return res.status(400).json({ error: 'Coaching Preference is required (Individual Athlete, Academy, or both).' });
      }
      const validPrefs = ['INDIVIDUAL', 'ACADEMY'];
      normalizedCoachPrefs = coachPreferences.map(p => String(p).toUpperCase().trim()).filter(p => validPrefs.includes(p));
      if (normalizedCoachPrefs.length === 0) {
        return res.status(400).json({ error: 'Coaching Preference must include INDIVIDUAL and/or ACADEMY.' });
      }

      if (req.body.willingToWorkWithAcademies === undefined || req.body.willingToWorkWithAcademies === null || req.body.willingToWorkWithAcademies === '') {
        return res.status(400).json({ error: 'Please specify whether you are willing to work with academies.' });
      }

      if (Array.isArray(req.body.coachingLevels)) {
        const validLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'COMPETITIVE'];
        normalizedCoachLevels = req.body.coachingLevels.map(l => String(l).toUpperCase().trim()).filter(l => validLevels.includes(l));
      }

      if (Array.isArray(req.body.preferredWorkTypes)) {
        const validTypes = ['FULL-TIME', 'PART-TIME', 'CONTRACT', 'FLEXIBLE'];
        normalizedWorkTypes = req.body.preferredWorkTypes.map(t => String(t).toUpperCase().trim()).filter(t => validTypes.includes(t));
      }

      if (req.body.confirmPassword !== undefined && req.body.confirmPassword !== password) {
        return res.status(400).json({ error: 'Passwords do not match.' });
      }

      if (req.body.agreeTerms === false || req.body.terms === false) {
        return res.status(400).json({ error: 'Please accept the Terms & Conditions and Privacy Policy.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userPayload = {
      name: String(name).trim(),
      email: cleanEmail,
      passwordHash,
      role,
      city,
      state,
      address: typeof address === 'string' ? address : (address?.addressLine1 ? [address.addressLine1, address.city, address.state].filter(Boolean).join(', ') : ''),
      aadhaarHash,
      ...rest,
      sport: rest.sport ? String(rest.sport).trim() : (req.body.sport ? String(req.body.sport).trim() : undefined)
    };
    if (location) userPayload.location = location;

    if (role === 'parent') {
      userPayload.mobile = String(req.body.mobile).trim();
      userPayload.childName = String(req.body.childName).trim();
      userPayload.childDob = parsedDob;
      const diffMs = Date.now() - parsedDob.getTime();
      const calcAge = Math.floor(diffMs / (365.25 * 24 * 3600 * 1000));
      userPayload.childAge = calcAge >= 0 ? calcAge : 0;
      userPayload.relationshipToChild = parentRelationship;
      userPayload.sports = normalizedParentSports;
      userPayload.childSport = normalizedParentSports[0];
    }

    if (role === 'coach') {
      const coachMob = String(req.body.mobile || req.body.phone || '').trim();
      userPayload.mobile = coachMob;
      userPayload.phone = coachMob;
      userPayload.sports = normalizedCoachSports;
      userPayload.sport = normalizedCoachSports[0];
      userPayload.yearsExperience = Number(req.body.yearsExperience) || 0;
      userPayload.nisId = req.body.nisId ? String(req.body.nisId).trim() : null;
      if (req.body.certifications) {
        userPayload.certifications = Array.isArray(req.body.certifications)
          ? req.body.certifications.map(c => String(c).trim()).filter(Boolean)
          : String(req.body.certifications).split(',').map(c => c.trim()).filter(Boolean);
      }
      userPayload.bio = req.body.bio ? String(req.body.bio).trim() : null;
      userPayload.coachingLevels = normalizedCoachLevels || [];
      userPayload.acceptingAthletes = req.body.acceptingAthletes === true || req.body.acceptingAthletes === 'true' || req.body.acceptingAthletes === 'YES';
      userPayload.coachingPreferences = normalizedCoachPrefs || [];
      userPayload.willingToWorkWithAcademies = req.body.willingToWorkWithAcademies === true || req.body.willingToWorkWithAcademies === 'true' || req.body.willingToWorkWithAcademies === 'YES';
      userPayload.preferredWorkTypes = normalizedWorkTypes || [];
      userPayload.certificateData = req.body.certificateData;
      userPayload.certificateFileName = req.body.certificateFileName;
      userPayload.certificateFileSize = coachCertBufferLength;
    }

    const user = await User.create(userPayload);
    const { generateRolePermanentId } = require('../utils/idGenerator');

    if (role === 'athlete') {
      const athleteIdStr = await generateRolePermanentId('athlete', user._id, async (cand) => !(await User.findOne({ $or: [{ athleteId: cand }, { trackAthleteId: cand }] })));
      user.athleteId = athleteIdStr;
      user.trackAthleteId = athleteIdStr;
    }
    if (role === 'parent') {
      const parentIdStr = await generateRolePermanentId('parent', user._id, async (cand) => !(await User.findOne({ $or: [{ parentId: cand }, { trackAthleteId: cand }] })));
      user.parentId = parentIdStr;
      user.trackAthleteId = parentIdStr;
      user.mobile = userPayload.mobile;
      user.childName = userPayload.childName;
      user.childDob = userPayload.childDob;
      user.childAge = userPayload.childAge;
      user.relationshipToChild = userPayload.relationshipToChild;
      user.sports = userPayload.sports;
      user.childSport = userPayload.childSport;
    }
    if (role === 'coach') {
      const coachIdStr = await generateRolePermanentId('coach', user._id, async (cand) => !(await User.findOne({ $or: [{ coachId: cand }, { trackAthleteId: cand }] })));
      user.coachId = coachIdStr;
      user.trackAthleteId = coachIdStr;
      user.mobile = userPayload.mobile;
      user.phone = userPayload.phone;
      user.sports = userPayload.sports;
      user.sport = userPayload.sport;
      user.yearsExperience = userPayload.yearsExperience;
      user.nisId = userPayload.nisId;
      user.certifications = userPayload.certifications;
      user.bio = userPayload.bio;
      user.coachingLevels = userPayload.coachingLevels;
      user.acceptingAthletes = userPayload.acceptingAthletes;
      user.coachingPreferences = userPayload.coachingPreferences;
      user.willingToWorkWithAcademies = userPayload.willingToWorkWithAcademies;
      user.preferredWorkTypes = userPayload.preferredWorkTypes;
      user.certificateData = userPayload.certificateData;
      user.certificateFileName = userPayload.certificateFileName;
      user.certificateFileSize = userPayload.certificateFileSize;
    }
    if (role === 'sponsor') {
      const sponsorIdStr = await generateRolePermanentId('sponsor', user._id, async (cand) => !(await User.findOne({ $or: [{ sponsorId: cand }, { trackAthleteId: cand }] })));
      user.sponsorId = sponsorIdStr;
      user.trackAthleteId = sponsorIdStr;
    }
    if (role === 'academy') {
      const academyIdStr = await generateRolePermanentId('academy', user._id, async (cand) => !(await User.findOne({ $or: [{ academyId: cand }, { trackAthleteId: cand }] })));
      user.academyId = academyIdStr;
      user.trackAthleteId = academyIdStr;
      if (req.body.academyName) user.academyName = String(req.body.academyName).trim();
      if (req.body.contactPhone) user.contactPhone = String(req.body.contactPhone).trim();
    }
    if (user.sport) user.sport = String(user.sport).trim();
    await user.save();

    // Auto-link historical official results by Aadhaar hash only.
    if (role === 'athlete') {
      const matchCriteria = [];
      if (user.aadhaarHash) matchCriteria.push({ aadhaarHash: user.aadhaarHash });
      if (matchCriteria.length > 0) {
        await OfficialAchievement.updateMany(
          { $or: matchCriteria },
          { $set: { athleteUserId: user._id, athleteId: user.athleteId } }
        ).catch(e => console.error('Historical achievement auto-link error:', e));
      }
    }

    // Auto-create Academy record and initial sport assignments if signing up as academy
    if (role === 'academy') {
      try {
        const Academy = require('../models/Academy');
        const AcademyCoachAssignment = require('../models/AcademyCoachAssignment');

        const coords = req.body.location?.coordinates && Array.isArray(req.body.location.coordinates)
          ? req.body.location.coordinates
          : (location?.coordinates || [80.6480, 16.5062]);

        const rawSports = Array.isArray(req.body.sports)
          ? req.body.sports
          : (Array.isArray(req.body.sportsOffered) ? req.body.sportsOffered.map(s => ({ sportName: s })) : []);

        const normalizedSports = [];
        const seen = new Set();
        for (const sp of rawSports) {
          const sName = String(sp.sportName || sp.name || sp).trim().toUpperCase();
          if (sName && !seen.has(sName)) {
            seen.add(sName);
            normalizedSports.push({ sportName: sName, addedAt: new Date() });
          }
        }

        const academyDoc = await Academy.create({
          userId: user._id,
          academyId: user.academyId,
          name: String(req.body.academyName || user.name).trim(),
          contactPhone: String(req.body.contactPhone || req.body.phone || '+91 0000000000').trim(),
          email: cleanEmail,
          address: {
            addressLine1: req.body.address?.addressLine1 || req.body.addressLine1 || req.body.address || '',
            addressLine2: req.body.address?.addressLine2 || req.body.addressLine2 || '',
            city: city || req.body.address?.city || '',
            state: state || req.body.address?.state || '',
            pincode: req.body.pincode || req.body.address?.pincode || '',
            country: req.body.country || req.body.address?.country || 'India'
          },
          city: city || req.body.address?.city || '',
          state: state || req.body.address?.state || '',
          location: {
            type: 'Point',
            coordinates: [Number(req.body.location?.coordinates?.[0]) || 80.6480, Number(req.body.location?.coordinates?.[1]) || 16.5062]
          },
          sports: (Array.isArray(req.body.sports) ? req.body.sports.map(s => ({ sportName: String(s.sportName || s).trim().toUpperCase(), addedAt: new Date() })) : []),
          rankingStats: {
            districtPlayers: Number(req.body.rankingStats?.districtPlayers ?? req.body.districtPlayers ?? 0),
            statePlayers: Number(req.body.rankingStats?.statePlayers ?? req.body.statePlayers ?? 0),
            nationalPlayers: Number(req.body.rankingStats?.nationalPlayers ?? req.body.nationalPlayers ?? 0),
            internationalPlayers: Number(req.body.rankingStats?.internationalPlayers ?? req.body.internationalPlayers ?? 0)
          },
          verified: true
        });

        // Add coach assignments if provided
        for (const sp of (req.body.sports || [])) {
          let coachId = sp.coachId || sp.coach;
          if (!coachId && (sp.coachTrackAthleteId || sp.coachAadhaar)) {
            let coachQuery = [];
            if (sp.coachTrackAthleteId) {
              coachQuery.push(
                { athleteId: sp.coachTrackAthleteId },
                { coachId: sp.coachTrackAthleteId },
                { trackAthleteId: sp.coachTrackAthleteId }
              );
            }
            if (sp.coachAadhaar) {
              const ch = hashAadhaar(sp.coachAadhaar);
              if (ch) coachQuery.push({ aadhaarHash: ch });
            }
            const matchedCoach = await User.findOne({ $or: coachQuery, role: 'coach' });
            if (matchedCoach) {
              coachId = matchedCoach.coachId || sp.coachTrackAthleteId || matchedCoach._id;
            }
          }
          if (coachId || sp.coachName) {
            await AcademyCoachAssignment.create({
              academyId: academyDoc.academyId,
              sportName: String(sp.sportName || '').trim().toUpperCase(),
              coachName: sp.coachName || 'Assigned Coach',
              coachAadhaarHash: sp.coachAadhaar ? hashAadhaar(sp.coachAadhaar) : null,
              coachNisId: sp.coachNisId || null,
              coachCertificateData: sp.coachCertificateData || null,
              coachCertificateFileName: sp.coachCertificateFileName || null,
              coachId: coachId || null
            }).catch(e => console.error('[Coach Assignment Create Warning]', e.message));
          }
        }
      } catch (acadErr) {
        console.error('[Academy Auto-Create Error]', acadErr);
      }
    }
    
    const expiresIn = rememberMe ? '30d' : '7d';
    const jwtSecret = process.env.JWT_SECRET || 'trackathlete_sih_secret_2026';
    const token = jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn });
    
    const userObj = withoutAadhaar(user);
    if (userObj.sport) userObj.sport = String(userObj.sport).trim();
    userObj.trackAthleteId = user.trackAthleteId;
    if (role === 'athlete') userObj.athleteId = user.athleteId;
    if (role === 'parent') userObj.parentId = user.parentId;
    if (role === 'coach') userObj.coachId = user.coachId;
    if (role === 'sponsor') userObj.sponsorId = user.sponsorId;
    if (role === 'academy') {
      userObj.academyId = user.academyId;
      userObj.academyName = String(req.body.academyName || user.name).trim();
    }
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

// Helper: Resolve Academy user account using email, phone, academy name, or Academy document linkage
async function resolveAcademyUser(identifier) {
  if (!identifier) return null;
  const cleanInput = String(identifier).trim();
  const cleanEmail = cleanInput.toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '');
  const cleanDigits = cleanInput.replace(/\D/g, '');
  const escapedIdent = cleanInput.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const identRegex = new RegExp('^' + escapedIdent + '$', 'i');

  // 1. Direct search on User collection for academy role
  const academyUserQuery = [
    { email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i'), role: 'academy' },
    { academyName: identRegex, role: 'academy' },
    { name: identRegex, role: 'academy' },
    { academyId: identRegex, role: 'academy' },
    { trackAthleteId: identRegex, role: 'academy' }
  ];
  if (cleanDigits.length >= 7) {
    const phoneSuffix = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
    academyUserQuery.push(
      { contactPhone: new RegExp(phoneSuffix + '$'), role: 'academy' },
      { phone: new RegExp(phoneSuffix + '$'), role: 'academy' }
    );
  }
  let user = await User.findOne({ $or: academyUserQuery });
  let acadDoc = null;

  // 2. Check Academy collection
  const Academy = require('../models/Academy');
  if (!user) {
    const acadConditions = [
      { email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i') },
      { name: identRegex },
      { academyId: identRegex }
    ];
    if (cleanDigits.length >= 7) {
      const phoneSuffix = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
      acadConditions.push({ contactPhone: new RegExp(phoneSuffix + '$') });
    }
    acadDoc = await Academy.findOne({ $or: acadConditions });
    if (acadDoc) {
      if (acadDoc.userId) user = await User.findById(acadDoc.userId);
      if (!user && acadDoc.email) {
        user = await User.findOne({
          email: new RegExp('^' + String(acadDoc.email).trim().toLowerCase().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i')
        });
      }
    }
  }

  if (!acadDoc && user) {
    acadDoc = await Academy.findOne({
      $or: [
        { userId: user._id },
        { email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i') }
      ]
    });
  }

  if (!user) {
    user = await User.findOne({
      email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i')
    });
    if (user && !acadDoc) {
      acadDoc = await Academy.findOne({ $or: [{ userId: user._id }, { email: user.email }] });
    }
  }

  if (!user) return null;
  if (user.role !== 'academy') return null;

  // Self-heal permanent academyId if missing
  if (acadDoc && !acadDoc.academyId) {
    const baseId = acadDoc.userId || acadDoc._id;
    acadDoc.academyId = `ACA-${baseId.toString().slice(-8).toUpperCase()}`;
    await Academy.updateOne({ _id: acadDoc._id }, { $set: { academyId: acadDoc.academyId } });
  }
  if (user && (!user.academyId || !user.trackAthleteId)) {
    const aid = acadDoc?.academyId || `ACA-${user._id.toString().slice(-8).toUpperCase()}`;
    user.academyId = user.academyId || aid;
    user.trackAthleteId = user.trackAthleteId || aid;
    await User.updateOne({ _id: user._id }, { $set: { academyId: user.academyId, trackAthleteId: user.trackAthleteId } });
  }

  return { user, academy: acadDoc };
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, role, rememberMe } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanInput = String(email).trim();
    const cleanEmail = cleanInput.toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '');
    const passStr = String(password != null ? password : '');

    // Standard lookup by email
    let user = await User.findOne({
      email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i')
    });
    
    // Dedicated Academy Account Fallback Resolution (Only if user not found by email and role is academy)
    if (!user && role === 'academy') {
      const acadUser = await resolveAcademyUser(cleanInput);
      if (acadUser && acadUser.user) {
        user = acadUser.user;
      }
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    
    let match = false;
    if (user.passwordHash) {
      match = await bcrypt.compare(passStr, user.passwordHash);
      if (!match && user.role === 'academy') {
        // Tolerant check for academy in case of leading/trailing whitespace
        match = await bcrypt.compare(passStr.trim(), user.passwordHash);
      }
    }
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // If role is specified and does not match the account's registered role
    if (role && user.role !== role && user.role !== 'admin') {
      const regRole = (user.role || '').toUpperCase() || 'ANOTHER ROLE';
      return res.status(403).json({
        error: `This account is registered as ${regRole}. Please select the ${regRole} tab to sign in.`
      });
    }

    // Role handling: smoothly direct Academy users to academy workspace
    if (user.role === 'academy') {
      try {
        const Academy = require('../models/Academy');
        let acad = await Academy.findOne({ userId: user._id });
        if (!acad) {
          acad = await Academy.findOne({ email: user.email });
          if (acad && !acad.userId) {
            acad.userId = user._id;
            await acad.save();
          } else if (!acad) {
            const newAcadId = `ACA-${user._id.toString().slice(-8).toUpperCase()}`;
            acad = await Academy.create({
              userId: user._id,
              academyId: newAcadId,
              name: String(user.academyName || user.name || 'Sports Academy').trim(),
              email: user.email,
              contactPhone: String(user.contactPhone || user.phone || '+91 0000000000').trim(),
              address: {
                addressLine1: typeof user.address === 'string' ? user.address : (user.address?.addressLine1 || ''),
                city: user.city || '',
                state: user.state || '',
                country: 'India'
              },
              city: user.city || '',
              state: user.state || '',
              location: user.location || { type: 'Point', coordinates: [80.6480, 16.5062] },
              sports: (user.sportsOffered || []).map(s => ({ sportName: s, addedAt: new Date() })),
              verified: true
            });
          }
        }
        if (acad && !acad.academyId) {
          const baseId = acad.userId || acad._id;
          acad.academyId = `ACA-${baseId.toString().slice(-8).toUpperCase()}`;
          await Academy.updateOne({ _id: acad._id }, { $set: { academyId: acad.academyId } });
        }
        if (user && (!user.academyId || !user.trackAthleteId)) {
          const permId = acad?.academyId || `ACA-${user._id.toString().slice(-8).toUpperCase()}`;
          user.academyId = user.academyId || permId;
          user.trackAthleteId = user.trackAthleteId || permId;
          await User.updateOne({ _id: user._id }, { $set: { academyId: user.academyId, trackAthleteId: user.trackAthleteId } });
        }
      } catch (syncErr) {
        console.error('[Academy Sync Warning]', syncErr.message);
      }
    }
    
    const expiresIn = rememberMe ? '30d' : '7d';
    const jwtSecret = process.env.JWT_SECRET || 'trackathlete_sih_secret_2026';
    const token = jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn });
    
    const userObj = withoutAadhaar(user);
    userObj.role = user.role;
    userObj.trackAthleteId = user.trackAthleteId || user.athleteId || user.coachId || user.academyId || user.parentId || user.sponsorId;
    if (user.role === 'athlete') userObj.athleteId = user.athleteId;
    if (user.role === 'parent') userObj.parentId = user.parentId;
    if (user.role === 'coach') userObj.coachId = user.coachId;
    if (user.role === 'sponsor') userObj.sponsorId = user.sponsorId;
    if (user.role === 'academy') {
      const Academy = require('../models/Academy');
      const acad = await Academy.findOne({ $or: [{ userId: user._id }, { email: user.email }] });
      userObj.academyId = acad?.academyId || user.academyId || `ACA-${user._id.toString().slice(-8).toUpperCase()}`;
      userObj.trackAthleteId = userObj.academyId;
      if (acad?.name) userObj.academyName = acad.name;
    }
    delete userObj.passwordHash;
    delete userObj.resetPasswordOTP;

    res.json({ token, user: userObj });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// Dedicated POST /api/auth/academy-login
router.post('/academy-login', async (req, res) => {
  try {
    const { email, identifier, password, rememberMe } = req.body;
    const loginIdent = email || identifier;
    if (!loginIdent || !password) {
      return res.status(400).json({ error: 'Academy email, phone, or name, and password are required.' });
    }

    const resolved = await resolveAcademyUser(loginIdent);
    let user = resolved?.user;
    let acadDoc = resolved?.academy;

    if (!user) {
      const cleanInput = String(loginIdent).trim();
      const cleanEmail = cleanInput.toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '');
      user = await User.findOne({
        email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i')
      });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const passStr = String(password != null ? password : '');
    let match = false;
    if (user.passwordHash) {
      match = (await bcrypt.compare(passStr, user.passwordHash)) || (await bcrypt.compare(passStr.trim(), user.passwordHash));
    }
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.role !== 'academy') {
      const regRole = (user.role || '').toUpperCase() || 'ANOTHER ROLE';
      return res.status(403).json({
        error: `This account is registered as ${regRole}. Please select the ${regRole} tab to sign in.`
      });
    }

    const expiresIn = rememberMe ? '30d' : '7d';
    const jwtSecret = process.env.JWT_SECRET || 'trackathlete_sih_secret_2026';
    const token = jwt.sign({ id: user._id, role: 'academy' }, jwtSecret, { expiresIn });

    const userObj = withoutAadhaar(user);
    userObj.role = 'academy';
    if (acadDoc) {
      if (!acadDoc.academyId) {
        const baseId = acadDoc.userId || acadDoc._id;
        acadDoc.academyId = `ACA-${baseId.toString().slice(-8).toUpperCase()}`;
        await Academy.updateOne({ _id: acadDoc._id }, { $set: { academyId: acadDoc.academyId } });
      }
      userObj.academyId = acadDoc.academyId;
      userObj.trackAthleteId = acadDoc.academyId;
      userObj.academyName = acadDoc.name;
    } else {
      userObj.academyId = user.academyId || `ACA-${user._id.toString().slice(-8).toUpperCase()}`;
      userObj.trackAthleteId = userObj.academyId;
    }
    delete userObj.passwordHash;
    delete userObj.resetPasswordOTP;

    res.json({ token, user: userObj });
  } catch (err) {
    console.error('Academy Login Error:', err);
    res.status(500).json({ error: err.message || 'Academy login failed' });
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
