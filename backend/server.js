// ...existing code...
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory sessions store
function getSessionByIdOrCode(idOrCode) {
  // First check by ID key
  if (sessions.has(idOrCode)) {
    return sessions.get(idOrCode);
  }

  // Otherwise search by code
  for (const session of sessions.values()) {
    if (session.code === idOrCode) {
      return session;
    }
  }

  return null;
}


const server = http.createServer(app);
const allowedOrigins = [
  'http://localhost:3000',
  'https://abhishek-digha.github.io',
  'https://abhishek-digha.github.io/cardplanning-v1'
];
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Socket.io setup
const io = new Server(server, {
  cors: { origin: allowedOrigins },
  pingTimeout: 600000,    // 10 minutes
  pingInterval: 300000    // 5 min seconds
});

// In-memory stores
const sessions = new Map();

class Session {
  constructor(adminId,name){
    this.id = uuidv4();
    this.code = Math.random().toString(36).substr(2,6).toUpperCase();
    this.adminId = adminId;
    this.members = [{id:adminId,name,isAdmin:true}];
    this.stories = [];
    this.activeStoryId = null;
  }
}
class Story {
  constructor(title,desc){
    this.id = uuidv4();
    this.title = title;
    this.description = desc;
    this.votes = new Map();
    this.isRevealed = false;
  }
}

// Create session
app.post('/api/sessions', (req, res) => {
  const { userName, systemId } = req.body || {};
  if (!userName) return res.status(400).json({ error: 'userName is required' });

  const adminId = uuidv4();
  const session = new Session(adminId, userName);

  // enrich the admin member with identity signals
  const admin = session.members.find(m => m.id === adminId);
  const ip = getClientIp(req);
  admin.systemId = systemId || null;
  admin.ip = ip;
  admin.userAgent = req.headers['user-agent'] || '';
  admin.createdAt = Date.now();
  admin.lastSeenAt = admin.createdAt;
  admin.joinCount = 1;

  sessions.set(session.id, session);

  const sessionObj = normalizeSessionForClient(session);

  res.json({
    sessionId: session.id,
    sessionCode: session.code,
    userId: admin.id,
    session: sessionObj,
    user: { id: admin.id, name: admin.name, isAdmin: true }
  });
});


// updated by me
// Join session
// --- helpers (put near the top of the file, once) ---
// --- helpers (put near the top of the file, once) ---
function getClientIp(req) {
  const xfwd = req.headers['x-forwarded-for'];
  if (Array.isArray(xfwd)) return xfwd[0];
  if (typeof xfwd === 'string' && xfwd.length) return xfwd.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || '';
}

function normalizeSessionForClient(session) {
  return {
    id: session.id,
    code: session.code,
    adminId: session.adminId,
    activeStoryId: session.activeStoryId || null,
    members: session.members.map(m => ({
      id: String(m.id),
      name: m.name,
      isAdmin: !!m.isAdmin
    })),
    stories: session.stories.map(story => ({
      id: story.id,
      title: story.title,
      description: story.description,
      isRevealed: !!story.isRevealed,
      votes: Object.fromEntries(story.votes) // Map -> plain object
    }))
  };
}

// --- DROP-IN REPLACEMENT: Join session with de-duplication ---
app.post('/api/sessions/join', (req, res) => {
  const { sessionCode, userName, systemId } = req.body || {};

  if (!sessionCode || !userName) {
    return res.status(400).json({ error: 'sessionCode and userName are required' });
  }

  // find session by code
  const session = [...sessions.values()].find(s => s.code === sessionCode);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  // capture client signals
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const now = Date.now();

  // 1) Try exact systemId match (preferred)
  let member = systemId
    ? session.members.find(m => m.systemId && String(m.systemId) === String(systemId))
    : null;

  // 2) Fallback: try matching by ip + user-agent + name (helps when systemId missing)
  if (!member) {
    member = session.members.find(
      m =>
        !!m.ip &&
        !!m.userAgent &&
        m.ip === ip &&
        m.userAgent === userAgent &&
        (m.name || '').toLowerCase() === userName.toLowerCase()
    );
  }

  if (member) {
    // Reuse existing member (no duplicate)
    member.name = userName;
    member.lastSeenAt = now;
    member.joinCount = (member.joinCount || 0) + 1;

    // If systemId arrives later, populate it
    if (systemId && !member.systemId) member.systemId = systemId;
    // If ip/ua changed, refresh them
    member.ip = ip;
    member.userAgent = userAgent;
  } else {
    // New member record
    member = {
      id: uuidv4(),
      name: userName,
      isAdmin: false,
      systemId: systemId || null,
      ip,
      userAgent,
      createdAt: now,
      lastSeenAt: now,
      joinCount: 1
    };
    session.members.push(member);
  }

  // Notify others in the room
  io.to(session.id).emit('memberJoined', { memberId: member.id });

  // Build safe session payload for client
  const sessionObj = normalizeSessionForClient(session);

  // Return BOTH legacy and new shapes (to avoid breaking any existing code)
  res.json({
    // legacy fields
    sessionId: session.id,
    sessionCode: session.code,
    userId: member.id,

    // new structured fields
    session: sessionObj,
    user: { id: member.id, name: member.name, isAdmin: !!member.isAdmin }
  });
});



