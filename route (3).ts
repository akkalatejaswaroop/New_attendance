import argon2 from "argon2";
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
      id:string; email:string; password_hash:string; role:"hod"|"faculty"|"student";
      student_id:string|null; faculty_id:string|null; active:boolean
    }>(
      `SELECT id, email, password_hash, role, student_id, faculty_id, active
       FROM public.campus_users WHERE lower(email)=lower($1) LIMIT 1`, [body.email]
    );
    const user = result.rows[0];
    // Keep the same outward error for unknown email and wrong password.
    if (!user || !user.active || !(await argon2.verify(user.password_hash, body.password).catch(()=>false))) {
      return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }
    await createSession(user);
    return Response.json({ user: { email:user.email, role:user.role } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error:"Invalid input" }, { status:400 });
    console.error("Login error", error);
    return Response.json({ error:"Unable to sign in" }, { status:500 });
  }
}
