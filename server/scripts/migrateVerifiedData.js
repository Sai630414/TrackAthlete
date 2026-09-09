/*
 * Safe one-off data repair.
 *
 * Default mode is read-only. Set APPLY=1 only after reviewing its counts.
 * It never guesses tournament levels: an achievement is updated only when its
 * persisted parent OfficialEvent has a valid declared competitionLevel.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Academy = require('../models/Academy');
const OfficialEvent = require('../models/OfficialEvent');
const OfficialAchievement = require('../models/OfficialAchievement');

const LEVELS = new Set(['DISTRICT', 'STATE', 'NATIONAL', 'INTERNATIONAL']);
const apply = process.env.APPLY === '1';

async function main() {
  await connectDB();

  const events = await OfficialEvent.find({ competitionLevel: { $in: [...LEVELS] } })
    .select('_id competitionLevel')
    .lean();
  const eventLevels = new Map(events.map(event => [String(event._id), event.competitionLevel]));

  const missingAchievements = await OfficialAchievement.find({
    $or: [{ competitionLevel: null }, { competitionLevel: { $exists: false } }]
  }).select('_id event').lean();
  const repairable = missingAchievements.filter(achievement => eventLevels.has(String(achievement.event)));

  const academiesWithoutVerifiedFlag = await Academy.countDocuments({ verified: { $exists: false } });
  const apex = await Academy.findOne({ academyId: 'ACA-7F99B8C4' })
    .select('academyId name verified')
    .lean();
  const eventsByLevel = events.reduce((counts, event) => {
    counts[event.competitionLevel] = (counts[event.competitionLevel] || 0) + 1;
    return counts;
  }, {});

  if (apply) {
    for (const achievement of repairable) {
      await OfficialAchievement.updateOne(
        { _id: achievement._id, $or: [{ competitionLevel: null }, { competitionLevel: { $exists: false } }] },
        { $set: { competitionLevel: eventLevels.get(String(achievement.event)) } }
      );
    }
    // Missing is repaired; an explicitly false verification flag is preserved.
    await Academy.updateMany({ verified: { $exists: false } }, { $set: { verified: true } });
  }

  console.log(JSON.stringify({
    mode: apply ? 'applied' : 'dry-run',
    federationEventsWithDeclaredLevel: events.length,
    federationEventsByDeclaredLevel: eventsByLevel,
    officialAchievementsMissingLevel: missingAchievements.length,
    officialAchievementsSafelyRepairableFromParentEvent: repairable.length,
    officialAchievementsLeftUnranked: missingAchievements.length - repairable.length,
    academiesMissingVerifiedFlag: academiesWithoutVerifiedFlag,
    apexAcademy: apex ? { academyId: apex.academyId, name: apex.name, verified: apex.verified !== false } : null
  }));
}

main()
  .catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
