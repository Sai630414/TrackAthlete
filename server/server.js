require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const initSocket = require('./socket');

const authRoutes = require('./routes/auth.routes');
const athleteRoutes = require('./routes/athlete.routes');
const parentRoutes = require('./routes/parent.routes');
const coachRoutes = require('./routes/coach.routes');
const academyRoutes = require('./routes/academy.routes');
const sponsorRoutes = require('./routes/sponsor.routes');
const tournamentRoutes = require('./routes/tournament.routes');
const referenceRoutes = require('./routes/reference.routes');
const chatRoutes = require('./routes/chat.routes');
const federationRoutes = require('./routes/federation.routes');
const verificationRoutes = require('./routes/verification.routes');
const organizerRoutes = require('./routes/organizer.routes');
const organizerEventRoutes = require('./routes/organizer-events.routes');

const Federation = require('./models/Federation');
const OfficialAssociation = require('./models/OfficialAssociation');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN || '*' } });
app.set('io', io);

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure MongoDB Atlas connection on every request (especially for Vercel serverless lambdas)
app.use(async (req, res, next) => {
  if (req.path === '/api/health') return next();
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection middleware error:', err);
    res.status(500).json({ error: 'Database connection error: ' + err.message });
  }
});

// Reconcile deadline-driven state on requests without relying on a fragile
// serverless background job. It never changes frozen sport results.
app.use(async (_req, _res, next) => {
  try {
    const OrganizerEvent = require('./models/OrganizerEvent');
    const EventTeam = require('./models/EventTeam');
    const now = new Date();
    const events = await OrganizerEvent.find({ teamFormationDeadline: { $lt: now } });
    for (const event of events) {
      if (event.teamFormationDeadline && event.teamFormationDeadline < now) {
        for (const sport of event.sports.filter(s => s.competitionType === 'team')) {
          const teams = await EventTeam.find({ event: event._id, sportConfigId: sport._id, status: 'forming' });
          for (const team of teams) if (team.members.filter(m => m.status === 'confirmed').length + (team.manualPlayers?.length || 0) < sport.minimumTeamSize) { team.status = 'terminated'; team.terminationReason = 'Minimum team size not reached by team formation deadline.'; await team.save(); }
        }
      }
    }
  } catch (err) { console.error('Organizer deadline reconciliation error:', err.message); }
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'TrackAthlete API' }));

// Public MongoDB Organization endpoints
app.get('/api/federations', async (req, res) => {
  try {
    const { sport, search } = req.query;
    const filter = {};
    if (sport) filter.sport = new RegExp('^' + String(sport).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');
    if (search) {
      filter.$or = [
        { name: new RegExp(String(search), 'i') },
        { sport: new RegExp(String(search), 'i') },
        { abbreviation: new RegExp(String(search), 'i') }
      ];
    }
    const federations = await Federation.find(filter)
      .select('federationId name sport state abbreviation website recognitionStatus recognitionYear sourceDocument officialEmail officialPhone accountActivated status createdAt updatedAt')
      .sort({ name: 1 });
    res.json(federations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/associations', async (req, res) => {
  try {
    const { sport, state, search } = req.query;
    const filter = {};
    if (sport) filter.sport = new RegExp('^' + String(sport).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');
    if (state) filter.state = new RegExp('^' + String(state).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');
    if (search) {
      filter.$or = [
        { associationName: new RegExp(String(search), 'i') },
        { sport: new RegExp(String(search), 'i') },
        { state: new RegExp(String(search), 'i') }
      ];
    }
    const associations = await OfficialAssociation.find(filter).select('-__v').sort({ associationName: 1 });
    res.json(associations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/athlete', athleteRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/academy', academyRoutes);
app.use('/api/sponsor', sponsorRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/reference', referenceRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/federation', federationRoutes);
app.use('/api/verify', verificationRoutes);
app.use('/api/organizer', organizerRoutes);
app.use('/api/organizer-events', organizerEventRoutes);

initSocket(io);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  connectDB()
    .then(() => {
      server.listen(PORT, () => {
        console.log(`TrackAthlete API running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("Failed to connect to MongoDB:", err.message);
    });
} else {
  connectDB();
}

module.exports = app;