// Get session
 app.get('/api/sessions/:id',(req,res)=>{
  const session = sessions.get(req.params.id);
  if(!session) return res.status(404).json({error:'Session not found'});
  // Deep clone and convert votes Map to object for each story
  const sessionObj = JSON.parse(JSON.stringify(session));
  sessionObj.stories = session.stories.map(story => ({
    ...story,
    votes: Object.fromEntries(story.votes)
  }));
  res.json(sessionObj);
});

// Create story
/*app.post('/api/sessions/:id/stories',(req,res)=>{
  const { title,description,userId } = req.body;
  const session = sessions.get(req.params.id);
  console.log('DEBUG: Incoming userId:', userId);
  console.log('DEBUG: Session members:', session.members);
  const member = session.members.find(m=>m.id===userId);
  if(!member?.isAdmin) {
    console.log('DEBUG: Member not admin or not found:', member);
    return res.status(403).json({error:'Only admin'});
  }
  const story=new Story(title,description);
  session.stories.push(story);
  session.activeStoryId = story.id;
  io.to(session.id).emit('storyCreated',story);
  io.to(session.id).emit('activeStoryChanged',story.id);
  res.json(story);
});
*/
//changed by me
// Vote
/*app.post('/api/sessions/:id/vote',(req,res)=>{
  const { userId,storyId,points }=req.body;
  const session=sessions.get(req.params.id);
  const story=session.stories.find(s=>s.id===storyId);
  if(story.isRevealed) return res.status(400).json({error:'Already revealed'});
  story.votes.set(userId,points);
  io.to(session.id).emit('voteCountChanged',{
    storyId, voteCount:story.votes.size, totalMembers:session.members.length
  });
  res.json({success:true});
});

*/

// Reveal votes
/*app.post('/api/sessions/:id/stories/:sid/reveal',(req,res)=>{
  const { userId } = req.body;
  const session=sessions.get(req.params.id);
  const member=session.members.find(m=>m.id===userId);
  if(!member?.isAdmin) return res.status(403).json({error:'Only admin'});
  const story=session.stories.find(s=>s.id===req.params.sid);
  story.isRevealed=true;
  io.to(session.id).emit('votesRevealed',{
    storyId:story.id,
    votes:Object.fromEntries(story.votes)
  });
  res.json({success:true});
});
*/
// Clear votes
/*app.post('/api/sessions/:id/stories/:sid/clear',(req,res)=>{
  //const { userId } = req.body;
  //const session=sessions.get(req.params.id);
  //const member=session.members.find(m=>m.id===userId);
  //if(!member?.isAdmin) return res.status(403).json({error:'Only admin'});
  //const story=session.stories.find(s=>s.id===req.params.sid);
  //story.votes.clear(); story.isRevealed=false;
  //io.to(session.id).emit('votesCleared',story.id);
  //res.json({success:true});
//});
*/
// modified by me
// Socket.io
// Socket.io
io.on('connection', socket => {
  socket.on('joinSession', idOrCode => {
    const session = getSessionByIdOrCode(idOrCode);
    if (!session) {
      socket.emit('error', { error: 'Session not found' });
      return;
    }

    // Always join by UUID for consistency
    socket.join(session.id);

    // Convert votes Map -> plain object
    const sessionObj = {
      ...session,
      stories: session.stories.map(story => ({
        ...story,
        votes: Object.fromEntries(story.votes)
      }))
    };

    socket.emit('sessionSnapshot', sessionObj);
  });
});




