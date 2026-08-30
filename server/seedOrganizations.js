require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const Federation = require('./models/Federation');
const OfficialAssociation = require('./models/OfficialAssociation');

// Slug generator for unique IDs
function makeSlug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
}

async function seedOrganizations() {
  try {
    console.log('\n==================================================');
    console.log('TRACKATHLETE DYNAMIC ORGANIZATIONS IMPORT SCRIPT');
    console.log('==================================================\n');

    await connectDB();

    const fedJsonPath = 'C:\\Users\\HP\\Downloads\\nationalFederations.json';
    const zipPath = 'C:\\Users\\HP\\Downloads\\official_associations_normalized (1).zip';
    const extractDir = path.join(__dirname, 'temp_extracted_associations');

    if (!fs.existsSync(fedJsonPath)) {
      throw new Error(`Federation JSON file not found at '${fedJsonPath}'`);
    }

    if (!fs.existsSync(zipPath)) {
      throw new Error(`Official Associations ZIP file not found at '${zipPath}'`);
    }

    // Extract ZIP if not already extracted
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }

    try {
      const psCmd = `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`;
      execSync(psCmd);
      console.log(`[ZIP EXTRACTED] Successfully unpacked associations ZIP into temp directory.`);
    } catch (err) {
      console.log(`[ZIP NOTICE] Extraction output: ${err.message}`);
    }

    // 1. IMPORT NATIONAL FEDERATIONS
    const fedRaw = fs.readFileSync(fedJsonPath, 'utf8');
    const fedData = JSON.parse(fedRaw);
    const federationsList = fedData.nationalFederations || [];

    console.log(`\nProcessing ${federationsList.length} National Sports Federations from Downloads JSON...`);
    let fedInserted = 0;
    let fedUpdated = 0;

    for (const item of federationsList) {
      const sportSlug = makeSlug(item.sport);
      // Construct sport-based unique ID to guarantee 1:1 mapping for all 48 YAS sports
      const federationId = `FED-${sportSlug}`;
      const defaultEmail = `official.${sportSlug.toLowerCase()}@sports.gov.in`;

      const fedDoc = {
        name: item.federationName,
        sport: item.sport,
        state: 'National',
        abbreviation: item.abbreviation || '',
        website: item.website || '',
        recognitionStatus: item.recognitionBadge?.label || item.recognitionStatus || 'Recognized',
        recognitionYear: item.recognitionYear || 2024,
        sourceDocument: item.sourceDocument || '',
        status: (item.recognitionStatus || '').includes('suspension') ? 'Suspended' : 'Active'
      };

      const existing = await Federation.findOne({
        $or: [
          { federationId },
          { name: item.federationName, sport: item.sport }
        ]
      });

      if (!existing) {
        await Federation.create({
          federationId,
          officialEmail: defaultEmail,
          officialPhone: '+91 11 2338 0000',
          ...fedDoc
        });
        fedInserted++;
      } else {
        existing.federationId = federationId;
        existing.name = fedDoc.name;
        existing.sport = fedDoc.sport;
        existing.abbreviation = fedDoc.abbreviation || existing.abbreviation;
        existing.website = fedDoc.website || existing.website;
        existing.recognitionStatus = fedDoc.recognitionStatus;
        existing.recognitionYear = fedDoc.recognitionYear;
        existing.sourceDocument = fedDoc.sourceDocument;
        if (!existing.officialEmail) existing.officialEmail = defaultEmail;
        await existing.save();
        fedUpdated++;
      }
    }

    console.log(`[FEDERATIONS IMPORT COMPLETE] Inserted: ${fedInserted}, Updated: ${fedUpdated}`);

    // 2. IMPORT OFFICIAL ASSOCIATIONS FROM EXTRACTED JSON FILES
    const associationFiles = fs.readdirSync(extractDir).filter(f => f.endsWith('.json'));
    console.log(`\nProcessing ${associationFiles.length} Association JSON files extracted from ZIP...`);

    let assocInserted = 0;
    let assocUpdated = 0;

    for (const file of associationFiles) {
      const filePath = path.join(extractDir, file);
      const assocRaw = fs.readFileSync(filePath, 'utf8');
      const assocData = JSON.parse(assocRaw);

      const sportName = assocData.sport || 'Sports';
      const fedMeta = assocData.national_federation || {};
      const list = assocData.associations || [];

      for (const item of list) {
        if (!item.association_name) continue;

        const regNoRaw = item.registration_or_serial_no ? String(item.registration_or_serial_no).trim() : '';
        const isValidSerialNo = regNoRaw && !['applied', 'pending', 'null', 'undefined', 'n/a'].includes(regNoRaw.toLowerCase());
        
        const stateSlug = makeSlug(item.state || 'IN');
        const sportSlug = makeSlug(sportName);
        const nameSlug = makeSlug(item.association_name).slice(0, 15);

        const associationId = isValidSerialNo
          ? `ASSOC-${sportSlug}-${makeSlug(regNoRaw)}`
          : `ASSOC-${sportSlug}-${stateSlug}-${nameSlug}`;

        const assocDoc = {
          associationName: item.association_name,
          sport: sportName,
          state: item.state || 'General',
          registrationOrSerialNo: item.registration_or_serial_no || '',
          status: item.status || 'Affiliated Unit',
          address: item.address || '',
          phone: item.phone || '',
          email: item.email || '',
          website: item.website || '',
          nationalFederationName: fedMeta.name || '',
          nationalFederationAbbreviation: fedMeta.abbreviation || '',
          president: item.president || {},
          secretary: item.secretary || {},
          treasurer: item.treasurer || {}
        };

        const existing = await OfficialAssociation.findOne({
          $or: [
            { associationId },
            { associationName: item.association_name, sport: sportName, state: item.state }
          ]
        });

        if (!existing) {
          await OfficialAssociation.create({
            associationId,
            ...assocDoc
          });
          assocInserted++;
        } else {
          existing.associationId = associationId;
          Object.assign(existing, assocDoc);
          await existing.save();
          assocUpdated++;
        }
      }
    }

    console.log(`[ASSOCIATIONS IMPORT COMPLETE] Inserted: ${assocInserted}, Updated: ${assocUpdated}`);

    console.log('\n==================================================');
    console.log('FINAL DATABASE VERIFICATION SUMMARY:');
    console.log(`- Total Federations in MongoDB: ${await Federation.countDocuments()}`);
    console.log(`- Total Official Associations in MongoDB: ${await OfficialAssociation.countDocuments()}`);
    console.log('==================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('[IMPORT ERROR]', err);
    process.exit(1);
  }
}

seedOrganizations();
