import type { Message } from './api';
export function upsertMessages(
  existing: Message[],
  incoming: Message[],
): Message[] {
  const records = new Map(existing.map(message => [message.id, message]));
  for (const message of incoming) {
    records.set(message.id, message);
  }
  return [...records.values()].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}
export interface ChatState {
  sessionKey: string;
  messages: Record<string, Message[]>;
  drafts: Record<string, string>;
  endedIds: string[];
}
export function freshChatState(sessionKey: string): ChatState {
  return { sessionKey, messages: {}, drafts: {}, endedIds: [] };
}
export type ChatAction =
  | { type: 'session'; sessionKey: string }
  | {
      type: 'messages';
      sessionKey: string;
      matchId: string;
      messages: Message[];
    }
  | { type: 'draft'; sessionKey: string; matchId: string; text: string }
  | { type: 'ended'; sessionKey: string; matchId: string };
export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === 'session') {
    return freshChatState(action.sessionKey);
  }
  if (action.sessionKey !== state.sessionKey) {
    return state;
  }
  if (action.type !== 'ended' && state.endedIds.includes(action.matchId)) {
    return state;
  }
  if (action.type === 'messages') {
    return {
      ...state,
      messages: {
        ...state.messages,
        [action.matchId]: upsertMessages(
          state.messages[action.matchId] ?? [],
          action.messages,
        ),
      },
    };
  }
  if (action.type === 'draft') {
    return {
      ...state,
      drafts: { ...state.drafts, [action.matchId]: action.text },
    };
  }
  const messages = { ...state.messages };
  const drafts = { ...state.drafts };
  delete messages[action.matchId];
  delete drafts[action.matchId];
  return {
    ...state,
    messages,
    drafts,
    endedIds: [...new Set([...state.endedIds, action.matchId])],
  };
}
export function newClientMessageId(): string {
  // Idempotency identifier, not an authentication credential.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r % 4) + 8).toString(16);
  });
}
