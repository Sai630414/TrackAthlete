require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = require('./config/db');
const User = require('./models/User');
const Federation = require('./models/Federation');
const OfficialEvent = require('./models/OfficialEvent');
const OfficialAchievement = require('./models/OfficialAchievement');

async function seedFederation() {
  try {
    console.log('\n==================================================');
    console.log('TRACKATHLETE FEDERATION SYSTEM — SEED SCRIPT');
    console.log('==================================================\n');

    await connectDB();

    // 1. Find or Create One Official Development Federation
    const fedId = 'FED-TKD001';
    let federation = await Federation.findOne({ federationId: fedId });

    if (!federation) {
      const passwordHash = await bcrypt.hash('FederationPass123!', 10);
      federation = await Federation.create({
        federationId: fedId,
        name: 'Andhra Pradesh Taekwondo Federation',
        sport: 'Taekwondo',
        state: 'Andhra Pradesh',
        officialEmail: 'official@taekwondo.org.in',
        officialPhone: '+91 98765 00100',
        passwordHash: passwordHash,
        status: 'Active'
      });
      console.log(`[SEED CREATED] Federation: ${federation.name} (${federation.federationId})`);
    } else {
      console.log(`[SEED EXISTS] Federation already exists: ${federation.name} (${federation.federationId})`);
    }

    // 2. Find Existing Athlete Candidate in MongoDB
    let athleteUser = await User.findOne({ role: 'athlete' });

    if (!athleteUser) {
      // Create one development athlete user if DB has no athletes yet
      const athletePasswordHash = await bcrypt.hash('AthletePass123!', 10);
      athleteUser = await User.create({
        name: 'Venkat Athlete',
        email: 'athlete.venkat@trackathlete.in',
        passwordHash: athletePasswordHash,
        role: 'athlete',
        sport: 'Taekwondo',
        city: 'Visakhapatnam',
        state: 'Andhra Pradesh',
        athleteId: 'ATH-7K4M92XQ'
      });
      console.log(`[SEED CREATED] Development Athlete: ${athleteUser.name} (${athleteUser.athleteId})`);
    } else {
      if (!athleteUser.athleteId) {
        athleteUser.athleteId = `ATH-${athleteUser._id.toString().slice(-8).toUpperCase()}`;
        await athleteUser.save();
      }
      console.log(`[SEED FOUND] Athlete: ${athleteUser.name} (Permanent ID: ${athleteUser.athleteId})`);
    }

    // 3. Find or Create Development Official Event
    const eventId = 'EVT-AP-TKD2026';
    let event = await OfficialEvent.findOne({ eventId });

    if (!event) {
      const deadline = new Date();
      deadline.setMonth(deadline.getMonth() + 3); // 3 months in future

      event = await OfficialEvent.create({
        eventId: eventId,
        federation: federation._id,
        eventName: 'Andhra Pradesh State Taekwondo Championship 2026',
        sport: 'Taekwondo',
        category: 'Senior Kyorugi (Under 68kg)',
        location: 'Swarna Bharathi Indoor Stadium, Visakhapatnam',
        startDate: new Date('2026-06-10'),
        endDate: new Date('2026-06-12'),
        submissionDeadline: deadline,
        isFrozen: false,
        status: 'OPEN'
      });
      console.log(`[SEED CREATED] Official Event: ${event.eventName} (${event.eventId})`);
    } else {
      console.log(`[SEED EXISTS] Official Event already exists: ${event.eventName} (${event.eventId})`);
    }

    // 4. Find or Create Test Official Achievement Record
    const officialRecordId = 'TA-ACH-APTKD2026-001';
    let achievement = await OfficialAchievement.findOne({ officialRecordId });

    if (!achievement) {
      achievement = await OfficialAchievement.create({
        officialRecordId: officialRecordId,
        athleteUserId: athleteUser._id,
        athleteId: athleteUser.athleteId,
        athleteName: athleteUser.name,
        federation: federation._id,
        event: event._id,
        tournamentName: event.eventName,
        sport: event.sport,
        category: event.category,
        achievementType: 'medal',
        medal: 'Gold',
        year: 2026,
        eventDate: event.startDate,
        description: 'Gold Medalist in Senior Kyorugi Under 68kg Division',
        verificationStatus: 'VERIFIED'
      });
      console.log(`[SEED CREATED] Official Achievement: ${achievement.tournamentName} - ${achievement.medal} (${achievement.officialRecordId})`);
    } else {
      console.log(`[SEED EXISTS] Official Achievement already exists: ${achievement.officialRecordId}`);
    }

    console.log('\n==================================================');
    console.log('SEEDING SUMMARY & VERIFICATION DATA:');
    console.log(`- Federation Count: ${await Federation.countDocuments()}`);
    console.log(`- Event Count: ${await OfficialEvent.countDocuments()}`);
    console.log(`- Official Achievement Count: ${await OfficialAchievement.countDocuments()}`);
    console.log('==================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('[SEED ERROR]', err);
    process.exit(1);
  }
}

seedFederation();
