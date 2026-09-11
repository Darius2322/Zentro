import { cookies } from "next/headers";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import type { PlatformRole } from "@prisma/client";

/**
 * Session shape. `businessId` is only meaningful for BUSINESS_OWNER and
 * STAFF sessions — it is the ONE business that user is allowed to touch.
 * It is set once at login by re-deriving it from the database (never from
 * anything the client sends) and is what every tenant-scoped route checks
 * against, regardless of which :slug appears in the URL (spec #57).
 */
export interface SessionData {
  userId: string;
  role: PlatformRole;
  businessId?: string;
  email: string;
  fullName: string;
}

const sessionOptions: SessionOptions = {
  password: requireSecret(),
  cookieName: "zentro_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  },
};

function requireSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters. See .env.example."
    );
  }
  return secret;
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function destroySession() {
  const session = await getSession();
  session.destroy();
}
