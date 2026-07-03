import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Crown,
  Loader2,
  LogIn,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Trophy,
  Users
} from "lucide-react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";

type Phase = "lobby" | "submit" | "guess" | "reveal" | "finished";
type Mode = "host" | "join";

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

type RoomState = {
  roomCode: string;
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
  currentAnswer: { index: number; total: number; text: string; isMine: boolean } | null;
  reveal: Reveal | null;
  mySubmitted: boolean;
  myVote: string | null;
  eligibleToVote: boolean;
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

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [mode, setMode] = useState<Mode>(getInitialRoomCode() ? "join" : "host");
  const [joinCode, setJoinCode] = useState(getInitialRoomCode());
  const [name, setName] = useState(localStorage.getItem("gwsi:name") ?? "");
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
    socket.emit("host:create", { roundCount }, (response: Ack) => {
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
                <p className="eyebrow">Guess Who Said It</p>
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
                <button
                  className="primary-action"
                  type="button"
                  onClick={createRoom}
                  disabled={!connected || busyAction === "host:create"}
                >
                  {busyAction === "host:create" ? <Loader2 className="spin" size={20} /> : <Play size={20} />}
                  Create room
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
          {roomState.phase === "reveal" && (
            <RevealView state={roomState} busyAction={busyAction} onNext={() => emitAction("host:next")} />
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
  return (
    <div className="round-meter">
      <span>{state.phase === "finished" ? "Final scores" : `Round ${currentRound || 1} of ${state.roundCount}`}</span>
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
  return (
    <section className="phase-view">
      <div className="phase-kicker">
        <Users size={18} />
        {connectedPlayers} joined
      </div>
      <h2>Room code {state.roomCode}</h2>
      <p className="phase-copy">Wait for the names to fill in, then start the first prompt.</p>
      {state.isHost ? (
        <button
          className="primary-action fit"
          type="button"
          onClick={onStart}
          disabled={connectedPlayers < 2 || busyAction === "host:start"}
        >
          {busyAction === "host:start" ? <Loader2 className="spin" size={20} /> : <Play size={20} />}
          Start game
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
  return (
    <section className="phase-view">
      <div className="phase-kicker">
        <Trophy size={18} />
        Final
      </div>
      <h2>Top guesses</h2>
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
  return (
    <div className={`player-row ${player.connected ? "" : "offline"}`}>
      <span className="rank">{rank}</span>
      <Avatar player={player} />
      <div className="player-copy">
        <strong>{player.name}</strong>
        <span>{player.connected ? "Ready" : "Offline"}</span>
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
