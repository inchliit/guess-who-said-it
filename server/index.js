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

const logoQuestions = [
  {
    id: "google-colors",
    brandName: "Google",
    prompt: "Which Google wordmark has the correct color order?",
    explanation: "Google's letters run blue, red, yellow, blue, green, red.",
    correctOptionId: "google-real",
    options: [
      {
        id: "google-real",
        brand: "Google",
        label: "Blue red yellow blue green red",
        caption: "Option A color sequence",
        logoKey: "google-real"
      },
      {
        id: "google-swap",
        brand: "Google",
        label: "Green red yellow blue blue red",
        caption: "Option B color sequence",
        logoKey: "google-swap"
      },
      {
        id: "google-muted",
        brand: "Google",
        label: "Muted single-color wordmark",
        caption: "Single-tone version",
        logoKey: "google-muted"
      }
    ]
  },
  {
    id: "youtube-shape",
    brandName: "YouTube",
    prompt: "Which YouTube mark is closest to the correct shape?",
    explanation: "YouTube uses a red rounded rectangle with a white play triangle.",
    correctOptionId: "youtube-real",
    options: [
      {
        id: "youtube-circle",
        brand: "YouTube",
        label: "Red circle play mark",
        caption: "Circle play-button version",
        logoKey: "youtube-circle"
      },
      {
        id: "youtube-real",
        brand: "YouTube",
        label: "Red rounded play mark",
        caption: "Rounded play-button version",
        logoKey: "youtube-real"
      },
      {
        id: "youtube-dark",
        brand: "YouTube",
        label: "Black rounded play mark",
        caption: "Dark play-button version",
        logoKey: "youtube-dark"
      }
    ]
  },
  {
    id: "spotify-waves",
    brandName: "Spotify",
    prompt: "Which Spotify mark uses the correct color and wave direction?",
    explanation: "Spotify's icon is a green circle with dark curved sound waves.",
    correctOptionId: "spotify-real",
    options: [
      {
        id: "spotify-real",
        brand: "Spotify",
        label: "Green circle with dark waves",
        caption: "Circle icon with curved waves",
        logoKey: "spotify-real"
      },
      {
        id: "spotify-blue",
        brand: "Spotify",
        label: "Blue circle with white waves",
        caption: "Blue circle wave version",
        logoKey: "spotify-blue"
      },
      {
        id: "spotify-square",
        brand: "Spotify",
        label: "Green square with waves",
        caption: "Square wave version",
        logoKey: "spotify-square"
      }
    ]
  },
  {
    id: "target-bullseye",
    brandName: "Target",
    prompt: "Which Target logo has the correct bullseye?",
    explanation: "Target's mark is a red bullseye with a red center dot and red outer ring.",
    correctOptionId: "target-real",
    options: [
      {
        id: "target-real",
        brand: "Target",
        label: "Red bullseye with red center",
        caption: "Bullseye with center dot",
        logoKey: "target-real"
      },
      {
        id: "target-blue",
        brand: "Target",
        label: "Blue bullseye",
        caption: "Blue bullseye version",
        logoKey: "target-blue"
      },
      {
        id: "target-inverted",
        brand: "Target",
        label: "Red disk with white center",
        caption: "Filled disk variation",
        logoKey: "target-inverted"
      }
    ]
  },
  {
    id: "mcdonalds-arches",
    brandName: "McDonald's",
    prompt: "Which McDonald's mark has the correct arch color?",
    explanation: "McDonald's is known for its golden yellow arches.",
    correctOptionId: "mcdonalds-real",
    options: [
      {
        id: "mcdonalds-red",
        brand: "McDonald's",
        label: "Red arches",
        caption: "Red arch version",
        logoKey: "mcdonalds-red"
      },
      {
        id: "mcdonalds-real",
        brand: "McDonald's",
        label: "Golden arches",
        caption: "Golden arch version",
        logoKey: "mcdonalds-real"
      },
      {
        id: "mcdonalds-blue",
        brand: "McDonald's",
        label: "Blue arches",
        caption: "Blue arch version",
        logoKey: "mcdonalds-blue"
      }
    ]
  },
  {
    id: "microsoft-window",
    brandName: "Microsoft",
    prompt: "Which Microsoft window has the correct color set?",
    explanation: "The Microsoft symbol uses four colored panes: red, green, blue, and yellow.",
    correctOptionId: "microsoft-real",
    options: [
      {
        id: "microsoft-real",
        brand: "Microsoft",
        label: "Red, green, blue, yellow panes",
        caption: "Four-pane color tile",
        logoKey: "microsoft-real"
      },
      {
        id: "microsoft-purple",
        brand: "Microsoft",
        label: "Purple, green, blue, yellow panes",
        caption: "Alternative color tile",
        logoKey: "microsoft-purple"
      },
      {
        id: "microsoft-mono",
        brand: "Microsoft",
        label: "Single-color window",
        caption: "Single-color tile",
        logoKey: "microsoft-mono"
      }
    ]
  },
  {
    id: "instagram-gradient",
    brandName: "Instagram",
    prompt: "Which Instagram icon has the correct visual style?",
    explanation: "Instagram's app icon is a rounded square camera with a warm gradient.",
    correctOptionId: "instagram-real",
    options: [
      {
        id: "instagram-real",
        brand: "Instagram",
        label: "Gradient rounded camera",
        caption: "Rounded square camera",
        logoKey: "instagram-real"
      },
      {
        id: "instagram-blue",
        brand: "Instagram",
        label: "Blue camera outline",
        caption: "Blue outline camera",
        logoKey: "instagram-blue"
      },
      {
        id: "instagram-circle",
        brand: "Instagram",
        label: "Gradient circle camera",
        caption: "Circle camera version",
        logoKey: "instagram-circle"
      }
    ]
  },
  {
    id: "amazon-smile",
    brandName: "Amazon",
    prompt: "Which Amazon wordmark has the correct smile color?",
    explanation: "Amazon pairs a dark wordmark with an orange smile arrow.",
    correctOptionId: "amazon-real",
    options: [
      {
        id: "amazon-blue",
        brand: "Amazon",
        label: "Blue smile under dark text",
        caption: "Blue smile version",
        logoKey: "amazon-blue"
      },
      {
        id: "amazon-real",
        brand: "Amazon",
        label: "Orange smile under dark text",
        caption: "Orange smile version",
        logoKey: "amazon-real"
      },
      {
        id: "amazon-over",
        brand: "Amazon",
        label: "Orange smile above text",
        caption: "Smile above wordmark",
        logoKey: "amazon-over"
      }
    ]
  },
  {
    id: "apple-silhouette",
    brandName: "Apple",
    prompt: "Which Apple mark has the correct basic silhouette?",
    explanation: "Apple's mark is a simple apple silhouette with a bite and a detached leaf.",
    correctOptionId: "apple-real",
    options: [
      {
        id: "apple-real",
        brand: "Apple",
        label: "Apple shape with bite and leaf",
        caption: "Shape with side cutout",
        logoKey: "apple-real"
      },
      {
        id: "apple-no-bite",
        brand: "Apple",
        label: "Apple shape with no bite",
        caption: "Smooth apple shape",
        logoKey: "apple-no-bite"
      },
      {
        id: "apple-stem",
        brand: "Apple",
        label: "Apple shape with a stem",
        caption: "Shape with stem detail",
        logoKey: "apple-stem"
      }
    ]
  },
  {
    id: "nike-swoosh",
    brandName: "Nike",
    prompt: "Which Nike mark has the correct swoosh feel?",
    explanation: "Nike's mark is a single smooth, rising swoosh.",
    correctOptionId: "nike-real",
    options: [
      {
        id: "nike-real",
        brand: "Nike",
        label: "Single rising swoosh",
        caption: "Single sweeping curve",
        logoKey: "nike-real"
      },
      {
        id: "nike-double",
        brand: "Nike",
        label: "Double swoosh",
        caption: "Two-stroke version",
        logoKey: "nike-double"
      },
      {
        id: "nike-down",
        brand: "Nike",
        label: "Downward swoosh",
        caption: "Downward curve version",
        logoKey: "nike-down"
      }
    ]
  }
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

function normalizeGameType(value) {
  return value === "logo-quiz" ? "logo-quiz" : "guess-who";
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

function pickLogoQuestions(count) {
  return shuffle(logoQuestions).slice(0, Math.min(count, logoQuestions.length));
}

function createRoom(roundCount, gameType) {
  return {
    code: createRoomCode(),
    hostToken: randomUUID(),
    hostSocketId: null,
    gameType,
    phase: "lobby",
    roundIndex: 0,
    roundCount,
    promptQueue: [],
    logoQuestionQueue: [],
    currentPrompt: null,
    currentLogoQuestion: null,
    activePlayerIds: [],
    submissions: new Map(),
    quizAnswers: new Map(),
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
    hasSubmitted: room.gameType === "logo-quiz" ? room.quizAnswers.has(player.id) : room.submissions.has(player.id),
    hasVoted: room.gameType === "logo-quiz" ? room.quizAnswers.has(player.id) : room.votes.has(player.id)
  };
}

function getPublicLogoQuestion(question) {
  if (!question) {
    return null;
  }
  return {
    id: question.id,
    brandName: question.brandName,
    prompt: question.prompt,
    options: question.options.map((option) => ({
      id: option.id,
      brand: option.brand,
      label: option.label,
      caption: option.caption,
      logoKey: option.logoKey
    }))
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

function getQuizProgress(room) {
  return {
    done: [...room.quizAnswers.keys()].filter((id) => room.activePlayerIds.includes(id)).length,
    total: room.activePlayerIds.length
  };
}

function makeState(room, socket, playerId, isHost) {
  const currentSubmission = getCurrentSubmission(room);
  const player = playerId ? room.players.get(playerId) : null;
  const voteProgress = getVoteProgress(room);
  const quizProgress = getQuizProgress(room);

  return {
    roomCode: room.code,
    gameType: room.gameType,
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
    quizProgress,
    logoQuestion:
      room.currentLogoQuestion && (room.phase === "quiz" || room.phase === "quiz-reveal")
        ? getPublicLogoQuestion(room.currentLogoQuestion)
        : null,
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
    quizReveal: room.phase === "quiz-reveal" ? room.reveal : null,
    mySubmitted: playerId ? room.submissions.has(playerId) : false,
    myVote: playerId ? room.votes.get(playerId) ?? null : null,
    myQuizAnswer: playerId ? room.quizAnswers.get(playerId) ?? null : null,
    eligibleToVote:
      !!playerId &&
      !!currentSubmission &&
      room.phase === "guess" &&
      room.activePlayerIds.includes(playerId) &&
      currentSubmission.playerId !== playerId,
    eligibleToAnswer:
      !!playerId &&
      room.phase === "quiz" &&
      room.activePlayerIds.includes(playerId),
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
  if (room.gameType === "logo-quiz") {
    startLogoQuestion(room);
    return;
  }
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

function startLogoQuestion(room) {
  room.currentPrompt = null;
  room.currentLogoQuestion = room.logoQuestionQueue[room.roundIndex] ?? logoQuestions[room.roundIndex % logoQuestions.length];
  room.activePlayerIds = [...room.players.values()]
    .filter((player) => player.connected)
    .map((player) => player.id);
  room.submissions = new Map();
  room.quizAnswers = new Map();
  room.answerOrder = [];
  room.answerIndex = 0;
  room.votes = new Map();
  room.reveal = null;
  room.phase = "quiz";
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

function revealLogoQuestion(room) {
  const question = room.currentLogoQuestion;
  if (!question) {
    return;
  }
  if (room.reveal) {
    room.phase = "quiz-reveal";
    return;
  }

  const answerRows = [];
  for (const playerId of room.activePlayerIds) {
    const player = room.players.get(playerId);
    if (!player) {
      continue;
    }
    const optionId = room.quizAnswers.get(playerId) ?? null;
    const selectedOption = question.options.find((option) => option.id === optionId) ?? null;
    const isCorrect = optionId === question.correctOptionId;
    if (isCorrect) {
      player.score += 1;
    }
    answerRows.push({
      playerId,
      playerName: player.name,
      optionId,
      optionLabel: selectedOption?.label ?? "No answer",
      isCorrect
    });
  }

  room.reveal = {
    correctOptionId: question.correctOptionId,
    correctLabel: question.options.find((option) => option.id === question.correctOptionId)?.label ?? "Correct option",
    explanation: question.explanation,
    answers: answerRows
  };
  room.phase = "quiz-reveal";
}

function advanceAfterReveal(room) {
  if (room.gameType === "logo-quiz") {
    if (room.roundIndex < room.roundCount - 1) {
      room.roundIndex += 1;
      startLogoQuestion(room);
      return;
    }

    room.phase = "finished";
    room.currentPrompt = null;
    room.currentLogoQuestion = null;
    room.activePlayerIds = [];
    room.submissions = new Map();
    room.quizAnswers = new Map();
    room.answerOrder = [];
    room.answerIndex = 0;
    room.votes = new Map();
    room.reveal = null;
    return;
  }

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
  room.currentLogoQuestion = null;
  room.activePlayerIds = [];
  room.submissions = new Map();
  room.quizAnswers = new Map();
  room.answerOrder = [];
  room.answerIndex = 0;
  room.votes = new Map();
  room.reveal = null;
}

io.on("connection", (socket) => {
  socket.on("host:create", (payload = {}, callback) => {
    const gameType = normalizeGameType(payload.gameType);
    const requestedRounds = Number(payload.roundCount);
    const roundCount =
      gameType === "logo-quiz" ? logoQuestions.length : clamp(Number.isFinite(requestedRounds) ? requestedRounds : 5, 1, 10);
    const room = createRoom(roundCount, gameType);
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
    const minimumPlayers = room.gameType === "logo-quiz" ? 1 : 2;
    if (connectedPlayers.length < minimumPlayers) {
      replyError(callback, `Need at least ${minimumPlayers} connected ${minimumPlayers === 1 ? "player" : "players"}.`);
      return;
    }

    room.promptQueue = room.gameType === "guess-who" ? pickPrompts(room.roundCount) : [];
    room.logoQuestionQueue = room.gameType === "logo-quiz" ? pickLogoQuestions(room.roundCount) : [];
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
    if (room.phase === "quiz") {
      revealLogoQuestion(room);
      reply(callback, { ok: true });
      emitRoom(room);
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
    if (room.phase === "quiz") {
      revealLogoQuestion(room);
    } else if (room.phase === "quiz-reveal") {
      advanceAfterReveal(room);
    } else if (room.phase === "guess") {
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
    room.currentLogoQuestion = null;
    room.activePlayerIds = [];
    room.submissions = new Map();
    room.quizAnswers = new Map();
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

  socket.on("player:quiz-answer", (payload = {}, callback) => {
    const { room, player } = getPlayerRoom(socket, callback);
    if (!room || !player) {
      return;
    }
    if (room.phase !== "quiz" || !room.activePlayerIds.includes(player.id)) {
      replyError(callback, "Answers are closed.");
      return;
    }
    const question = room.currentLogoQuestion;
    const optionId = String(payload.optionId ?? "");
    if (!question || !question.options.some((option) => option.id === optionId)) {
      replyError(callback, "Choose one of the visible options.");
      return;
    }

    room.quizAnswers.set(player.id, optionId);

    const progress = getQuizProgress(room);
    if (progress.total > 0 && progress.done >= progress.total) {
      revealLogoQuestion(room);
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
