import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Crown,
  Images,
  Loader2,
  LogIn,
  Play,
  RefreshCw,
  Send,
  Shapes,
  Sparkles,
  Trophy,
  XCircle,
  Timer,
  Users
} from "lucide-react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";

type Phase = "lobby" | "submit" | "guess" | "reveal" | "quiz" | "quiz-reveal" | "word" | "word-reveal" | "finished";
type Mode = "host" | "join";
type GameType = "guess-who" | "logo-quiz" | "four-pics";

type Player = {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  colorIndex: number;
  isActive: boolean;
  hasSubmitted: boolean;
  hasVoted: boolean;
};

type VoteRow = {
  voterId: string;
  voterName: string;
  targetId: string;
  targetName: string;
  isCorrect: boolean;
};

type Reveal = {
  authorId: string;
  authorName: string;
  votes: VoteRow[];
  correctVoterIds: string[];
  fooledCount: number;
  authorBonus: boolean;
};

type LogoOption = {
  id: string;
  brand: string;
  label: string;
  caption: string;
  logoKey: string;
};

type LogoQuestion = {
  id: string;
  brandName: string;
  prompt: string;
  options: LogoOption[];
};

type QuizReveal = {
  correctOptionId: string;
  correctLabel: string;
  explanation: string;
  answers: Array<{
    playerId: string;
    playerName: string;
    optionId: string | null;
    optionLabel: string;
    isCorrect: boolean;
  }>;
};

type WordQuestion = {
  id: string;
  prompt: string;
  image: string;
  answerLength: number;
};

type WordReveal = {
  answer: string;
  revealImage: string;
  answers: Array<{
    playerId: string;
    playerName: string;
    answer: string;
    isCorrect: boolean;
    points: number;
  }>;
};

type RoomState = {
  roomCode: string;
  gameType: GameType;
  phase: Phase;
  roundIndex: number;
  roundCount: number;
  prompt: string | null;
  players: Player[];
  meId: string | null;
  isHost: boolean;
  activePlayerIds: string[];
  submissionProgress: { done: number; total: number };
  voteProgress: { done: number; total: number };
  quizProgress: { done: number; total: number };
  wordProgress: { done: number; total: number };
  logoQuestion: LogoQuestion | null;
  wordQuestion: WordQuestion | null;
  currentAnswer: { index: number; total: number; text: string; isMine: boolean } | null;
  reveal: Reveal | null;
  quizReveal: QuizReveal | null;
  wordReveal: WordReveal | null;
  mySubmitted: boolean;
  myVote: string | null;
  myQuizAnswer: string | null;
  myWordAnswer: string | null;
  eligibleToVote: boolean;
  eligibleToAnswer: boolean;
  eligibleToWordAnswer: boolean;
  questionEndsAt: number | null;
  questionDurationMs: number | null;
  serverTime: number;
};

type Ack = {
  ok: boolean;
  error?: string;
  roomCode?: string;
  hostToken?: string;
  playerId?: string;
};

const palette = [
  "coral",
  "teal",
  "amber",
  "indigo",
  "moss",
  "rose",
  "blue",
  "charcoal"
];

const gameChoices: Array<{
  type: GameType;
  title: string;
  description: string;
}> = [
  {
    type: "four-pics",
    title: "4 Pics 1 Word",
    description: "10 timed picture puzzles"
  },
  {
    type: "guess-who",
    title: "Guess Who Said It",
    description: "Anonymous answers, group guesses"
  },
  {
    type: "logo-quiz",
    title: "Which Logo Is Correct",
    description: "10 fast visual logo questions"
  }
];

const visualLogoSamples: LogoOption[] = [
  {
    id: "sample-google",
    brand: "Google",
    label: "Correct color order",
    caption: "A",
    logoKey: "google-real"
  },
  {
    id: "sample-youtube",
    brand: "YouTube",
    label: "Correct play mark",
    caption: "B",
    logoKey: "youtube-real"
  },
  {
    id: "sample-target",
    brand: "Target",
    label: "Correct bullseye",
    caption: "C",
    logoKey: "target-blue"
  }
];

function getStoredPlayerId() {
  const key = "gwsi:player-id";
  const existing = localStorage.getItem(key);
  if (existing) {
    return existing;
  }
  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(key, next);
  return next;
}

function getInitialRoomCode() {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "";
}

function sortByScore(players: Player[]) {
  return [...players].sort((first, second) => {
    if (second.score !== first.score) {
      return second.score - first.score;
    }
    return first.name.localeCompare(second.name);
  });
}

