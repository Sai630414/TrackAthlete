/**
 * server/utils/serializers.js
 * 
 * Centralized Serialization & DTO Layer for TrackAthlete.
 * Enforces role-based authorization, single authoritative profile views,
 * and ABSOLUTE security: zero password, OTP, token, or Aadhaar leaks.
 */

function normalizeSports(sports, sport) {
  const result = [];
  if (Array.isArray(sports)) {
    for (const s of sports) {
      if (s && typeof s === 'string' && s.trim()) {
        const up = s.trim().toUpperCase();
        if (!result.includes(up)) result.push(up);
      }
    }
  }
  if (sport && typeof sport === 'string' && sport.trim()) {
    const up = sport.trim().toUpperCase();
    if (!result.includes(up)) result.push(up);
  }
  return result;
}

function serializeAthleteProfile(userDoc, requesterRole = 'athlete', isConnected = false) {
  if (!userDoc) return null;
  const u = typeof userDoc.toObject === 'function' ? userDoc.toObject() : { ...userDoc };

  delete u.passwordHash;
  delete u.resetPasswordOTP;
  delete u.resetPasswordOTPExpires;
  delete u.resetPasswordToken;
  delete u.resetPasswordTokenExpires;
  delete u.aadhaar;
  delete u.aadhaarNumber;
  delete u.athleteIdentityReference;
  const hasAadhaar = Boolean(u.aadhaarHash);
  delete u.aadhaarHash;
  delete u.__v;

  const sports = normalizeSports(u.sports, u.sport);
  const primarySport = sports[0] || u.sport || '';

  const base = {
    _id: u._id,
    athleteId: u.athleteId || u.trackAthleteId || null,
    trackAthleteId: u.trackAthleteId || u.athleteId || null,
    name: u.name || '',
    sports,
    sportsTag: sports.length > 0 ? `[ ${sports.join(', ')} ]` : '',
    sport: primarySport,
    athleteLevel: u.athleteLevel || 'BEGINNER',
    beltRank: u.beltRank || '',
    yearsOfExperience: u.yearsOfExperience || u.yearsExperience || 0,
    age: u.age || 0,
    gender: u.gender || '',
    city: u.city || '',
    state: u.state || '',
    bio: u.bio || '',
    hasAadhaarLinked: hasAadhaar,
    isAadhaarVerified: hasAadhaar,
    isVerified: Boolean(u.federationVerified || hasAadhaar),
    currentlyActive: u.currentlyActive !== false,
    activelySeekingSponsorship: Boolean(u.activelySeekingSponsorship || u.seekingSponsorship),
    sponsorshipDetails: u.sponsorshipDetails || null,
    sponsorshipReason: u.sponsorshipReason || '',
    tournaments: Array.isArray(u.tournaments) ? u.tournaments.map(t => ({
      _id: t._id,
      tournamentName: t.tournamentName,
      sport: t.sport ? t.sport.toUpperCase() : primarySport,
      year: t.year,
      eventDate: t.eventDate,
      category: t.category,
      position: t.position,
      hasCertificate: Boolean(t.certificateData),
      certificateFileName: t.certificateFileName,
      certificateFileSize: t.certificateFileSize,
      sourceType: t.sourceType || 'SELF_UPLOADED',
      uploadedAt: t.uploadedAt
    })) : [],
    achievements: Array.isArray(u.achievements) ? u.achievements : [],
    videoLink: u.videoLink || ''
  };

  if (requesterRole === 'athlete' || requesterRole === 'admin') {
    return {
      ...base,
      email: u.email || '',
      mobile: u.mobile || u.phone || '',
      phone: u.mobile || u.phone || '',
      dateOfBirth: u.dateOfBirth || u.dob || null,
      dob: u.dob || u.dateOfBirth || null,
      location: u.location || null,
      hasAadhaarLinked: hasAadhaar,
      aadhaarVerified: hasAadhaar,
      createdAt: u.createdAt
    };
  }

  if (requesterRole === 'coach') {
    return {
      ...base,
      dateOfBirth: u.dateOfBirth || u.dob || null,
      dob: u.dob || u.dateOfBirth || null,
      mobile: isConnected ? (u.mobile || u.phone || '') : undefined,
      phone: isConnected ? (u.mobile || u.phone || '') : undefined,
      email: isConnected ? (u.email || '') : undefined,
      hasAadhaarLinked: hasAadhaar
    };
  }

  if (requesterRole === 'academy') {
    return {
      ...base,
      dateOfBirth: u.dateOfBirth || u.dob || null,
      dob: u.dob || u.dateOfBirth || null,
      mobile: isConnected ? (u.mobile || u.phone || '') : undefined,
      phone: isConnected ? (u.mobile || u.phone || '') : undefined,
      email: isConnected ? (u.email || '') : undefined,
      hasAadhaarLinked: hasAadhaar
    };
  }

  if (requesterRole === 'organizer') {
    return {
      ...base,
      mobile: u.mobile || u.phone || '',
      email: u.email || '',
      dateOfBirth: u.dateOfBirth || u.dob || null,
      dob: u.dob || u.dateOfBirth || null
    };
  }

  if (requesterRole === 'sponsor') {
    return {
      ...base
    };
  }

  return base;
}

