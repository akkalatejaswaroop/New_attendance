export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "@/lib/db";
import { createSession } from "@/lib/auth";

const schema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200)
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const result = await query<{
      id: string; email: string; password_hash: string; role: "hod" | "faculty" | "student";
      student_id: string | null; faculty_id: string | null; active: boolean; must_change_password: boolean
    }>(
      `SELECT id, email, password_hash, role, student_id, faculty_id, active, must_change_password
       FROM public.campus_users WHERE lower(email)=lower($1) LIMIT 1`, [body.email]
    );
    const user = result.rows[0];
    if (!user || !user.active || !(await bcrypt.compare(body.password, user.password_hash).catch(() => false))) {
      return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await query("UPDATE public.campus_users SET last_login_at = now() WHERE id = $1", [user.id]);
    await createSession(user);
    return Response.json({
      user: { email: user.email, role: user.role },
      mustChangePassword: user.must_change_password
    });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Enter a valid email and password" }, { status: 400 });
    console.error("Login error", error);
    return Response.json({ error: "Unable to sign in. Please try again." }, { status: 500 });
  }
}
