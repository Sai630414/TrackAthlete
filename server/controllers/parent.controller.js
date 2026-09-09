const SAICentre = require('../models/SAICentre');
const Academy = require('../models/Academy');
const { haversineKm } = require('../utils/geo');
const { recommendSports } = require('../utils/recommender');
const cities = require('../utils/indianCities');

const saiCentresData = require('../seed/data/saiCentresNew.json');
const academiesData = require('../seed/data/academiesNew.json');

const PILOT_SPORTS = [
  'Archery',
  'Athletics',
  'Badminton',
  'Basketball',
  'Boxing',
  'Cycling',
  'Fencing',
  'Football',
  'Gymnastics',
  'Hockey',
  'Judo',
  'Kabaddi',
  'Karate',
  'Rowing',
  'Shooting',
  'Swimming',
  'Table Tennis',
  'Taekwondo',
  'Volleyball',
  'Weightlifting',
  'Wrestling',
  'Wushu'
];

function findCity(cityName) {
  return cities.find((c) => c.city.toLowerCase() === String(cityName).toLowerCase());
}

// GET /api/parent/reference
exports.getReferenceData = async (req, res) => {
  res.json({
    cities: cities.map((c) => c.city),
    sports: PILOT_SPORTS
  });
};

// Helper: Normalize fallback JSON SAI data if Mongo is unseeded or offline
function getFallbackSaiCentres(sport) {
  const normSport = String(sport).toLowerCase();
  return saiCentresData
    .filter((item) => Array.isArray(item.sports) && item.sports.some((s) => String(s).toLowerCase() === normSport))
    .map((item) => ({
      _id: item.id || String(Math.random()),
      centreName: item.name,
      name: item.name,
      sport,
      scheme: item.venueType || 'NCOE',
      city: item.city,
      state: item.state,
      status: 'Operational',
      entryPathway: 'Centre-specific admission process',
      eligibilityAge: '12-21 years',
      location: {
        type: 'Point',
        coordinates: [Number(item.lng), Number(item.lat)]
      }
    }));
}

// Helper: Normalize fallback JSON Academy data if Mongo is unseeded or offline
function getFallbackAcademies(sport) {
  const normSport = String(sport).toLowerCase();
  const rawList = Array.isArray(academiesData) ? academiesData : (academiesData.academies || []);
  return rawList
    .filter((a) => {
      if (Array.isArray(a.sports)) {
        return a.sports.some((s) => String(s).toLowerCase() === normSport);
      }
      return String(a.sport || '').toLowerCase().includes(normSport);
    })
    .map((a) => ({
      _id: String(Math.random()),
      name: a.name,
      sports: [sport],
      city: a.city || 'Vijayawada',
      state: a.state || 'Andhra Pradesh',
      feeRange: a.hours || 'Standard coaching fees',
      contact: a.phone || '',
      verified: true,
      location: {
        type: 'Point',
        coordinates: [Number(a.longitude || 80.648), Number(a.latitude || 16.506)]
      }
    }));
}

// GET /api/parent/search?city=Vijayawada&sport=Taekwondo&radiusKm=100
exports.search = async (req, res) => {
  try {
    const { city, sport, radiusKm } = req.query;
    if (!city || !sport) {
      return res.status(400).json({ error: 'city and sport are required' });
    }
    const cityData = findCity(city);
    if (!cityData) return res.status(404).json({ error: `Unknown city: ${city}` });

    const cityCoords = [cityData.lng, cityData.lat];
    const radius = radiusKm ? parseFloat(radiusKm) : null;

    let allCentres = [];
    try {
      allCentres = await SAICentre.find({ sport, status: 'Operational' }).lean();
    } catch (dbErr) {
      console.warn('Mongo SAI query failed, using JSON fallback:', dbErr.message);
    }
    if (!allCentres || allCentres.length === 0) {
      allCentres = getFallbackSaiCentres(sport);
    }

    const centresWithDistance = allCentres
      .map((c) => ({
        ...c,
        distanceKm: Math.round(haversineKm(cityCoords, c.location?.coordinates || [cityData.lng, cityData.lat]))
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const filteredCentres = radius
      ? centresWithDistance.filter((c) => c.distanceKm <= radius)
      : centresWithDistance;

    let academies = [];
    try {
      academies = await Academy.find({
        $or: [
          { 'sports.sportName': new RegExp(`^${sport}$`, 'i') },
          { sports: new RegExp(`^${sport}$`, 'i') }
        ]
      }).lean();
    } catch (dbErr) {
      console.warn('Mongo Academy query failed, using JSON fallback:', dbErr.message);
    }
    if (!academies || academies.length === 0) {
      academies = getFallbackAcademies(sport);
    }

    const academiesWithDistance = academies
      .map((a) => ({
        ...a,
        verified: a.verified !== false,
        achievementLevel: a.achievementLevel || 'STATE',
        distanceKm: Math.round(haversineKm(cityCoords, a.location?.coordinates || [cityData.lng, cityData.lat]))
      }))
      .filter((a) => (radius ? a.distanceKm <= radius : true))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const noResultsWithinRadius = radius && filteredCentres.length === 0 && academiesWithDistance.length === 0;

    res.json({
      city: cityData.city,
      state: cityData.state,
      sport,
      radiusKm: radius,
      saiCentres: filteredCentres,
      allSaiCentresCount: centresWithDistance.length,
      academies: academiesWithDistance,
      suggestAlternative: noResultsWithinRadius
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
};

// GET /api/parent/recommend?city=Vijayawada&radiusKm=100
exports.recommend = async (req, res) => {
  try {
    const { city, radiusKm } = req.query;
    if (!city) return res.status(400).json({ error: 'city is required' });

    const cityData = findCity(city);
    if (!cityData) return res.status(404).json({ error: `Unknown city: ${city}` });

    const cityCoords = [cityData.lng, cityData.lat];
    const radius = radiusKm ? parseFloat(radiusKm) : 300;

    const ranked = await recommendSports({
      pilotSports: PILOT_SPORTS,
      cityCoords,
      radiusKm: radius,
      state: cityData.state
    });

    res.json({ city: cityData.city, state: cityData.state, radiusKm: radius, recommendations: ranked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Recommendation failed', details: err.message });
  }
};