function serializeCoachProfile(userDoc, requesterRole = 'coach', isConnected = false) {
  if (!userDoc) return null;
  const c = typeof userDoc.toObject === 'function' ? userDoc.toObject() : { ...userDoc };

  delete c.passwordHash;
  delete c.resetPasswordOTP;
  delete c.resetPasswordOTPExpires;
  delete c.resetPasswordToken;
  delete c.resetPasswordTokenExpires;
  delete c.aadhaar;
  delete c.aadhaarNumber;
  delete c.aadhaarHash;
  delete c.__v;

  const sports = normalizeSports(c.sports, c.sport);
  const primarySport = sports[0] || c.sport || '';

  const base = {
    _id: c._id,
    coachId: c.coachId || c.trackAthleteId || null,
    trackAthleteId: c.trackAthleteId || c.coachId || null,
    name: c.name || '',
    city: c.city || '',
    state: c.state || '',
    sports,
    sport: primarySport,
    nisId: c.nisId || c.nisNumber || null,
    nisNumber: c.nisNumber || c.nisId || null,
    certifications: Array.isArray(c.certifications) ? c.certifications : [],
    hasCertificate: Boolean(c.certificateData),
    certificateFileName: c.certificateFileName || '',
    certificateFileSize: c.certificateFileSize || 0,
    bio: c.bio || '',
    coachingLevels: Array.isArray(c.coachingLevels) ? c.coachingLevels : [],
    acceptingAthletes: c.acceptingAthletes !== false,
    coachingPreferences: Array.isArray(c.coachingPreferences) ? c.coachingPreferences : [],
    willingToWorkWithAcademies: c.willingToWorkWithAcademies !== false,
    preferredWorkTypes: Array.isArray(c.preferredWorkTypes) ? c.preferredWorkTypes : []
  };

  if (requesterRole === 'coach' || requesterRole === 'admin') {
    return {
      ...base,
      email: c.email || '',
      phone: c.phone || c.mobile || '',
      mobile: c.phone || c.mobile || '',
      certificateData: c.certificateData || null,
      createdAt: c.createdAt
    };
  }

  if (requesterRole === 'academy') {
    return {
      ...base,
      email: c.email || '',
      phone: c.phone || c.mobile || '',
      certificateData: c.certificateData || null
    };
  }

  if (requesterRole === 'athlete') {
    return {
      ...base,
      phone: isConnected ? (c.phone || c.mobile || '') : undefined
    };
  }

  return base;
}

function serializeAcademyProfile(academyDoc, requesterRole = 'public') {
  if (!academyDoc) return null;
  const a = typeof academyDoc.toObject === 'function' ? academyDoc.toObject() : { ...academyDoc };

  const sportsOffered = Array.isArray(a.sports)
    ? a.sports.map(s => (typeof s === 'string' ? s.toUpperCase() : (s.sportName || '').toUpperCase())).filter(Boolean)
    : [];

  const rankingStats = a.rankingStats || { districtPlayers: 0, statePlayers: 0, nationalPlayers: 0, internationalPlayers: 0 };
  // This serializer deliberately does not derive a level from rankingStats.
  const achievementLevel = a.achievementLevel || 'NOT YET QUALIFIED';
  const isQualified = achievementLevel !== 'NOT YET QUALIFIED' && achievementLevel !== 'UNRANKED';

  const isVerified = a.verified !== false;

  return {
    _id: a._id,
    academyId: a.academyId || null,
    name: a.name || '',
    contactPhone: a.contactPhone || '',
    email: a.email || '',
    address: a.address || {},
    city: a.city || a.address?.city || '',
    state: a.state || a.address?.state || '',
    pincode: a.address?.pincode || '',
    country: a.address?.country || 'India',
    location: a.location || null,
    sports: sportsOffered.map(name => ({ sportName: name })),
    sportsOffered,
    sportsTags: sportsOffered.map(name => `[ ${name} ]`),
    rankingStats,
    achievementLevel: isQualified ? achievementLevel : 'NOT YET QUALIFIED',
    achievementLevelLabel: isQualified ? `Achievement Level: ${achievementLevel}` : 'Achievement Level: NOT YET QUALIFIED',
    perSportLevels: a.perSportLevels || {},
    verified: isVerified,
    isVerified: isVerified,
    distanceKm: a.distanceKm !== undefined ? a.distanceKm : undefined,
    createdAt: a.createdAt
  };
}

