import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export type Role = "hod" | "faculty" | "student";
export type AuthUser = { id: string; email: string; role: Role; student_id: string | null; faculty_id: string | null };

const COOKIE = "campus_attend_session";
const secret = () => {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(value);
};

export async function createSession(user: AuthUser) {
  const token = await new SignJWT({ email: user.email, role: user.role, student_id: user.student_id, faculty_id: user.faculty_id })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 8 * 60 * 60
  });
}

export async function currentUser(): Promise<AuthUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const id = String(payload.sub || "");
    if (!id) return null;
    // Fetch current role/status on every request so role revocation takes effect.
    const result = await query<AuthUser & { active: boolean }>(
      `SELECT id, email, role, student_id, faculty_id, active
       FROM public.campus_users WHERE id = $1 LIMIT 1`, [id]
    );
    const user = result.rows[0];
    return user?.active ? user : null;
  } catch {
    return null;
  }
}

export async function requireRole(roles: Role[]) {
  const user = await currentUser();
  if (!user) throw new AuthError(401, "Authentication required");
  if (!roles.includes(user.role)) throw new AuthError(403, "Insufficient permissions");
  return user;
}

export class AuthError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function apiError(error: unknown) {
  if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
  console.error("CampusAttend API error", error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