function useCountdownSeconds(endsAt: number | null, durationMs: number | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt) {
      return;
    }

    setNow(Date.now());
    const intervalId = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, [endsAt]);

  const remainingMs = endsAt ? Math.max(0, endsAt - now) : 0;
  const totalMs = durationMs ?? 20_000;

  return {
    remainingSeconds: Math.ceil(remainingMs / 1000),
    progress: Math.max(0, Math.min(100, (remainingMs / totalMs) * 100))
  };
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [mode, setMode] = useState<Mode>(getInitialRoomCode() ? "join" : "host");
  const [joinCode, setJoinCode] = useState(getInitialRoomCode());
  const [name, setName] = useState(localStorage.getItem("gwsi:name") ?? "");
  const [gameType, setGameType] = useState<GameType>("four-pics");
  const [roundCount, setRoundCount] = useState(5);
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState("");
  const [busyAction, setBusyAction] = useState("");

  useEffect(() => {
    const nextSocket = io();
    setSocket(nextSocket);

    nextSocket.on("connect", () => setConnected(true));
    nextSocket.on("disconnect", () => setConnected(false));
    nextSocket.on("room:state", (state: RoomState) => {
      setRoomState(state);
      setJoinCode(state.roomCode);
      sessionStorage.setItem("gwsi:last-room", state.roomCode);
    });

    return () => {
      nextSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!socket || !connected || roomState) {
      return;
    }
    const code = getInitialRoomCode() || sessionStorage.getItem("gwsi:last-room") || "";
    const hostToken = code ? sessionStorage.getItem(`gwsi:host-token:${code}`) : null;
    if (!code || !hostToken) {
      return;
    }
    socket.emit("host:resume", { roomCode: code, hostToken }, (response: Ack) => {
      if (!response.ok) {
        sessionStorage.removeItem(`gwsi:host-token:${code}`);
      }
    });
  }, [connected, roomState, socket]);

  const leaderboard = useMemo(() => sortByScore(roomState?.players ?? []), [roomState?.players]);
  const activeChoices = useMemo(() => {
    if (!roomState) {
      return [];
    }
    return roomState.players.filter(
      (player) => roomState.activePlayerIds.includes(player.id) && player.id !== roomState.meId
    );
  }, [roomState]);

  function emitAction(event: string, payload: unknown = {}) {
    if (!socket) {
      setNotice("Connecting...");
      return Promise.resolve(false);
    }

    setBusyAction(event);
    setNotice("");
    return new Promise<boolean>((resolve) => {
      socket.emit(event, payload, (response: Ack) => {
        setBusyAction("");
        if (!response?.ok) {
          setNotice(response?.error ?? "Something went sideways.");
          resolve(false);
          return;
        }
        resolve(true);
      });
    });
  }

  function createRoom() {
    if (!socket) {
      setNotice("Connecting...");
      return;
    }
    setBusyAction("host:create");
    setNotice("");
    socket.emit("host:create", { roundCount: gameType === "guess-who" ? roundCount : 10, gameType }, (response: Ack) => {
      setBusyAction("");
      if (!response.ok || !response.roomCode || !response.hostToken) {
        setNotice(response.error ?? "Could not create a room.");
        return;
      }
      sessionStorage.setItem(`gwsi:host-token:${response.roomCode}`, response.hostToken);
      sessionStorage.setItem("gwsi:last-room", response.roomCode);
      setJoinCode(response.roomCode);
      setMode("host");
    });
  }

  function joinRoom(event: FormEvent) {
    event.preventDefault();
    if (!socket) {
      setNotice("Connecting...");
      return;
    }
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setNotice("Use a name with at least 2 characters.");
      return;
    }
    localStorage.setItem("gwsi:name", cleanName);
    setBusyAction("player:join");
    setNotice("");
    socket.emit(
      "player:join",
      {
        roomCode: joinCode,
        name: cleanName,
        playerId: getStoredPlayerId()
      },
      (response: Ack) => {
        setBusyAction("");
        if (!response.ok) {
          setNotice(response.error ?? "Could not join the room.");
          return;
        }
        setMode("join");
      }
    );
  }

  async function copyInvite() {
    if (!roomState) {
      return;
    }
    const invite = `${window.location.origin}${window.location.pathname}?room=${roomState.roomCode}`;
    try {
      await navigator.clipboard.writeText(invite);
      setNotice("Invite link copied.");
    } catch {
      setNotice(invite);
    }
  }

  async function submitAnswer(event: FormEvent) {
    event.preventDefault();
    const ok = await emitAction("player:submit", { answer });
    if (ok) {
      setAnswer("");
    }
  }

  async function submitWordAnswer(event: FormEvent) {
    event.preventDefault();
    const ok = await emitAction("player:word-answer", { answer });
    if (ok) {
      setAnswer("");
    }
  }

  if (!roomState) {
    return (
      <main className="app-shell">
        <section className="start-grid">
          <div className="start-panel">
            <div className="brand-row">
              <span className="brand-mark">
                <Sparkles size={22} />
              </span>
              <div>
                <p className="eyebrow">Live icebreaker</p>
                <h1>CDL Ice Breakers</h1>
              </div>
            </div>

            <div className="mode-switch" role="tablist" aria-label="Room mode">
              <button
                className={mode === "host" ? "active" : ""}
                type="button"
                onClick={() => setMode("host")}
              >
                <Crown size={18} />
                Host
              </button>
              <button
                className={mode === "join" ? "active" : ""}
                type="button"
                onClick={() => setMode("join")}
              >
                <LogIn size={18} />
                Join
              </button>
            </div>

            {mode === "host" ? (
              <div className="form-stack">
                <label className="field-label" htmlFor="game-type">
                  Game
                </label>
                <div className="game-switch" id="game-type">
                  {gameChoices.map((choice) => (
                    <button
                      key={choice.type}
                      type="button"
                      className={gameType === choice.type ? "selected" : ""}
                      onClick={() => setGameType(choice.type)}
                    >
                      <strong>{choice.title}</strong>
                      <span>{choice.description}</span>
                    </button>
                  ))}
                </div>
                {gameType === "guess-who" ? (
                  <>
                    <label className="field-label" htmlFor="rounds">
                      Rounds
                    </label>
                    <div className="stepper" id="rounds">
                      {[3, 5, 7].map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={roundCount === count ? "selected" : ""}
                          onClick={() => setRoundCount(count)}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="locked-rounds">
                    {gameType === "four-pics" ? <Timer size={18} /> : <BadgeCheck size={18} />}
                    {gameType === "four-pics" ? "10 questions | 20 sec each" : "10 questions"}
                  </div>
                )}
                <button
                  className="primary-action"
                  type="button"
                  onClick={createRoom}
                  disabled={!connected || busyAction === "host:create"}
                >
                  {busyAction === "host:create" ? <Loader2 className="spin" size={20} /> : <Play size={20} />}
                  Create {gameType === "four-pics" ? "word game" : gameType === "logo-quiz" ? "quiz" : "room"}
                </button>
              </div>
            ) : (
              <form className="form-stack" onSubmit={joinRoom}>
                <label className="field-label" htmlFor="room-code">
                  Room code
                </label>
                <input
                  id="room-code"
                  className="code-input"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="ABCD"
                />
                <label className="field-label" htmlFor="player-name">
                  Name
                </label>
                <input
                  id="player-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={28}
                  placeholder="Your name"
                />
                <button
                  className="primary-action"
                  type="submit"
                  disabled={!connected || busyAction === "player:join"}
                >
                  {busyAction === "player:join" ? <Loader2 className="spin" size={20} /> : <LogIn size={20} />}
                  Join room
                </button>
              </form>
            )}

            <StatusLine connected={connected} notice={notice} />
          </div>

          <StartVisualBoard gameType={gameType} />
        </section>
      </main>
    );
  }

  return (
    <main className="room-shell">
      <header className="room-topbar">
        <div className="room-title">
          <span className="brand-mark small">
            <Sparkles size={18} />
          </span>
          <div>
            <p className="eyebrow">Room</p>
            <h1>{roomState.roomCode}</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="icon-button wide" type="button" onClick={copyInvite} title="Copy invite link">
            <Clipboard size={18} />
            Copy invite
          </button>
          <ConnectionPill connected={connected} />
        </div>
      </header>

      <section className="room-grid">
        <div className="stage-panel">
          <RoundMeter state={roomState} />
          {roomState.phase === "lobby" && (
            <LobbyView
              state={roomState}
              busyAction={busyAction}
              onStart={() => emitAction("host:start")}
              onReset={() => emitAction("host:reset")}
            />
          )}
          {roomState.phase === "submit" && (
            <SubmitView
              state={roomState}
              answer={answer}
              busyAction={busyAction}
              onAnswerChange={setAnswer}
              onSubmit={submitAnswer}
            />
          )}
          {roomState.phase === "guess" && (
            <GuessView
              state={roomState}
              choices={activeChoices}
              busyAction={busyAction}
              onVote={(targetPlayerId) => emitAction("player:vote", { targetPlayerId })}
              onReveal={() => emitAction("host:reveal")}
            />
          )}
          {roomState.phase === "quiz" && (
            <LogoQuizView
              state={roomState}
              busyAction={busyAction}
              onAnswer={(optionId) => emitAction("player:quiz-answer", { optionId })}
              onReveal={() => emitAction("host:reveal")}
            />
          )}
          {roomState.phase === "word" && (
            <FourPicsView
              state={roomState}
              answer={answer}
              busyAction={busyAction}
              onAnswerChange={setAnswer}
              onSubmit={submitWordAnswer}
              onReveal={() => emitAction("host:reveal")}
            />
          )}
          {roomState.phase === "reveal" && (
            <RevealView state={roomState} busyAction={busyAction} onNext={() => emitAction("host:next")} />
          )}
          {roomState.phase === "quiz-reveal" && (
            <LogoQuizRevealView state={roomState} busyAction={busyAction} onNext={() => emitAction("host:next")} />
          )}
          {roomState.phase === "word-reveal" && (
            <FourPicsRevealView state={roomState} busyAction={busyAction} onNext={() => emitAction("host:next")} />
          )}
          {roomState.phase === "finished" && (
            <FinishedView state={roomState} busyAction={busyAction} onReset={() => emitAction("host:reset")} />
          )}
          <StatusLine connected={connected} notice={notice} />
        </div>

        <aside className="roster-panel">
          <div className="panel-heading">
            <Users size={20} />
            <h2>Players</h2>
          </div>
          <div className="player-list">
            {leaderboard.map((player, index) => (
              <PlayerRow key={player.id} player={player} rank={index + 1} />
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function StartVisualBoard({ gameType }: { gameType: GameType }) {
  if (gameType === "four-pics") {
    return (
      <div className="visual-board pics-visual" aria-hidden="true">
        <div className="visual-header">
          <span />
          <span />
          <span />
        </div>
        <div className="pics-preview-frame">
          <img src="/4pics1word/5.jpg" alt="" />
        </div>
        <div className="word-preview-badges">
          <span>G</span>
          <span>I</span>
          <span>F</span>
          <span>T</span>
        </div>
        <div className="mini-score">
          <Timer size={28} />
          <strong>20s</strong>
        </div>
      </div>
    );
  }

  if (gameType === "logo-quiz") {
    return (
      <div className="visual-board logo-visual" aria-hidden="true">
        <div className="visual-header">
          <span />
          <span />
          <span />
        </div>
        <div className="logo-visual-stack">
          {visualLogoSamples.map((option, index) => (
            <div className={`logo-preview-card preview-${index + 1}`} key={option.id}>
              <LogoMark option={option} />
              <span className="preview-label">{option.caption}</span>
            </div>
          ))}
        </div>
        <div className="mini-score">
          <Shapes size={28} />
          <strong>10Q</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="visual-board" aria-hidden="true">
      <div className="visual-header">
        <span />
        <span />
        <span />
      </div>
      <div className="answer-slip slip-one">I once gave a presentation with one shoe.</div>
      <div className="answer-slip slip-two">My comfort food is fries dipped in ice cream.</div>
      <div className="answer-slip slip-three">I can remember birthdays but not passwords.</div>
      <div className="mini-score">
        <Trophy size={28} />
        <strong>+1</strong>
      </div>
    </div>
  );
}

function StatusLine({ connected, notice }: { connected: boolean; notice: string }) {
  return (
    <div className="status-line" role="status">
      <span className={connected ? "dot online" : "dot"} />
      <span>{notice || (connected ? "Connected" : "Connecting")}</span>
    </div>
  );
}

function ConnectionPill({ connected }: { connected: boolean }) {
  return (
    <div className={`connection-pill ${connected ? "online" : ""}`}>
      <span />
      {connected ? "Live" : "Reconnecting"}
    </div>
  );
}

function RoundMeter({ state }: { state: RoomState }) {
  const currentRound = state.phase === "lobby" || state.phase === "finished" ? 0 : state.roundIndex + 1;
  const unit = state.gameType === "guess-who" ? "Round" : "Question";
  return (
    <div className="round-meter">
      <span>{state.phase === "finished" ? "Final scores" : `${unit} ${currentRound || 1} of ${state.roundCount}`}</span>
      <div className="meter-track">
        <span style={{ width: `${Math.max((currentRound / state.roundCount) * 100, 8)}%` }} />
      </div>
    </div>
  );
}

function LobbyView({
  state,
  busyAction,
  onStart
}: {
  state: RoomState;
  busyAction: string;
  onStart: () => void;
  onReset: () => void;
}) {
  const connectedPlayers = state.players.filter((player) => player.connected).length;
  const isLogoQuiz = state.gameType === "logo-quiz";
  const isFourPics = state.gameType === "four-pics";
  const minimumPlayers = state.gameType === "guess-who" ? 2 : 1;
  return (
    <section className="phase-view">
      <div className="phase-kicker">
        {isFourPics ? <Images size={18} /> : isLogoQuiz ? <Shapes size={18} /> : <Users size={18} />}
        {connectedPlayers} joined
      </div>
      <h2>Room code {state.roomCode}</h2>
      <p className="phase-copy">
        {isFourPics
          ? "Start the 10-question picture-word challenge when players are ready."
          : isLogoQuiz
            ? "Start the 10-question logo challenge when players are ready."
            : "Wait for the names to fill in, then start the first prompt."}
      </p>
      {state.isHost ? (
        <button
          className="primary-action fit"
          type="button"
          onClick={onStart}
          disabled={connectedPlayers < minimumPlayers || busyAction === "host:start"}
        >
          {busyAction === "host:start" ? <Loader2 className="spin" size={20} /> : <Play size={20} />}
          Start {state.gameType === "guess-who" ? "game" : "quiz"}
        </button>
      ) : (
        <div className="waiting-chip">
          <Loader2 className="spin" size={18} />
          Waiting for host
        </div>
      )}
    </section>
  );
}

function SubmitView({
  state,
  answer,
  busyAction,
  onAnswerChange,
  onSubmit
}: {
  state: RoomState;
  answer: string;
  busyAction: string;
  onAnswerChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <section className="phase-view">
      <PromptBlock prompt={state.prompt ?? ""} />
      <ProgressText done={state.submissionProgress.done} total={state.submissionProgress.total} label="submitted" />
      {state.isHost ? (
        <div className="waiting-chip">
          <Loader2 className="spin" size={18} />
          Collecting answers
        </div>
      ) : state.mySubmitted ? (
        <div className="success-panel">
          <CheckCircle2 size={26} />
          Answer locked in
        </div>
      ) : (
        <form className="answer-form" onSubmit={onSubmit}>
          <textarea
            value={answer}
            onChange={(event) => onAnswerChange(event.target.value)}
            maxLength={180}
            placeholder="Type your answer"
            autoFocus
          />
          <div className="form-footer">
            <span>{answer.trim().length}/180</span>
            <button
              className="primary-action fit"
              type="submit"
              disabled={answer.trim().length < 2 || busyAction === "player:submit"}
            >
              {busyAction === "player:submit" ? <Loader2 className="spin" size={20} /> : <Send size={20} />}
              Submit
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function GuessView({
  state,
  choices,
  busyAction,
  onVote,
  onReveal
}: {
  state: RoomState;
  choices: Player[];
  busyAction: string;
  onVote: (targetPlayerId: string) => void;
  onReveal: () => void;
}) {
  const currentAnswer = state.currentAnswer;
  return (
    <section className="phase-view">
      <AnswerTicket answer={currentAnswer?.text ?? ""} index={currentAnswer?.index ?? 1} total={currentAnswer?.total ?? 1} />
      <ProgressText done={state.voteProgress.done} total={state.voteProgress.total} label="voted" />
      {state.isHost && (
        <button
          className="secondary-action fit"
          type="button"
          onClick={onReveal}
          disabled={busyAction === "host:reveal"}
        >
          {busyAction === "host:reveal" ? <Loader2 className="spin" size={20} /> : <ChevronRight size={20} />}
          Reveal
        </button>
      )}
      {!state.isHost && currentAnswer?.isMine && (
        <div className="waiting-chip">
          <CheckCircle2 size={18} />
          This one is yours
        </div>
      )}
      {!state.isHost && state.eligibleToVote && (
        <div className="choice-grid">
          {choices.map((player) => (
            <button
              key={player.id}
              className={`choice-button ${state.myVote === player.id ? "selected" : ""}`}
              type="button"
              onClick={() => onVote(player.id)}
              disabled={Boolean(state.myVote) || busyAction === "player:vote"}
            >
              <Avatar player={player} />
              <span>{player.name}</span>
            </button>
          ))}
        </div>
      )}
      {!state.isHost && !state.eligibleToVote && !currentAnswer?.isMine && (
        <div className="waiting-chip">
          <Loader2 className="spin" size={18} />
          Vote received
        </div>
      )}
    </section>
  );
}

function LogoQuizView({
  state,
  busyAction,
  onAnswer,
  onReveal
}: {
  state: RoomState;
  busyAction: string;
  onAnswer: (optionId: string) => void;
  onReveal: () => void;
}) {
  const question = state.logoQuestion;
  if (!question) {
    return (
      <section className="phase-view">
        <div className="waiting-chip">
          <Loader2 className="spin" size={18} />
          Loading question
        </div>
      </section>
    );
  }

  const answered = Boolean(state.myQuizAnswer);

  return (
    <section className="phase-view quiz-view">
      <div className="phase-kicker">
        <Shapes size={18} />
        {question.brandName}
      </div>
      <h2>{question.prompt}</h2>
      <ProgressText done={state.quizProgress.done} total={state.quizProgress.total} label="answered" />
      <div className="logo-options">
        {question.options.map((option) => (
          <LogoOptionCard
            key={option.id}
            option={option}
            selected={state.myQuizAnswer === option.id}
            disabled={state.isHost || answered || busyAction === "player:quiz-answer"}
            onChoose={state.isHost ? undefined : () => onAnswer(option.id)}
          />
        ))}
      </div>
      {state.isHost ? (
        <button
          className="secondary-action fit"
          type="button"
          onClick={onReveal}
          disabled={busyAction === "host:reveal"}
        >
          {busyAction === "host:reveal" ? <Loader2 className="spin" size={20} /> : <ChevronRight size={20} />}
          Reveal answer
        </button>
      ) : answered ? (
        <div className="waiting-chip">
          <CheckCircle2 size={18} />
          Answer locked in
        </div>
      ) : (
        <div className="waiting-chip quiet">
          <Shapes size={18} />
          Pick the correct logo
        </div>
      )}
    </section>
  );
}

function FourPicsView({
  state,
  answer,
  busyAction,
  onAnswerChange,
  onSubmit,
  onReveal
}: {
  state: RoomState;
  answer: string;
  busyAction: string;
  onAnswerChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onReveal: () => void;
}) {
  const question = state.wordQuestion;
  const timer = useCountdownSeconds(state.questionEndsAt, state.questionDurationMs);

  if (!question) {
    return (
      <section className="phase-view">
        <div className="waiting-chip">
          <Loader2 className="spin" size={18} />
          Loading puzzle
        </div>
      </section>
    );
  }

  const answered = Boolean(state.myWordAnswer);

  return (
    <section className="phase-view word-view">
      <div className="word-header">
        <div>
          <div className="phase-kicker">
            <Images size={18} />
            4 Pics 1 Word
          </div>
          <h2>{question.prompt}</h2>
        </div>
        <QuestionTimer remainingSeconds={timer.remainingSeconds} progress={timer.progress} />
      </div>

      <div className="word-grid">
        <div className="word-image-frame">
          <img src={question.image} alt="4 Pics 1 Word puzzle" />
        </div>
        <div className="word-play-panel">
          <ProgressText done={state.wordProgress.done} total={state.wordProgress.total} label="answered" />
          <AnswerSlots length={question.answerLength} />
          {state.isHost ? (
            <button
              className="secondary-action fit"
              type="button"
              onClick={onReveal}
              disabled={busyAction === "host:reveal"}
            >
              {busyAction === "host:reveal" ? <Loader2 className="spin" size={20} /> : <ChevronRight size={20} />}
              Reveal answer
            </button>
          ) : answered ? (
            <div className="success-panel">
              <CheckCircle2 size={26} />
              Guess locked in: {state.myWordAnswer}
            </div>
          ) : (
            <form className="word-answer-form" onSubmit={onSubmit}>
              <label className="field-label" htmlFor="word-answer">
                Your guess
              </label>
              <input
                id="word-answer"
                value={answer}
                onChange={(event) => onAnswerChange(event.target.value.toUpperCase())}
                maxLength={Math.max(question.answerLength + 4, 12)}
                placeholder={`${question.answerLength} letters`}
                autoComplete="off"
                autoFocus
              />
              <button
                className="primary-action fit"
                type="submit"
                disabled={answer.trim().length < 1 || busyAction === "player:word-answer" || timer.remainingSeconds <= 0}
              >
                {busyAction === "player:word-answer" ? <Loader2 className="spin" size={20} /> : <Send size={20} />}
                Submit
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function FourPicsRevealView({
  state,
  busyAction,
  onNext
}: {
  state: RoomState;
  busyAction: string;
  onNext: () => void;
}) {
  const question = state.wordQuestion;
  const reveal = state.wordReveal;
  const isLastQuestion = state.roundIndex + 1 >= state.roundCount;
  const nextLabel = isLastQuestion ? "Finish" : "Next question";

  return (
    <section className="phase-view word-view">
      <div className="word-header">
        <div>
          <div className="phase-kicker">
            <BadgeCheck size={18} />
            Answer reveal
          </div>
          <h2>{reveal?.answer ?? "Solved"}</h2>
        </div>
        <div className="answer-points">
          <strong>+1</strong>
          <span>correct</span>
        </div>
      </div>

      <div className="word-grid">
        <div className="word-image-frame revealed">
          <img src={reveal?.revealImage ?? question?.image ?? ""} alt="Solved 4 Pics 1 Word puzzle" />
        </div>
        <div className="word-play-panel">
          <div className="reveal-banner quiz-correct-banner">
            <CheckCircle2 size={22} />
            <span>{reveal?.answer ?? "Correct answer"}</span>
          </div>
          <div className="vote-list">
            {reveal?.answers.map((answerRow) => (
              <div className={answerRow.isCorrect ? "vote-row correct" : "vote-row"} key={answerRow.playerId}>
                <span>{answerRow.playerName}</span>
                {answerRow.isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                <strong>{answerRow.answer}</strong>
                <small>{answerRow.points ? `+${answerRow.points}` : "+0"}</small>
              </div>
            ))}
          </div>
          {state.isHost ? (
            <button className="primary-action fit" type="button" onClick={onNext} disabled={busyAction === "host:next"}>
              {busyAction === "host:next" ? <Loader2 className="spin" size={20} /> : <ChevronRight size={20} />}
              {nextLabel}
            </button>
          ) : (
            <div className="waiting-chip">
              <Loader2 className="spin" size={18} />
              Waiting for host
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function QuestionTimer({ remainingSeconds, progress }: { remainingSeconds: number; progress: number }) {
  return (
    <div className={`question-timer ${remainingSeconds <= 5 ? "urgent" : ""}`}>
      <Timer size={20} />
      <strong>{remainingSeconds}s</strong>
      <span>left</span>
      <div className="timer-track">
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function AnswerSlots({ length }: { length: number }) {
  return (
    <div className="answer-slots" aria-label={`${length} letter answer`}>
      {Array.from({ length }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

function LogoQuizRevealView({
  state,
  busyAction,
  onNext
}: {
  state: RoomState;
  busyAction: string;
  onNext: () => void;
}) {
  const question = state.logoQuestion;
  const reveal = state.quizReveal;
  const isLastQuestion = state.roundIndex + 1 >= state.roundCount;
  const nextLabel = isLastQuestion ? "Finish" : "Next question";

  return (
    <section className="phase-view quiz-view">
      <div className="phase-kicker">
        <BadgeCheck size={18} />
        Correct logo
      </div>
      <h2>{question?.brandName ?? "Logo"} reveal</h2>
      {question && (
        <div className="logo-options reveal-options">
          {question.options.map((option) => {
            const isCorrect = reveal?.correctOptionId === option.id;
            const selected = state.myQuizAnswer === option.id;
            return (
              <LogoOptionCard
                key={option.id}
                option={option}
                selected={selected}
                correct={isCorrect}
                wrong={selected && !isCorrect}
                disabled
              />
            );
          })}
        </div>
      )}
      <div className="reveal-banner quiz-correct-banner">
        <CheckCircle2 size={22} />
        <span>{reveal?.correctLabel ?? "Correct answer"}</span>
      </div>
      <p className="phase-copy">{reveal?.explanation}</p>
      <div className="vote-list">
        {reveal?.answers.map((answer) => (
          <div className={answer.isCorrect ? "vote-row correct" : "vote-row"} key={answer.playerId}>
            <span>{answer.playerName}</span>
            {answer.isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <strong>{answer.optionLabel}</strong>
          </div>
        ))}
      </div>
      {state.isHost ? (
        <button className="primary-action fit" type="button" onClick={onNext} disabled={busyAction === "host:next"}>
          {busyAction === "host:next" ? <Loader2 className="spin" size={20} /> : <ChevronRight size={20} />}
          {nextLabel}
        </button>
      ) : (
        <div className="waiting-chip">
          <Loader2 className="spin" size={18} />
          Waiting for host
        </div>
      )}
    </section>
  );
}

function RevealView({
  state,
  busyAction,
  onNext
}: {
  state: RoomState;
  busyAction: string;
  onNext: () => void;
}) {
  const reveal = state.reveal;
  const isLastAnswer = state.currentAnswer ? state.currentAnswer.index === state.currentAnswer.total : false;
  const isLastRound = state.roundIndex + 1 >= state.roundCount;
  const nextLabel = isLastAnswer ? (isLastRound ? "Finish" : "Next round") : "Next answer";

  return (
    <section className="phase-view">
      <AnswerTicket answer={state.currentAnswer?.text ?? ""} index={state.currentAnswer?.index ?? 1} total={state.currentAnswer?.total ?? 1} />
      <div className="reveal-banner">
        <Crown size={22} />
        <span>{reveal?.authorName ?? "Someone"}</span>
      </div>
      <div className="vote-list">
        {reveal?.votes.length ? (
          reveal.votes.map((vote) => (
            <div className={vote.isCorrect ? "vote-row correct" : "vote-row"} key={`${vote.voterId}-${vote.targetId}`}>
              <span>{vote.voterName}</span>
              <ChevronRight size={16} />
              <strong>{vote.targetName}</strong>
            </div>
          ))
        ) : (
          <div className="vote-row muted">No guesses landed before reveal</div>
        )}
      </div>
      {reveal?.authorBonus && <p className="bonus-line">Author bonus: fooled {reveal.fooledCount}</p>}
      {state.isHost ? (
        <button className="primary-action fit" type="button" onClick={onNext} disabled={busyAction === "host:next"}>
          {busyAction === "host:next" ? <Loader2 className="spin" size={20} /> : <ChevronRight size={20} />}
          {nextLabel}
        </button>
      ) : (
        <div className="waiting-chip">
          <Loader2 className="spin" size={18} />
          Waiting for host
        </div>
      )}
    </section>
  );
}

function FinishedView({
  state,
  busyAction,
  onReset
}: {
  state: RoomState;
  busyAction: string;
  onReset: () => void;
}) {
  const winners = sortByScore(state.players).slice(0, 3);
  const isLogoQuiz = state.gameType === "logo-quiz";
  const isFourPics = state.gameType === "four-pics";
  return (
    <section className="phase-view">
      <div className="phase-kicker">
        {isFourPics ? <Images size={18} /> : isLogoQuiz ? <Shapes size={18} /> : <Trophy size={18} />}
        Final
      </div>
      <h2>{isFourPics ? "Word champs" : isLogoQuiz ? "Logo champs" : "Top guesses"}</h2>
      <div className="podium">
        {winners.map((player, index) => (
          <div className={`podium-place place-${index + 1}`} key={player.id}>
            <Avatar player={player} />
            <strong>{player.name}</strong>
            <span>{player.score} pts</span>
          </div>
        ))}
      </div>
      {state.isHost && (
        <button className="secondary-action fit" type="button" onClick={onReset} disabled={busyAction === "host:reset"}>
          {busyAction === "host:reset" ? <Loader2 className="spin" size={20} /> : <RefreshCw size={20} />}
          New game
        </button>
      )}
    </section>
  );
}

function LogoOptionCard({
  option,
  selected = false,
  correct = false,
  wrong = false,
  disabled = false,
  onChoose
}: {
  option: LogoOption;
  selected?: boolean;
  correct?: boolean;
  wrong?: boolean;
  disabled?: boolean;
  onChoose?: () => void;
}) {
  const className = [
    "logo-choice-card",
    selected ? "selected" : "",
    correct ? "correct" : "",
    wrong ? "wrong" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={className} type="button" onClick={onChoose} disabled={disabled || !onChoose}>
      <LogoMark option={option} />
      <span className="logo-option-copy">
        <strong>{option.label}</strong>
        <small>{option.caption}</small>
      </span>
    </button>
  );
}

function LogoMark({ option }: { option: LogoOption }) {
  switch (option.logoKey) {
    case "google-real":
      return <GoogleWord colors={["blue", "red", "yellow", "blue", "green", "red"]} />;
    case "google-swap":
      return <GoogleWord colors={["green", "red", "yellow", "blue", "blue", "red"]} />;
    case "google-muted":
      return <GoogleWord colors={["muted", "muted", "muted", "muted", "muted", "muted"]} />;
    case "youtube-real":
      return <PlayBadge color="red" shape="rounded" />;
    case "youtube-circle":
      return <PlayBadge color="red" shape="circle" />;
    case "youtube-dark":
      return <PlayBadge color="dark" shape="rounded" />;
    case "spotify-real":
      return <WaveBadge color="green" shape="circle" />;
    case "spotify-blue":
      return <WaveBadge color="blue" shape="circle" />;
    case "spotify-square":
      return <WaveBadge color="green" shape="square" />;
    case "target-real":
      return <TargetMark variant="real" />;
    case "target-blue":
      return <TargetMark variant="blue" />;
    case "target-inverted":
      return <TargetMark variant="inverted" />;
    case "mcdonalds-real":
      return <ArchMark color="gold" />;
    case "mcdonalds-red":
      return <ArchMark color="red" />;
    case "mcdonalds-blue":
      return <ArchMark color="blue" />;
    case "microsoft-real":
      return <PaneMark variant="real" />;
    case "microsoft-purple":
      return <PaneMark variant="purple" />;
    case "microsoft-mono":
      return <PaneMark variant="mono" />;
    case "instagram-real":
      return <CameraMark variant="gradient-square" />;
    case "instagram-blue":
      return <CameraMark variant="blue" />;
    case "instagram-circle":
      return <CameraMark variant="gradient-circle" />;
    case "amazon-real":
      return <SmileWord color="orange" placement="under" />;
    case "amazon-blue":
      return <SmileWord color="blue" placement="under" />;
    case "amazon-over":
      return <SmileWord color="orange" placement="over" />;
    case "apple-real":
      return <AppleMark variant="bite" />;
    case "apple-no-bite":
      return <AppleMark variant="plain" />;
    case "apple-stem":
      return <AppleMark variant="stem" />;
    case "nike-real":
      return <SwooshMark variant="up" />;
    case "nike-double":
      return <SwooshMark variant="double" />;
    case "nike-down":
      return <SwooshMark variant="down" />;
    default:
      return (
        <div className="logo-mark generic-mark">
          <Shapes size={34} />
          <strong>{option.brand}</strong>
        </div>
      );
  }
}

function GoogleWord({ colors }: { colors: string[] }) {
  return (
    <div className="logo-mark google-word" aria-label="Google-style wordmark">
      {"Google".split("").map((letter, index) => (
        <span className={`google-${colors[index]}`} key={`${letter}-${index}`}>
          {letter}
        </span>
      ))}
    </div>
  );
}

function PlayBadge({ color, shape }: { color: "red" | "dark"; shape: "rounded" | "circle" }) {
  return (
    <div className={`logo-mark play-badge ${color} ${shape}`}>
      <span />
    </div>
  );
}

function WaveBadge({ color, shape }: { color: "green" | "blue"; shape: "circle" | "square" }) {
  return (
    <div className={`logo-mark wave-badge ${color} ${shape}`}>
      <span />
      <span />
      <span />
    </div>
  );
}

function TargetMark({ variant }: { variant: "real" | "blue" | "inverted" }) {
  return (
    <div className={`logo-mark target-mark ${variant}`}>
      <span />
    </div>
  );
}

function ArchMark({ color }: { color: "gold" | "red" | "blue" }) {
  return (
    <div className={`logo-mark arch-mark ${color}`}>
      <span>M</span>
    </div>
  );
}

function PaneMark({ variant }: { variant: "real" | "purple" | "mono" }) {
  return (
    <div className={`logo-mark pane-mark ${variant}`}>
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function CameraMark({ variant }: { variant: "gradient-square" | "blue" | "gradient-circle" }) {
  return (
    <div className={`logo-mark camera-mark ${variant}`}>
      <span />
      <i />
    </div>
  );
}

function SmileWord({ color, placement }: { color: "orange" | "blue"; placement: "under" | "over" }) {
  return (
    <div className={`logo-mark smile-word ${color} ${placement}`}>
      <strong>amazon</strong>
      <span />
    </div>
  );
}

function AppleMark({ variant }: { variant: "bite" | "plain" | "stem" }) {
  return (
    <div className={`logo-mark apple-mark ${variant}`}>
      <span className="apple-leaf" />
      <span className="apple-body" />
      {variant === "bite" && <span className="apple-bite" />}
      {variant === "stem" && <span className="apple-stem" />}
    </div>
  );
}

function SwooshMark({ variant }: { variant: "up" | "double" | "down" }) {
  return (
    <div className={`logo-mark swoosh-mark ${variant}`}>
      <span />
      {variant === "double" && <span />}
    </div>
  );
}

function PromptBlock({ prompt }: { prompt: string }) {
  return (
    <div className="prompt-block">
      <span>Prompt</span>
      <h2>{prompt}</h2>
    </div>
  );
}

function AnswerTicket({ answer, index, total }: { answer: string; index: number; total: number }) {
  return (
    <div className="answer-ticket">
      <div className="ticket-meta">
        <span>Answer {index}</span>
        <span>{total}</span>
      </div>
      <p>{answer}</p>
    </div>
  );
}

function ProgressText({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <div className="progress-text">
      <span>{done}</span>
      <span>/</span>
      <span>{total}</span>
      <small>{label}</small>
    </div>
  );
}

function PlayerRow({ player, rank }: { player: Player; rank: number }) {
  const status = !player.connected ? "Offline" : player.isActive && player.hasSubmitted ? "Locked in" : "Ready";
  return (
    <div className={`player-row ${player.connected ? "" : "offline"}`}>
      <span className="rank">{rank}</span>
      <Avatar player={player} />
      <div className="player-copy">
        <strong>{player.name}</strong>
        <span>{status}</span>
      </div>
      <span className="score">{player.score}</span>
    </div>
  );
}

function Avatar({ player }: { player: Player }) {
  const initials = player.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return <span className={`avatar ${palette[player.colorIndex % palette.length]}`}>{initials}</span>;
}

export default App;
