import { useEffect, useState } from "react";
import { DEFAULT_SPORT_ID, welcomeTextFor } from "../sports";

const STORAGE_KEY = "cricket-chatbot-sessions";
const TITLE_MAX_LENGTH = 40;

function createSession(sportId = DEFAULT_SPORT_ID) {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    sport: sportId,
    messages: [{ role: "assistant", text: welcomeTextFor(sportId) }],
    updatedAt: Date.now(),
  };
}

function truncateTitle(text) {
  const trimmed = text.trim();
  return trimmed.length > TITLE_MAX_LENGTH ? `${trimmed.slice(0, TITLE_MAX_LENGTH)}…` : trimmed;
}

// Sessions saved before the multi-sport feature existed have no `sport` field;
// default them to cricket so old chat history keeps working.
function normalizeSession(session) {
  return { sport: DEFAULT_SPORT_ID, ...session };
}

function loadInitialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.sessions?.length) {
        return { ...parsed, sessions: parsed.sessions.map(normalizeSession) };
      }
    }
  } catch {
    // corrupt or unavailable storage; fall through to a fresh session
  }
  const session = createSession();
  return { sessions: [session], activeSessionId: session.id };
}

export function useChatSessions() {
  const [state, setState] = useState(loadInitialState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full/unavailable; conversation still works for this tab session
    }
  }, [state]);

  const activeSession =
    state.sessions.find((s) => s.id === state.activeSessionId) ?? state.sessions[0];

  const newChat = (sportId = DEFAULT_SPORT_ID) => {
    const session = createSession(sportId);
    setState((prev) => ({
      sessions: [session, ...prev.sessions],
      activeSessionId: session.id,
    }));
  };

  const selectSession = (id) => {
    setState((prev) => ({ ...prev, activeSessionId: id }));
  };

  const deleteSession = (id) => {
    setState((prev) => {
      const remaining = prev.sessions.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        const session = createSession();
        return { sessions: [session], activeSessionId: session.id };
      }
      const activeSessionId = prev.activeSessionId === id ? remaining[0].id : prev.activeSessionId;
      return { sessions: remaining, activeSessionId };
    });
  };

  const updateSessionMessages = (id, updater) => {
    setState((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== id) return s;
        const messages = typeof updater === "function" ? updater(s.messages) : updater;
        const title =
          s.title === "New chat" && messages[1]?.role === "user"
            ? truncateTitle(messages[1].text)
            : s.title;
        return { ...s, messages, title, updatedAt: Date.now() };
      }),
    }));
  };

  // Only meaningful before the first real question is asked (still just the
  // welcome message) — switching sport mid-conversation would be confusing.
  const updateSessionSport = (id, sportId) => {
    setState((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === id
          ? { ...s, sport: sportId, messages: [{ role: "assistant", text: welcomeTextFor(sportId) }] }
          : s
      ),
    }));
  };

  return {
    sessions: [...state.sessions].sort((a, b) => b.updatedAt - a.updatedAt),
    activeSession,
    newChat,
    selectSession,
    deleteSession,
    updateSessionMessages,
    updateSessionSport,
  };
}
