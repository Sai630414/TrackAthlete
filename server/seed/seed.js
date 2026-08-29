require('dotenv').config();
const mongoose = require('mongoose');

const SAICentre = require('../models/SAICentre');
const Academy = require('../models/Academy');
const SportProfile = require('../models/SportProfile');

const saiCentresData = require('./data/saiCentresNew.json');
const academiesData = require('./data/academiesNew.json');
const sportProfilesData = require('./data/sportProfiles.json');


/*
=========================================================
SAI CENTRE COORDINATE CORRECTIONS
=========================================================
GeoJSON format is:
[longitude, latitude]
*/

const coordinateOverrides = {
  'NCOE Zirakpur': [76.8173, 30.6425],
  'NCOE Gandhinagar': [72.63905, 23.2339],
  'NCOE Bhopal': [77.3710, 23.2117]
};


/*
=========================================================
SAI HELPERS
=========================================================
*/

function isNonOperational(centre) {
  const name = String(centre.name || '').toLowerCase();
  const mapsQuery = String(centre.mapsQuery || '').toLowerCase();

  return (
    name.includes('non-operational') ||
    mapsQuery.includes('non-operational')
  );
}


function getScheme(centre) {
  const venueType = String(centre.venueType || '').toLowerCase();

  if (venueType.includes('national centre of excellence')) {
    return 'NCOE';
  }

  if (venueType.includes('sports training centre')) {
    return 'STC';
  }

  const name = String(centre.name || '').toLowerCase();

  if (name.startsWith('ncoe')) {
    return 'NCOE';
  }

  if (name.startsWith('stc')) {
    return 'STC';
  }

  return null;
}


function getSAIStatus(centre) {
  return 'Operational';
}


function getSAICoordinates(centre) {
  const name = String(centre.name || '').trim();

  /*
   * Use corrected coordinates where necessary.
   */
  if (coordinateOverrides[name]) {
    return coordinateOverrides[name];
  }

  const lat = Number(centre.lat);
  const lng = Number(centre.lng);

  /*
   * Validate coordinates.
   */
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return [lng, lat];
}


/*
=========================================================
NORMALIZE SAI DATA
=========================================================
One centre can have multiple sports.

Example:

Hamirpur
  Athletics
  Badminton
  Boxing

becomes 3 MongoDB documents.
*/

function normalizeSAICentres(data) {

  let centres = data;

  /*
   * The cleaned JSON should already be an array.
   *
   * This fallback is kept just in case the file
   * accidentally contains an object containing arrays.
   */
  if (!Array.isArray(centres)) {

    const possibleArrays = Object.values(centres).filter(
      Array.isArray
    );

    if (possibleArrays.length > 0) {
      centres = possibleArrays.flat();
    } else {
      throw new Error(
        'Could not find an array of SAI centres in saiCentresNew.json'
      );
    }
  }


  const documents = [];

  const stats = {
    totalInput: centres.length,
    nonOperational: 0,
    missingCoordinates: 0,
    missingSports: 0,
    missingScheme: 0,
    generatedDocuments: 0,
    coordinateOverrides: 0
  };


  for (const centre of centres) {

    /*
     * -----------------------------------------------------
     * REMOVE NON-OPERATIONAL CENTRES
     * -----------------------------------------------------
     */

    if (isNonOperational(centre)) {
      stats.nonOperational++;
      continue;
    }


    /*
     * -----------------------------------------------------
     * GET SCHEME
     * -----------------------------------------------------
     */

    const scheme = getScheme(centre);

    if (!scheme) {
      stats.missingScheme++;

      console.warn(
        `Skipping ${centre.name || 'unknown centre'}: unknown scheme`
      );

      continue;
    }


    /*
     * -----------------------------------------------------
     * GET COORDINATES
     * -----------------------------------------------------
     */

    const coordinates = getSAICoordinates(centre);

    if (!coordinates) {

      stats.missingCoordinates++;

      console.warn(
        `Skipping ${centre.name || 'unknown centre'}: missing/invalid coordinates`
      );

      continue;
    }


    if (coordinateOverrides[centre.name]) {
      stats.coordinateOverrides++;
    }


    /*
     * -----------------------------------------------------
     * GET SPORTS
     * -----------------------------------------------------
     */

    const sports = Array.isArray(centre.sports)
      ? centre.sports
          .map((sport) => String(sport).trim())
          .filter(Boolean)
      : [];


    if (sports.length === 0) {

      stats.missingSports++;

      console.warn(
        `Skipping ${centre.name || 'unknown centre'}: no sports`
      );

      continue;
    }


    /*
     * -----------------------------------------------------
     * CREATE ONE DOCUMENT PER SPORT
     * -----------------------------------------------------
     */

    for (const sport of sports) {

      documents.push({

        scheme,

        region:
          centre.regionalCentre ||
          centre.city ||
          centre.state ||
          'Unknown',

        state: centre.state || '',

        centreName: centre.name,

        sport,

        status: getSAIStatus(centre),

        /*
         * New dataset doesn't provide the old slot
         * information, so safely initialize to zero.
         */
        slots: {
          resiB: 0,
          resiG: 0,
          resiT: 0,
          nonresiB: 0,
          nonresiG: 0,
          nonresiT: 0
        },

        location: {
          type: 'Point',
          coordinates
        },

        entryPathway:
          'Centre-specific admission process',

        eligibilityAge:
          'Refer to centre',

        lastVerified:
          new Date(),

        source:
          'SAI Sports Centres dataset 2026'
      });

      stats.generatedDocuments++;
    }
  }


  return {
    documents,
    stats
  };
}


