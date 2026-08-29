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

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN || '*' } });
app.set('io', io);
// app.use((req, res, next) => {
//   console.log('REQUEST:', req.method, req.originalUrl);
//   console.log('ORIGIN:', req.headers.origin);
//   next();
// });

app.use(cors({
  origin: true,
  credentials: true
}));
// app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'TrackAthlete API' }));

app.use('/api/auth', authRoutes);
app.use('/api/athlete', athleteRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/academy', academyRoutes);
app.use('/api/sponsor', sponsorRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/reference', referenceRoutes);
app.use('/api/chat', chatRoutes);

initSocket(io);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`TrackAthlete API running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });