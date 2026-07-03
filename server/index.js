import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { randomInt, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 24;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const prompts = [
  "A tiny thing that always makes my day better",
  "A useless skill I might secretly be proud of",
  "My oddly specific comfort food",
  "The weirdest thing in my desk or bag",
  "A harmless hill I will defend",
  "Something I believed as a kid",
  "My personal theme song today would be",
  "A small win I had recently",
  "My most chaotic travel habit",
  "A fictional place I would visit",
  "A surprisingly strong opinion I have",
  "The app I open when I need a break"
];

const rooms = new Map();
const socketIndex = new Map();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? false : true
  }
});

app.use(express.json());
app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});
app.use(express.static(distDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sanitizeName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 28);
}

function sanitizeAnswer(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

function normalizeRoomCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function createRoomCode() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    let code = "";
    for (let index = 0; index < 4; index += 1) {
      code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    }
    if (!rooms.has(code)) {
      return code;
    }
  }
  return randomUUID().slice(0, 6).toUpperCase();
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function pickPrompts(count) {
  const picked = [];
  while (picked.length < count) {
    picked.push(...shuffle(prompts));
  }
  return picked.slice(0, count);
}

function createRoom(roundCount) {
  return {
    code: createRoomCode(),
    hostToken: randomUUID(),
    hostSocketId: null,
    phase: "lobby",
    roundIndex: 0,
    roundCount,
    promptQueue: [],
    currentPrompt: null,
    activePlayerIds: [],
    submissions: new Map(),
    answerOrder: [],
    answerIndex: 0,
    votes: new Map(),
    reveal: null,
    players: new Map(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function publicPlayer(player, room) {
  return {
    id: player.id,
    name: player.name,
    score: player.score,
    connected: player.connected,
    colorIndex: player.colorIndex,
    isActive: room.activePlayerIds.includes(player.id),
    hasSubmitted: room.submissions.has(player.id),
    hasVoted: room.votes.has(player.id)
  };
}

function getCurrentSubmission(room) {
  const playerId = room.answerOrder[room.answerIndex];
  if (!playerId) {
    return null;
  }
  return room.submissions.get(playerId) ?? null;
}

function getVoteProgress(room) {
  const submission = getCurrentSubmission(room);
  if (!submission) {
    return { done: 0, total: 0 };
  }
  const eligibleIds = room.activePlayerIds.filter((id) => id !== submission.playerId);
  return {
    done: [...room.votes.keys()].filter((id) => eligibleIds.includes(id)).length,
    total: eligibleIds.length
  };
}

function makeState(room, socket, playerId, isHost) {
  const currentSubmission = getCurrentSubmission(room);
  const player = playerId ? room.players.get(playerId) : null;
  const voteProgress = getVoteProgress(room);

  return {
    roomCode: room.code,
    phase: room.phase,
    roundIndex: room.roundIndex,
    roundCount: room.roundCount,
    prompt: room.currentPrompt,
    players: [...room.players.values()].map((item) => publicPlayer(item, room)),
    meId: player?.id ?? null,
    isHost,
    activePlayerIds: room.activePlayerIds,
    submissionProgress: {
      done: room.submissions.size,
      total: room.activePlayerIds.length
    },
    voteProgress,
    currentAnswer:
      currentSubmission && (room.phase === "guess" || room.phase === "reveal")
        ? {
            index: room.answerIndex + 1,
            total: room.answerOrder.length,
            text: currentSubmission.answer,
            isMine: currentSubmission.playerId === playerId
          }
        : null,
    reveal: room.phase === "reveal" ? room.reveal : null,
    mySubmitted: playerId ? room.submissions.has(playerId) : false,
    myVote: playerId ? room.votes.get(playerId) ?? null : null,
    eligibleToVote:
      !!playerId &&
      !!currentSubmission &&
      room.phase === "guess" &&
      room.activePlayerIds.includes(playerId) &&
      currentSubmission.playerId !== playerId,
    serverTime: Date.now()
  };
}

function emitStateToSocket(socket, room) {
  const link = socketIndex.get(socket.id);
  const playerId = link?.playerId ?? null;
  const isHost = link?.hostToken === room.hostToken;
  socket.emit("room:state", makeState(room, socket, playerId, isHost));
}

function emitRoom(room) {
  room.updatedAt = Date.now();
  const sockets = io.sockets.adapter.rooms.get(room.code);
  if (!sockets) {
    return;
  }
  for (const socketId of sockets) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      emitStateToSocket(socket, room);
    }
  }
}

function reply(callback, payload) {
  if (typeof callback === "function") {
    callback(payload);
  }
}

function replyError(callback, error) {
  reply(callback, { ok: false, error });
}

function getHostRoom(socket, callback) {
  const link = socketIndex.get(socket.id);
  const room = link?.roomCode ? rooms.get(link.roomCode) : null;
  if (!room || link?.hostToken !== room.hostToken) {
    replyError(callback, "Host session not found.");
    return null;
  }
  return room;
}

function getPlayerRoom(socket, callback) {
  const link = socketIndex.get(socket.id);
  const room = link?.roomCode ? rooms.get(link.roomCode) : null;
  const player = link?.playerId && room ? room.players.get(link.playerId) : null;
  if (!room || !player) {
    replyError(callback, "Join a room first.");
    return { room: null, player: null };
  }
  return { room, player };
}

function startRound(room) {
  room.currentPrompt = room.promptQueue[room.roundIndex] ?? prompts[room.roundIndex % prompts.length];
  room.activePlayerIds = [...room.players.values()]
    .filter((player) => player.connected)
    .map((player) => player.id);
  room.submissions = new Map();
  room.answerOrder = [];
  room.answerIndex = 0;
  room.votes = new Map();
  room.reveal = null;
  room.phase = "submit";
}

function prepareGuessing(room) {
  room.answerOrder = shuffle([...room.submissions.keys()]);
  room.answerIndex = 0;
  room.votes = new Map();
  room.reveal = null;
  room.phase = "guess";
}

function revealCurrentAnswer(room) {
  const submission = getCurrentSubmission(room);
  if (!submission) {
    return;
  }
  if (room.reveal) {
    room.phase = "reveal";
    return;
  }

  const author = room.players.get(submission.playerId);
  const voteRows = [];
  let fooledCount = 0;

  for (const [voterId, targetId] of room.votes.entries()) {
    const voter = room.players.get(voterId);
    const target = room.players.get(targetId);
    if (!voter || !target || voterId === submission.playerId) {
      continue;
    }
    const isCorrect = targetId === submission.playerId;
    if (isCorrect) {
      voter.score += 1;
    } else {
      fooledCount += 1;
    }
    voteRows.push({
      voterId,
      voterName: voter.name,
      targetId,
      targetName: target.name,
      isCorrect
    });
  }

  const authorBonus = fooledCount > 0;
  if (authorBonus && author) {
    author.score += 1;
  }

  room.reveal = {
    authorId: submission.playerId,
    authorName: author?.name ?? "Unknown",
    votes: voteRows,
    correctVoterIds: voteRows.filter((row) => row.isCorrect).map((row) => row.voterId),
    fooledCount,
    authorBonus
  };
  room.phase = "reveal";
}

function advanceAfterReveal(room) {
  if (room.answerIndex < room.answerOrder.length - 1) {
    room.answerIndex += 1;
    room.votes = new Map();
    room.reveal = null;
    room.phase = "guess";
    return;
  }

  if (room.roundIndex < room.roundCount - 1) {
    room.roundIndex += 1;
    startRound(room);
    return;
  }

  room.phase = "finished";
  room.currentPrompt = null;
  room.activePlayerIds = [];
  room.submissions = new Map();
  room.answerOrder = [];
  room.answerIndex = 0;
  room.votes = new Map();
  room.reveal = null;
}

io.on("connection", (socket) => {
  socket.on("host:create", (payload = {}, callback) => {
    const requestedRounds = Number(payload.roundCount);
    const roundCount = clamp(Number.isFinite(requestedRounds) ? requestedRounds : 5, 1, 10);
    const room = createRoom(roundCount);
    room.hostSocketId = socket.id;
    rooms.set(room.code, room);

    socket.join(room.code);
    socketIndex.set(socket.id, { roomCode: room.code, hostToken: room.hostToken });
    reply(callback, { ok: true, roomCode: room.code, hostToken: room.hostToken });
    emitRoom(room);
  });

  socket.on("host:resume", (payload = {}, callback) => {
    const roomCode = normalizeRoomCode(payload.roomCode);
    const room = rooms.get(roomCode);
    if (!room || payload.hostToken !== room.hostToken) {
      replyError(callback, "Host room expired or not found.");
      return;
    }
    room.hostSocketId = socket.id;
    socket.join(room.code);
    socketIndex.set(socket.id, { roomCode: room.code, hostToken: room.hostToken });
    reply(callback, { ok: true });
    emitRoom(room);
  });

  socket.on("player:join", (payload = {}, callback) => {
    const roomCode = normalizeRoomCode(payload.roomCode);
    const room = rooms.get(roomCode);
    if (!room) {
      replyError(callback, "Room not found.");
      return;
    }

    const name = sanitizeName(payload.name);
    if (name.length < 2) {
      replyError(callback, "Use a name with at least 2 characters.");
      return;
    }

    const playerId =
      typeof payload.playerId === "string" && payload.playerId.length >= 12
        ? payload.playerId.slice(0, 80)
        : randomUUID();
    const existing = room.players.get(playerId);
    const duplicateName = [...room.players.values()].find(
      (player) => player.id !== playerId && player.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicateName) {
      replyError(callback, "That name is already in the room.");
      return;
    }

    if (!existing && room.phase !== "lobby") {
      replyError(callback, "This round already started.");
      return;
    }

    if (!existing && room.players.size >= MAX_PLAYERS) {
      replyError(callback, "Room is full.");
      return;
    }

    const player = existing ?? {
      id: playerId,
      name,
      score: 0,
      connected: true,
      socketId: socket.id,
      colorIndex: room.players.size % 8,
      joinedAt: Date.now(),
      lastSeen: Date.now()
    };

    player.name = name;
    player.connected = true;
    player.socketId = socket.id;
    player.lastSeen = Date.now();
    room.players.set(player.id, player);

    socket.join(room.code);
    socketIndex.set(socket.id, { roomCode: room.code, playerId: player.id });
    reply(callback, { ok: true, playerId: player.id });
    emitRoom(room);
  });

  socket.on("host:start", (_payload = {}, callback) => {
    const room = getHostRoom(socket, callback);
    if (!room) {
      return;
    }
    const connectedPlayers = [...room.players.values()].filter((player) => player.connected);
    if (connectedPlayers.length < 2) {
      replyError(callback, "Need at least 2 connected players.");
      return;
    }

    room.promptQueue = pickPrompts(room.roundCount);
    room.roundIndex = 0;
    for (const player of room.players.values()) {
      player.score = 0;
    }
    startRound(room);
    reply(callback, { ok: true });
    emitRoom(room);
  });

  socket.on("host:reveal", (_payload = {}, callback) => {
    const room = getHostRoom(socket, callback);
    if (!room) {
      return;
    }
    if (room.phase !== "guess") {
      replyError(callback, "Nothing to reveal yet.");
      return;
    }
    revealCurrentAnswer(room);
    reply(callback, { ok: true });
    emitRoom(room);
  });

  socket.on("host:next", (_payload = {}, callback) => {
    const room = getHostRoom(socket, callback);
    if (!room) {
      return;
    }
    if (room.phase === "guess") {
      revealCurrentAnswer(room);
    } else if (room.phase === "reveal") {
      advanceAfterReveal(room);
    } else {
      replyError(callback, "No next step available.");
      return;
    }
    reply(callback, { ok: true });
    emitRoom(room);
  });

  socket.on("host:reset", (_payload = {}, callback) => {
    const room = getHostRoom(socket, callback);
    if (!room) {
      return;
    }
    room.phase = "lobby";
    room.roundIndex = 0;
    room.currentPrompt = null;
    room.activePlayerIds = [];
    room.submissions = new Map();
    room.answerOrder = [];
    room.answerIndex = 0;
    room.votes = new Map();
    room.reveal = null;
    for (const player of room.players.values()) {
      player.score = 0;
    }
    reply(callback, { ok: true });
    emitRoom(room);
  });

  socket.on("player:submit", (payload = {}, callback) => {
    const { room, player } = getPlayerRoom(socket, callback);
    if (!room || !player) {
      return;
    }
    if (room.phase !== "submit" || !room.activePlayerIds.includes(player.id)) {
      replyError(callback, "Submissions are closed.");
      return;
    }
    const answer = sanitizeAnswer(payload.answer);
    if (answer.length < 2) {
      replyError(callback, "Write a little more first.");
      return;
    }
    room.submissions.set(player.id, {
      playerId: player.id,
      playerName: player.name,
      answer
    });

    if (room.submissions.size >= room.activePlayerIds.length) {
      prepareGuessing(room);
    }
    reply(callback, { ok: true });
    emitRoom(room);
  });

  socket.on("player:vote", (payload = {}, callback) => {
    const { room, player } = getPlayerRoom(socket, callback);
    if (!room || !player) {
      return;
    }
    const submission = getCurrentSubmission(room);
    if (room.phase !== "guess" || !submission) {
      replyError(callback, "Voting is closed.");
      return;
    }
    if (submission.playerId === player.id) {
      replyError(callback, "This answer is yours.");
      return;
    }
    const targetId = String(payload.targetPlayerId ?? "");
    if (targetId === player.id || !room.activePlayerIds.includes(targetId)) {
      replyError(callback, "Choose another active player.");
      return;
    }
    room.votes.set(player.id, targetId);

    const progress = getVoteProgress(room);
    if (progress.total > 0 && progress.done >= progress.total) {
      revealCurrentAnswer(room);
    }

    reply(callback, { ok: true });
    emitRoom(room);
  });

  socket.on("disconnect", () => {
    const link = socketIndex.get(socket.id);
    socketIndex.delete(socket.id);
    if (!link?.roomCode) {
      return;
    }
    const room = rooms.get(link.roomCode);
    if (!room) {
      return;
    }
    if (link.playerId) {
      const player = room.players.get(link.playerId);
      if (player) {
        player.connected = false;
        player.lastSeen = Date.now();
      }
    }
    if (link.hostToken === room.hostToken && room.hostSocketId === socket.id) {
      room.hostSocketId = null;
    }
    emitRoom(room);
  });
});

setInterval(() => {
  const cutoff = Date.now() - ROOM_TTL_MS;
  for (const [code, room] of rooms.entries()) {
    const hasLiveSockets = Boolean(io.sockets.adapter.rooms.get(code)?.size);
    if (!hasLiveSockets && room.updatedAt < cutoff) {
      rooms.delete(code);
    }
  }
}, 15 * 60 * 1000).unref();

httpServer.listen(PORT, () => {
  console.log(`CDL Ice Breakers server listening on ${PORT}`);
});
