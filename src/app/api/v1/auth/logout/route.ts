import { cookies } from "next/headers";
export async function POST() {
  cookies().delete("campus_attend_session");
  return Response.redirect(new URL("/login", process.env.APP_ORIGIN || "http://localhost:3000"), 303);
}
