// In-memory session store for bot users
// Maps telegramId -> { userId, accessToken, state, tempData }

interface UserSession {
  userId?: string;
  email?: string;
  username?: string;
  role?: string;
  balance?: number;
  state?: string;
  tempData?: Record<string, any>;
}

const sessions = new Map<number, UserSession>();

export function getSession(telegramId: number): UserSession {
  if (!sessions.has(telegramId)) {
    sessions.set(telegramId, {});
  }
  return sessions.get(telegramId)!;
}

export function setSession(telegramId: number, data: Partial<UserSession>): void {
  const current = getSession(telegramId);
  sessions.set(telegramId, { ...current, ...data });
}

export function clearSession(telegramId: number): void {
  sessions.set(telegramId, {});
}

export function isLoggedIn(telegramId: number): boolean {
  const session = getSession(telegramId);
  return !!session.userId;
}