/*
=========================================================
PRIVATE ACADEMY HELPERS
=========================================================
*/


/*
 * Convert the new Google Places academy format
 * into the format expected by the existing Academy model.
 */
function normalizeAcademies(data) {

  /*
   * New file structure:
   *
   * {
   *   city: "Vijayawada",
   *   state: "Andhra Pradesh",
   *   last_updated: "...",
   *   source: "Google Places data",
   *   academies: [...]
   * }
   */

  let academies = data;


  /*
   * Extract the actual academy array.
   */
  if (
    !Array.isArray(academies) &&
    Array.isArray(academies.academies)
  ) {
    academies = academies.academies;
  }


  if (!Array.isArray(academies)) {
    throw new Error(
      'Could not find academy array in academiesNew.json'
    );
  }


  const documents = [];


  for (const academy of academies) {

    /*
     * -----------------------------------------------------
     * BASIC INFORMATION
     * -----------------------------------------------------
     */

    const name =
      String(academy.name || '').trim();

    if (!name) {
      console.warn(
        'Skipping academy with no name.'
      );
      continue;
    }


    /*
     * -----------------------------------------------------
     * SPORT
     * -----------------------------------------------------
     *
     * Most new records have:
     *
     * "sport": "Table Tennis"
     *
     * Convert it into the existing schema:
     *
     * sports: ["Table Tennis"]
     */

    let sports = [];


    if (Array.isArray(academy.sports)) {

      sports = academy.sports
        .map((sport) => String(sport).trim())
        .filter(Boolean);

    } else if (academy.sport) {

      const sportText =
        String(academy.sport).trim();


      /*
       * Handle multi-sport records such as:
       *
       * Multi-sport (Badminton, Football, Chess,
       * Table Tennis, Taekwondo)
       */

      const multiSportMatch =
        sportText.match(
          /^Multi-sport\s*\((.*?)\)$/i
        );


      if (multiSportMatch) {

        sports =
          multiSportMatch[1]
            .split(',')
            .map((sport) => sport.trim())
            .filter(Boolean);

      } else {

        sports = [sportText];

      }
    }


    /*
     * If no sport exists, don't insert a useless
     * academy that cannot be searched by sport.
     */

    if (sports.length === 0) {

      console.warn(
        `Skipping ${name}: no sport information`
      );

      continue;
    }


    /*
     * -----------------------------------------------------
     * COORDINATES
     * -----------------------------------------------------
     */

    const lat =
      Number(academy.latitude);

    const lng =
      Number(academy.longitude);


    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {

      console.warn(
        `Skipping ${name}: missing/invalid coordinates`
      );

      continue;
    }


    /*
     * -----------------------------------------------------
     * CREATE ACADEMY DOCUMENT
     * -----------------------------------------------------
     */

    documents.push({

      name,

      sports,

      city:
        academy.city ||
        data.city ||
        'Vijayawada',

      state:
        academy.state ||
        data.state ||
        'Andhra Pradesh',


      /*
       * New Google Places data doesn't contain fees.
       *
       * We DO NOT invent fee values.
       */
      feeRangeMin: null,

      feeRangeMax: null,


      /*
       * New field is phone.
       * Existing field is contact.
       */
      contact:
        academy.phone || '',


      /*
       * Google Places listing does not mean
       * the academy is officially verified.
       *
       * Therefore false is safer than inventing
       * verification.
       */
      acceptingStudents: true,

      verified: false,


      /*
       * GeoJSON:
       * [longitude, latitude]
       */
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      },


      /*
       * Extra information.
       *
       * These fields will be saved if your Academy
       * schema allows them. If the schema is strict,
       * Mongoose will ignore fields not defined there.
       */

      address:
        academy.address || '',

      rating:
        Number.isFinite(Number(academy.rating))
          ? Number(academy.rating)
          : null,

      reviewCount:
        Number.isFinite(Number(academy.rating_count))
          ? Number(academy.rating_count)
          : 0,

      hours:
        academy.hours || '',

      source:
        data.source ||
        'Google Places data',

      lastUpdated:
        data.last_updated
          ? new Date(data.last_updated)
          : new Date()
    });
  }


  return documents;
}