//changes by me

// Get session
// Create story
app.post('/api/sessions/:id/stories',(req,res)=>{
  const { title,description,userId } = req.body;
  const session = getSessionByIdOrCode(req.params.id);
  if(!session) return res.status(404).json({error:'Session not found'});
  const member = session.members.find(m=>m.id===userId);
  if(!member?.isAdmin) return res.status(403).json({error:'Only admin'});
  const story = new Story(title,description);
  session.stories.push(story);
  session.activeStoryId = story.id;
  io.to(session.id).emit('storyCreated',story);
  io.to(session.id).emit('activeStoryChanged',story.id);
  res.json(story);
});

// Vote
app.post('/api/sessions/:id/vote',(req,res)=>{
  const { userId,storyId,points }=req.body;
  const session = getSessionByIdOrCode(req.params.id);
  if(!session) return res.status(404).json({error:'Session not found'});
  const story = session.stories.find(s=>s.id===storyId);
  if(!story) return res.status(404).json({error:'Story not found'});
  if(story.isRevealed) return res.status(400).json({error:'Already revealed'});
  story.votes.set(userId,points);
  io.to(session.id).emit('voteCountChanged',{
    storyId, voteCount:story.votes.size, totalMembers:session.members.length
  });
  res.json({success:true});
});

// Reveal votes
app.post('/api/sessions/:id/stories/:sid/reveal',(req,res)=>{
  const { userId } = req.body;
  const session = getSessionByIdOrCode(req.params.id);
  if(!session) return res.status(404).json({error:'Session not found'});
  const member = session.members.find(m=>m.id===userId);
  if(!member?.isAdmin) return res.status(403).json({error:'Only admin'});
  const story = session.stories.find(s=>s.id===req.params.sid);
  if(!story) return res.status(404).json({error:'Story not found'});
  story.isRevealed=true;
  io.to(session.id).emit('votesRevealed',{
    storyId:story.id,
    votes:Object.fromEntries(story.votes)
  });
  res.json({success:true});
});

// Clear votes
app.post('/api/sessions/:id/stories/:sid/clear',(req,res)=>{
  const { userId } = req.body;
  const session = getSessionByIdOrCode(req.params.id);
  if(!session) return res.status(404).json({error:'Session not found'});
  const member = session.members.find(m=>m.id===userId);
  if(!member?.isAdmin) return res.status(403).json({error:'Only admin'});
  const story = session.stories.find(s=>s.id===req.params.sid);
  if(!story) return res.status(404).json({error:'Story not found'});
  story.votes.clear(); story.isRevealed=false;
  io.to(session.id).emit('votesCleared',story.id);
  res.json({success:true});
});


app.post('/api/sessions/:sessionId/remove-member', async (req, res) => {
  const { sessionId } = req.params;
  const { memberId } = req.body; // 🔹 must match frontend

  const session = getSessionByIdOrCode(sessionId);
  if (!session) return res.status(404).send({ error: 'Session not found' });

  const removedMember = session.members.find(m => String(m.id) === String(memberId));
  if (!removedMember) {
    console.error("❌ Member not found in session.members:", session.members);
    return res.status(404).send({ error: 'Member not found' });
  }

  session.members = session.members.filter(m => String(m.id) !== String(memberId));

  io.to(session.id).emit('memberRemoved', { memberId: removedMember.id });

  res.send({ success: true });
});




// 📌 Get all members of a session
app.get('/api/sessions/:sessionId/members', async (req, res) => {
  const { sessionId } = req.params;

  // Find session by ID or code
  const session = getSessionByIdOrCode(sessionId);
  if (!session) {
    return res.status(404).send({ error: 'Session not found' });
  }

  // Return members
  res.send({
    sessionId: session.id,
    members: session.members.map(m => ({
      id: String(m.id),        // normalize to string
      name: m.name || m.username || `User-${m.id}`,
      isAdmin: !!m.isAdmin,
      sessionId: session.id
    }))
  });
});


server.listen(5000,()=>console.log('Server running on port 5000'));