function serializeOrganizerProfile(organizerDoc, requesterRole = 'public') {
  if (!organizerDoc) return null;
  const o = typeof organizerDoc.toObject === 'function' ? organizerDoc.toObject() : { ...organizerDoc };

  delete o.passwordHash;
  delete o.emailOTPHash;
  delete o.emailOTPExpires;
  delete o.__v;

  return {
    _id: o._id,
    organizerId: o.organizerId || null,
    trackAthleteId: o.trackAthleteId || o.organizerId || null,
    organizerType: o.organizerType || '',
    name: o.name || '',
    designation: o.designation || '',
    organizationName: o.organizationName || '',
    registrationNumber: o.registrationNumber || '',
    affiliation: o.affiliation || '',
    yearEstablished: o.yearEstablished || null,
    website: o.website || '',
    officialAddress: o.officialAddress || {},
    mobile: o.mobile || '',
    alternateMobile: o.alternateMobile || '',
    email: o.email || '',
    accountStatus: o.accountStatus || 'active',
    createdAt: o.createdAt
  };
}

function serializeUnifiedAchievements(officialAchs = [], organizerAchs = [], tournaments = [], athleteName = 'Athlete') {
  const unified = [];
  const seenKeys = new Set();

  for (const ach of officialAchs) {
    const rawDate = ach.eventDate || ach.event?.tournamentDate || ach.createdAt;
    const year = ach.year || (rawDate ? new Date(rawDate).getFullYear() : '');
    const title = ach.tournamentName || ach.event?.eventName || 'Federation Championship';
    const result = ach.medal
      ? `${ach.medal} Medal`
      : (ach.rank ? `Rank ${ach.rank}` : (ach.achievementType || 'Verified Result'));
    const certData = ach.certificateData || ach.certificatePdf || null;
    const sport = (ach.sport || 'SPORTS').toUpperCase();
    const compLevel = ach.competitionLevel || ach.event?.competitionLevel || null;
    const achId = ach.officialRecordId || String(ach._id);
    const dedupKey = `FEDERATION_RECOGNIZED_${achId}`;

    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    unified.push({
      _id: String(ach._id),
      achievementId: achId,
      sourceType: 'FEDERATION_RECOGNIZED',
      sourceLabel: '[FEDERATION RECOGNIZED]',
      isVerified: true,
      sport,
      sportsTag: `[ ${sport} ]`,
      tournamentName: title,
      eventName: title,
      title,
      result,
      resultType: ach.medal ? 'medals' : 'positions',
      resultValue: ach.medal || ach.rank || ach.position || result,
      outcome: result,
      medal: ach.medal || null,
      rank: ach.rank || null,
      position: ach.position || ach.rank || (ach.medal ? `${ach.medal} Medal` : null),
      category: ach.category || '',
      competitionLevel: compLevel,
      isTeam: Boolean(ach.teamName || ach.isTeam),
      teamName: ach.teamName || null,
      eventDate: rawDate,
      date: rawDate,
      year: String(year),
      issuedBy: ach.federation?.name || 'Recognized Sports Federation',
      organization: ach.federation?.name || 'Recognized Sports Federation',
      venue: ach.event?.location || '',
      hasCertificate: Boolean(certData),
      certificate: certData,
      certificateFileName: ach.certificateFileName || `${athleteName}_Federation_Certificate.pdf`,
      certificateFileSize: ach.certificateFileSize || 0,
      certificateData: certData,
      verificationStatus: ach.verificationStatus || 'VERIFIED',
      eventId: ach.event?._id ? String(ach.event._id) : (ach.event?.eventId || null)
    });
  }

  for (const ach of organizerAchs) {
    const rawDate = ach.event?.eventDate || ach.createdAt;
    const year = rawDate ? new Date(rawDate).getFullYear() : '';
    const title = ach.event?.eventName || ach.tournamentName || 'Organizer Tournament';
    const result = ach.outcome || (ach.medal ? `${ach.medal} Medal` : (ach.position ? `${ach.position} Place` : 'Verified Podium'));
    const certData = ach.certificateData || null;
    const sport = (ach.sportName || ach.sport || 'SPORTS').toUpperCase();
    const compLevel = ach.competitionLevel || ach.event?.competitionLevel || null;
    const achId = String(ach._id);
    const dedupKey = `ORGANIZER_VERIFIED_${achId}`;

    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    unified.push({
      _id: achId,
      achievementId: achId,
      sourceType: 'ORGANIZER_VERIFIED',
      sourceLabel: '[ORGANIZER VERIFIED]',
      isVerified: true,
      sport,
      sportsTag: `[ ${sport} ]`,
      tournamentName: title,
      eventName: title,
      title,
      result,
      resultType: ach.medal ? 'medals' : 'positions',
      resultValue: ach.medal || ach.position || ach.outcome || result,
      outcome: result,
      medal: ach.medal || null,
      position: ach.position || null,
      category: '',
      competitionLevel: compLevel,
      isTeam: Boolean(ach.isTeam || ach.teamName),
      teamName: ach.teamName || null,
      eventDate: rawDate,
      date: rawDate,
      year: String(year),
      issuedBy: ach.organizer?.organizationName || ach.organizer?.name || 'Verified Event Organizer',
      organization: ach.organizer?.organizationName || ach.organizer?.name || 'Verified Event Organizer',
      venue: ach.event?.venue || '',
      hasCertificate: Boolean(certData),
      certificate: certData,
      certificateFileName: ach.certificateFileName || `${athleteName}_Organizer_Certificate.pdf`,
      certificateFileSize: ach.certificateFileSize || 0,
      certificateData: certData,
      verificationStatus: 'ORGANIZER_VERIFIED',
      eventId: ach.event?._id ? String(ach.event._id) : null
    });
  }

  if (Array.isArray(tournaments)) {
    tournaments.forEach((t, idx) => {
      const rawDate = t.eventDate || t.uploadedAt || null;
      const year = t.year || (rawDate ? new Date(rawDate).getFullYear() : '');
      const title = t.tournamentName || 'Tournament';
      const result = t.position || 'Participant';
      const certData = t.certificateData || null;
      const sport = (t.sport || 'SPORTS').toUpperCase();
      const achId = String(t._id || `self_${idx}`);
      const dedupKey = `SELF_UPLOADED_${achId}`;

      if (seenKeys.has(dedupKey)) return;
      seenKeys.add(dedupKey);

      unified.push({
        _id: achId,
        achievementId: achId,
        sourceType: 'SELF_UPLOADED',
        sourceLabel: '[SELF-UPLOADED — NOT VERIFIED]',
        isVerified: false,
        sport,
        sportsTag: `[ ${sport} ]`,
        tournamentName: title,
        eventName: title,
        title,
        result,
        resultType: 'positions',
        resultValue: t.position || result,
        outcome: result,
        medal: null,
        position: t.position || null,
        category: t.category || '',
        competitionLevel: t.competitionLevel || null,
        isTeam: false,
        teamName: null,
        eventDate: rawDate,
        date: rawDate,
        year: String(year),
        issuedBy: 'Self-Declared Record',
        organization: 'Self-Declared Record',
        venue: '',
        hasCertificate: Boolean(certData),
        certificate: certData,
        certificateFileName: t.certificateFileName || `${athleteName}_Tournament_Certificate.pdf`,
        certificateFileSize: t.certificateFileSize || 0,
        certificateData: certData,
        verificationStatus: 'SELF_DECLARED',
        eventId: null
      });
    });
  }

  unified.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : (parseInt(a.year, 10) ? new Date(`${a.year}-01-01`).getTime() : 0);
    const dateB = b.date ? new Date(b.date).getTime() : (parseInt(b.year, 10) ? new Date(`${b.year}-01-01`).getTime() : 0);
    return dateB - dateA;
  });

  return unified;
}

module.exports = {
  normalizeSports,
  serializeAthleteProfile,
  serializeCoachProfile,
  serializeAcademyProfile,
  serializeOrganizerProfile,
  serializeUnifiedAchievements
};
