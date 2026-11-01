export type ProviderMode = "real" | "demo" | "unavailable";
export type Gender = "female" | "male" | "other";
export type DatingGoal = "relationship" | "friendship" | "casual" | "unsure";
export type LifestyleFrequency =
  | "never"
  | "sometimes"
  | "often"
  | "prefer_not_to_say";
export interface Lifestyle {
  zodiac?: string;
  smoking?: LifestyleFrequency;
  drinking?: LifestyleFrequency;
}
export interface Capability {
  name: string;
  mode: ProviderMode;
  reason?: string;
  provider?: "firestore";
  databaseMode?: "cloud" | "emulator";
  projectId?: string;
  namespace?: string;
  storage?: string;
  notice?: string;
}
export interface DatabaseStatus {
  provider: "firestore";
  mode: "cloud" | "emulator";
  projectId: string;
  namespace: string;
}
export interface AdvancedProfile {
  children?: "none" | "have" | "want" | "unsure" | "prefer_not_to_say" | null;
  heightCm?: number | null;
  education?: string | null;
  religion?: string | null;
  hometown?: string | null;
}
export interface AdvancedFilters extends Omit<AdvancedProfile, "heightCm"> {
  datingGoal?: DatingGoal | null;
  minHeightCm?: number | null;
  maxHeightCm?: number | null;
}
export interface User {
  id: string;
  displayName: string;
}
export interface Session {
  token: string;
  expiresAt: string;
  user: User;
}
export interface Media {
  id: string;
  kind: "image" | "video";
  url: string;
  position: number;
}
export interface Profile {
  userId: string;
  displayName: string;
  dateOfBirth?: string;
  age: number;
  gender: Gender;
  bio: string;
  datingGoal: DatingGoal;
  interests: string[];
  lifestyle: Lifestyle;
  media: Media[];
  verification?: { status: string; mode: ProviderMode };
  advanced?: AdvancedProfile;
  personality?: null;
  mood?: null;
}
export type PublicProfile = Omit<Profile, "dateOfBirth">;
export interface Preferences {
  genders: Gender[];
  minAge: number;
  maxAge: number;
  radiusKm: number;
  advancedFilters?: AdvancedFilters;
}
export interface Match {
  id: string;
  otherUser: User;
  status: "active" | "ended";
  createdAt: string;
}
export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  clientMessageId: string;
  kind: "text" | "gif" | "sticker" | "location";
  text?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}
export interface ApiSuccess<T> {
  data: T;
  meta?: {
    nextCursor: string | null;
    radiusAvailable?: boolean;
    reason?: string;
  };
}
export interface ApiError {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string>;
    requestId: string;
  };
}
export interface OtpChallenge {
  challengeId: string;
  expiresAt: string;
  mode: "demo";
  demoCode?: string;
}
export type DemoAccount = "A" | "B" | "C" | "D";
export interface Block {
  targetUserId: string;
  createdAt: string;
}
export interface Verification {
  status: "not_submitted" | "pending";
  mode: "demo";
  submittedAt?: string;
}
export type ProfilePatch = Partial<
  Pick<
    Profile,
    | "displayName"
    | "dateOfBirth"
    | "gender"
    | "bio"
    | "datingGoal"
    | "interests"
    | "lifestyle"
    | "advanced"
  >
>;
export type PreferencesPatch = Partial<Preferences>;
export interface LocationInput {
  latitude: number;
  longitude: number;
  consent: true;
}
export interface SwipeInput {
  targetUserId: string;
  action: "like" | "pass";
}
export interface SwipeResult {
  swipeId: string;
  match: Match | null;
}
export type MessageInput =
  | { clientMessageId: string; kind: "text"; text: string }
  | {
      clientMessageId: string;
      kind: "gif" | "sticker";
      payload: { catalogId: string };
    }
  | {
      clientMessageId: string;
      kind: "location";
      payload: { latitude: number; longitude: number };
    };
export interface ReportInput {
  targetUserId: string;
  reasonCode: string;
  detail?: string;
  matchId?: string;
}
export type SocketSubscribeAck =
  | { ok: true }
  | { ok: false; error: { code: string; message: string } };
export interface MatchEndedEvent {
  matchId: string;
  reason: "blocked" | "unmatched";
}