/*
=========================================================
MAIN SEED FUNCTION
=========================================================
*/

async function seed() {

  try {

    /*
     * -----------------------------------------------------
     * CONNECT TO MONGODB
     * -----------------------------------------------------
     */

    await mongoose.connect(
      process.env.MONGO_URI
    );

    console.log(
      'Connected to MongoDB for seeding...'
    );

    console.log('');


    /*
     * -----------------------------------------------------
     * PROCESS SAI DATA FIRST
     * -----------------------------------------------------
     */

    const {
      documents: saiCentres,
      stats: saiStats
    } =
      normalizeSAICentres(
        saiCentresData
      );


    /*
     * -----------------------------------------------------
     * PROCESS ACADEMY DATA
     * -----------------------------------------------------
     */

    const academies =
      normalizeAcademies(
        academiesData
      );


    /*
     * -----------------------------------------------------
     * SPORT PROFILE DATA
     * -----------------------------------------------------
     */

    const sportProfiles =
      sportProfilesData;


    /*
     * -----------------------------------------------------
     * SHOW PRE-SEED SUMMARY
     * -----------------------------------------------------
     *
     * This happens BEFORE deleting existing data.
     *
     * If there is a data-format error, the script stops
     * before touching MongoDB collections.
     * -----------------------------------------------------
     */

    console.log(
      '======================================'
    );

    console.log(
      'DATA PROCESSING SUMMARY'
    );

    console.log(
      '======================================'
    );

    console.log(
      `SAI input centres:        ${saiStats.totalInput}`
    );

    console.log(
      `SAI non-operational:      ${saiStats.nonOperational}`
    );

    console.log(
      `SAI missing coordinates:  ${saiStats.missingCoordinates}`
    );

    console.log(
      `SAI missing sports:       ${saiStats.missingSports}`
    );

    console.log(
      `SAI unknown scheme:       ${saiStats.missingScheme}`
    );

    console.log(
      `SAI coordinate fixes:     ${saiStats.coordinateOverrides}`
    );

    console.log(
      `SAI records to insert:    ${saiCentres.length}`
    );

    console.log(
      `Academies to insert:      ${academies.length}`
    );

    console.log(
      `SportProfiles to insert:  ${sportProfiles.length}`
    );

    console.log(
      '======================================'
    );

    console.log('');


    /*
     * -----------------------------------------------------
     * CLEAR OLD DATA
     * -----------------------------------------------------
     *
     * ONLY happens after ALL NEW DATA has successfully
     * been processed.
     * -----------------------------------------------------
     */

    console.log(
      'Clearing existing collections...'
    );

    await SAICentre.deleteMany({});

    await Academy.deleteMany({});

    await SportProfile.deleteMany({});


    /*
     * -----------------------------------------------------
     * INSERT SAI DATA
     * -----------------------------------------------------
     */

    if (saiCentres.length > 0) {

      await SAICentre.insertMany(
        saiCentres
      );
    }

    console.log(
      `Seeded ${saiCentres.length} SAI sport-centre records.`
    );


    /*
     * -----------------------------------------------------
     * INSERT PRIVATE ACADEMIES
     * -----------------------------------------------------
     */

    if (academies.length > 0) {

      await Academy.insertMany(
        academies
      );
    }

    console.log(
      `Seeded ${academies.length} private academies.`
    );


    /*
     * -----------------------------------------------------
     * INSERT SPORT PROFILES
     * -----------------------------------------------------
     */

    if (sportProfiles.length > 0) {

      await SportProfile.insertMany(
        sportProfiles
      );
    }

    console.log(
      `Seeded ${sportProfiles.length} SportProfile documents.`
    );


    /*
     * -----------------------------------------------------
     * COMPLETE
     * -----------------------------------------------------
     */

    console.log('');

    console.log(
      '======================================'
    );

    console.log(
      'Seeding complete!'
    );

    console.log(
      '======================================'
    );


    await mongoose.connection.close();

    process.exit(0);


  } catch (err) {

    console.error('');

    console.error(
      '======================================'
    );

    console.error(
      'SEEDING FAILED'
    );

    console.error(
      '======================================'
    );

    console.error(err);

    /*
     * Close connection if it was opened.
     */
    try {
      await mongoose.connection.close();
    } catch (closeError) {
      // Ignore close errors
    }

    process.exit(1);
  }
}


seed();