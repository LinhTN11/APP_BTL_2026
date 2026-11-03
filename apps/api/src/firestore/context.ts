import {
  applicationDefault,
  deleteApp,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import type { Server } from "socket.io";
import { mkdir } from "node:fs/promises";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fail } from "../shared.js";
export { ApiError, fail, hash, uid } from "../shared.js";

export interface FirestoreOptions {
  projectId?: string;
  namespace?: string;
  emulatorHost?: string;
  dataDir?: string;
  demoMode?: boolean;
  seedDemo?: boolean;
  now?: () => number;
  sessionTtlMs?: number;
  otpTtlMs?: number;
  logger?: boolean;
}
export class FirestoreContext {
  io!: Server;
  readonly firebaseAuth;
  readonly root;
  readonly config;
  readonly database;
  constructor(
    public db: Firestore,
    private adminApp: App,
    options: FirestoreOptions & { projectId: string; emulatorHost?: string }
  ) {
    this.firebaseAuth = getAuth(adminApp);
    const namespace = options.namespace ?? "app-cuoi-ky";
    this.root = db.collection("projects").doc(namespace);
    this.config = {
      namespace,
      dataDir: resolve(options.dataDir ?? process.env.DATA_DIR ?? "data"),
      demoMode: options.demoMode ?? process.env.DEMO_MODE === "true",
      now: options.now ?? Date.now,
      sessionTtlMs: options.sessionTtlMs ?? 86_400_000,
      otpTtlMs: Math.min(options.otpTtlMs ?? 300_000, 300_000),
    };
    this.database = {
      provider: "firestore" as const,
      mode: options.emulatorHost ? ("emulator" as const) : ("cloud" as const),
      projectId: options.projectId,
      namespace,
    };
  }
  collection(name: string) {
    return this.root.collection(name);
  }
  ref(name: string, id: string) {
    return this.collection(name).doc(id);
  }
  date() {
    return new Date(this.config.now()).toISOString();
  }
  age(dob: unknown) {
    if (typeof dob !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return 0;
    const parsed = new Date(dob + "T00:00:00Z");
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== dob
    )
      return 0;
    const now = new Date(this.config.now());
    return (
      now.getUTCFullYear() -
      Number(dob.slice(0, 4)) -
      (now.toISOString().slice(5, 10) < dob.slice(5) ? 1 : 0)
    );
  }
  availableUser(user: { accountStatus?: unknown; demoAccount?: unknown; mode?: unknown } | undefined) {
    return !!user && user.accountStatus === "active" &&
      (this.config.demoMode || (!user.demoAccount && user.mode !== "demo"));
  }
  async user(id: string) {
    const [user, profile] = await this.db.getAll(this.ref("users", id), this.ref("profiles", id));
    const p = profile.data();
    if (!this.availableUser(user.data()) || !p) return fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ");
    return { id, displayName: p.displayName };
  }
  async blocked(a: string, b: string) {
    const docs = await this.db.getAll(
      this.ref("blocks", `${a}_${b}`),
      this.ref("blocks", `${b}_${a}`)
    );
    return docs.some((x) => x.exists);
  }
  async target(actor: string, id: string) {
    if (actor === id) fail(422, "SELF_ACTION", "Không thể chọn chính mình");
    const u = (await this.ref("users", id).get()).data();
    if (!this.availableUser(u))
      fail(404, "NOT_FOUND", "Không tìm thấy hồ sơ");
  }
  async profile(id: string, own = false): Promise<any> {
    const { firestoreProfile } = await import("./profiles.js");
    return firestoreProfile(this, id, own);
  }
  async complete(id: string) {
    const p = await this.profile(id);
    return (
      p.age >= 18 &&
      !!p.displayName.trim() &&
      !!p.bio.trim() &&
      p.media.length > 0
    );
  }
  async close() {
    await this.db.terminate();
    await deleteApp(this.adminApp);
  }
}
export async function createFirestoreContext(options: FirestoreOptions = {}) {
  const mode = process.env.DATABASE_MODE;
  if (
    mode !== undefined &&
    mode !== "firestore" &&
    mode !== "firestore-emulator"
  )
    throw new Error("DATABASE_MODE must be firestore or firestore-emulator.");
  const projectId = options.projectId ?? process.env.FIREBASE_PROJECT_ID;
  const namespace =
    options.namespace ?? process.env.FIRESTORE_NAMESPACE ?? "app-cuoi-ky";
  if (!projectId || !/^[a-z][a-z0-9-]{4,62}$/.test(projectId))
    throw new Error(
      "Set FIREBASE_PROJECT_ID to the intended Firebase project. No cloud project or SQLite fallback is created automatically."
    );
  if (!/^[a-z0-9-]{1,48}$/.test(namespace))
    throw new Error("FIRESTORE_NAMESPACE must match [a-z0-9-]{1,48}.");
  const envEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  // Admin Auth accepts unsigned tokens when this variable is set. Never let a
  // Firestore cloud process silently inherit an Auth emulator configuration.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST && !options.emulatorHost && mode !== "firestore-emulator")
    throw new Error("FIREBASE_AUTH_EMULATOR_HOST requires explicit Firestore emulator mode; cloud must verify signed Firebase tokens.");
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const authHost = /^(localhost|127\.0\.0\.1|\[::1\]):([0-9]{1,5})$/.exec(process.env.FIREBASE_AUTH_EMULATOR_HOST);
    if (!authHost || Number(authHost[2]) < 1 || Number(authHost[2]) > 65535)
      throw new Error("Firebase Auth emulator host must be an explicit loopback host:port.");
  }
  if (
    mode === "firestore-emulator" &&
    !options.emulatorHost &&
    !envEmulatorHost
  )
    throw new Error(
      "DATABASE_MODE=firestore-emulator requires an explicit FIRESTORE_EMULATOR_HOST loopback host:port."
    );
  if (mode === "firestore" && (options.emulatorHost || envEmulatorHost))
    throw new Error(
      "DATABASE_MODE=firestore cannot be combined with an emulator host."
    );
  if (mode === undefined && envEmulatorHost && !options.emulatorHost)
    throw new Error(
      "FIRESTORE_EMULATOR_HOST requires explicit DATABASE_MODE=firestore-emulator; cloud mode never silently uses an emulator."
    );
  if (
    options.emulatorHost &&
    envEmulatorHost &&
    options.emulatorHost !== envEmulatorHost
  )
    throw new Error(
      "Conflicting FIRESTORE_EMULATOR_HOST values in one process."
    );
  const emulatorHost =
    options.emulatorHost ??
    (mode === "firestore-emulator" ? envEmulatorHost : undefined);
  if (emulatorHost) {
    const match = /^(localhost|127\.0\.0\.1|\[::1\]):([0-9]{1,5})$/.exec(
      emulatorHost
    );
    if (!match || Number(match[2]) < 1 || Number(match[2]) > 65535)
      throw new Error(
        "Firestore emulator host must be an explicit loopback host:port."
      );
    process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
  }
  const demoMode = options.demoMode ?? process.env.DEMO_MODE === "true";
  const seedDemo = options.seedDemo || process.env.FIRESTORE_SEED_DEMO === "true";
  if (process.env.NODE_ENV === "production" && (emulatorHost || process.env.FIREBASE_AUTH_EMULATOR_HOST || demoMode || seedDemo))
    throw new Error("Production rejects emulator, demo and seed configuration.");
  if ((demoMode || seedDemo) && !emulatorHost)
    throw new Error("Demo and seed require explicit Firestore emulator mode.");
  if (seedDemo && !demoMode) throw new Error("Demo seeding requires explicit DEMO_MODE=true.");
  if (!emulatorHost && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    if (!isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS))
      throw new Error(
        "GOOGLE_APPLICATION_CREDENTIALS must be an absolute backend-local file path; never put service-account credentials in source or the mobile bundle."
      );
    try {
      await access(process.env.GOOGLE_APPLICATION_CREDENTIALS, constants.R_OK);
    } catch {
      throw new Error(
        "GOOGLE_APPLICATION_CREDENTIALS does not identify a readable credential file; no Firestore SDK was initialized."
      );
    }
  }
  const adminApp = initializeApp(
    {
      projectId,
      ...(!emulatorHost ? { credential: applicationDefault() } : {}),
    },
    `gap-${randomUUID()}`
  );
  const db = getFirestore(adminApp);
  const ctx = new FirestoreContext(db, adminApp, {
    ...options,
    projectId,
    namespace,
    emulatorHost,
  });
  try {
    await mkdir(join(ctx.config.dataDir, "media"), { recursive: true });
    await ctx.root.get(); // Validate the selected connection/credentials before the server listens.
    if (options.seedDemo) {
      const { seedFirestoreDemo } = await import("./seed.js");
      await seedFirestoreDemo(ctx);
    }
    return ctx;
  } catch (error) {
    await ctx.close();
    throw new Error(
      `Unable to connect to Firestore ${
        emulatorHost ? "emulator" : "cloud"
      }. Check project ID, emulator availability or ADC/GOOGLE_APPLICATION_CREDENTIALS. ${
        error instanceof Error ? error.message : ""
      }`,
      { cause: error }
    );
  }
}
