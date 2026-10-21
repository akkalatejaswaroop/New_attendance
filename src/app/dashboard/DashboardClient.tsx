"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import QRCode from "qrcode";

type Data = {
  user: { id: string; email: string; role: "hod" | "faculty" | "student"; student_id: string | null; faculty_id: string | null };
  profile: any; summary: any; attendance: any[]; timetable: any[]; leaves: any[]; fines: any[];
  notifications: any[]; classrooms: any[]; students: any[]; assignments: any[]; finePerDayPaise: number;
};
type Session = { id: string; subject_code: string; year: number; section: string; dept: string; opens_at: string; closes_at: string; status: string; classroom_name?: string };

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(paise || 0) / 100);
const dateText = (value: string) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function DashboardClient({ initialRole, initialEmail }: { initialRole: string; initialEmail: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tab, setTab] = useState("Overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [qr, setQr] = useState<{ id: string; token: string; expires: string; image: string } | null>(null);
  const [fineAmount, setFineAmount] = useState("50");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        fetch("/api/v1/portal", { cache: "no-store" }),
        fetch("/api/v1/sessions/active", { cache: "no-store" })
      ]);
      if (!d.ok) throw new Error((await d.json()).error || "Unable to load dashboard");
      const payload = await d.json();
      setData(payload);
      setFineAmount(String(Number(payload.finePerDayPaise || 5000) / 100));
      if (s.ok) setSessions((await s.json()).sessions || []);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to load dashboard");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const send = useCallback(async (payload: Record<string, unknown>) => {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/v1/portal", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Action failed");
      setNotice("Saved successfully.");
      await refresh();
      return result;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Action failed");
      return null;
    } finally { setBusy(false); }
  }, [refresh]);

  const role = data?.user.role || initialRole;
  const tabs = role === "student"
    ? ["Overview", "Attendance", "Timetable", "Leave", "Fines", "Notifications"]
    : role === "faculty"
      ? ["Overview", "Sessions", "Classes", "Timetable", "Leave", "Attendance", "Notifications"]
      : ["Overview", "Sessions", "Students", "Timetable", "Leave", "Fine management", "Classrooms", "Notifications"];

  const openQr = async (sessionId: string) => {
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/v1/sessions/${sessionId}/qr`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not generate session QR");
      const image = await QRCode.toDataURL(result.token, { width: 240, margin: 2, errorCorrectionLevel: "M" });
      setQr({ id: sessionId, token: result.token, expires: result.expires_at, image });
      setNotice("A short-lived attendance QR has been generated.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "QR generation failed"); }
    finally { setBusy(false); }
  };

  const markAttendance = async (event: FormEvent<HTMLFormElement>, sessionId: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const token = String(form.get("qr_token") || "").trim();
    if (!token) { setNotice("Enter the token from the live classroom QR."); return; }
    if (!navigator.geolocation) { setNotice("This browser does not support location verification."); return; }
    setBusy(true); setNotice("");
    navigator.geolocation.getCurrentPosition(async position => {
      try {
        const response = await fetch("/api/v1/attendance/mark", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, qr_token: token, lat: position.coords.latitude, lng: position.coords.longitude, accuracy_m: position.coords.accuracy })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Attendance could not be recorded");
        setNotice("Attendance recorded successfully.");
        await refresh();
      } catch (e) { setNotice(e instanceof Error ? e.message : "Attendance failed"); }
      finally { setBusy(false); }
    }, error => {
      setNotice(error.code === 1 ? "Allow location permission to mark attendance." : "Could not verify location. Try again in an open area.");
      setBusy(false);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>, action: string, transform?: (form: FormData) => Record<string, unknown>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = transform ? transform(form) : Object.fromEntries(form.entries());
    const result = await send({ action, ...payload });
    if (result) event.currentTarget.reset();
  };

  const unpaidTotal = useMemo(() => data?.fines.filter(f => f.status === "unpaid").reduce((n, f) => n + Number(f.amount_paise), 0) || 0, [data]);

  if (loading && !data) return <main><div className="card"><h1>Loading your workspace…</h1><p>Connecting to CampusAttend.</p></div></main>;

  return <main className="dashboard">
    <div className="dash-top">
      <div><span className="pill">{role.toUpperCase()} WORKSPACE</span><h1 className="dash-title">Welcome back{data?.profile?.name ? `, ${data.profile.name.split(" ")[0]}` : ""}</h1><p>{data?.user.email || initialEmail} · Campus operations at a glance.</p></div>
      <form action="/api/v1/auth/logout" method="post"><button className="secondary-button" type="submit">Sign out</button></form>
    </div>
    {notice && <div className={notice.toLowerCase().includes("success") || notice.toLowerCase().includes("generated") ? "notice success" : "notice"} role="status">{notice}<button className="notice-close" onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
    <nav className="dash-tabs" aria-label="Dashboard sections">{tabs.map(t => <button key={t} className={tab === t ? "tab active" : "tab"} onClick={() => { setTab(t); setQr(null); }}>{t}</button>)}</nav>

    {tab === "Overview" && <>
      <section className="metric-grid">
        {(role === "student" ? [
          ["Attendance records", data?.summary?.attendanceRecords ?? 0],
          ["Present sessions", data?.summary?.present ?? 0],
          ["Pending leave", data?.summary?.pendingLeaves ?? 0],
          ["Outstanding fines", money(data?.summary?.fineBalancePaise ?? 0)]
        ] : [
          ["Students in scope", data?.summary?.totalStudents ?? 0],
          ["Open sessions", sessions.length],
          ["Pending leave", data?.summary?.pendingLeaves ?? 0],
          ["Unpaid fines", money(data?.summary?.unpaidFinePaise ?? 0)]
        ]).map(([label, value]) => <article className="metric card" key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}
      </section>
      <section className="cards">
        <article className="card"><h2>Quick actions</h2><div className="action-list">
          {role === "student" && <><button onClick={() => setTab("Attendance")}>Mark attendance</button><button className="secondary-button" onClick={() => setTab("Leave")}>Apply for leave</button><button className="secondary-button" onClick={() => setTab("Fines")}>View fine balance</button></>}
          {role === "faculty" && <><button onClick={() => setTab("Sessions")}>Manage class sessions</button><button className="secondary-button" onClick={() => setTab("Attendance")}>Correct attendance</button><button className="secondary-button" onClick={() => setTab("Leave")}>Review class leave</button></>}
          {role === "hod" && <><button onClick={() => setTab("Students")}>View student roster</button><button className="secondary-button" onClick={() => setTab("Timetable")}>Manage timetable</button><button className="secondary-button" onClick={() => setTab("Fine management")}>Manage fines</button></>}
        </div></article>
        <article className="card"><h2>Policy and security</h2><p>Attendance changes and fine decisions are recorded in the audit log. Session QR tokens expire automatically. Approved leave is marked excused when a session is closed.</p><p className="small">Current absence fine: <strong>{money(data?.finePerDayPaise || 5000)} per unexcused absent day</strong>.</p></article>
      </section>
      {role === "student" && <section className="card"><h2>Upcoming live sessions</h2><SessionCards sessions={sessions} onMark={markAttendance} busy={busy} /></section>}
    </>}

    {tab === "Attendance" && <section className="cards">
      {role === "student" ? <article className="card wide"><h2>Mark attendance</h2><p>Use the live QR token displayed by your faculty. Location permission is required and the browser must report good accuracy.</p><SessionCards sessions={sessions} onMark={markAttendance} busy={busy} /></article>
        : <article className="card wide"><h2>Attendance history and correction</h2><p>Manual corrections require a reason and are logged. Select a class session and student from the lists below.</p>
          <form onSubmit={e => submitForm(e, "attendance.manual", f => ({ session_id: String(f.get("session_id")), student_id: String(f.get("student_id")), status: String(f.get("status")), reason: String(f.get("reason")) }))}>
            <label>Session<select name="session_id" required>{sessions.map(s => <option key={s.id} value={s.id}>{s.subject_code} · Year {s.year} {s.section} · {dateText(s.opens_at)}</option>)}</select></label>
            <label>Student<select name="student_id" required>{data?.students.map(s => <option key={s.id} value={s.id}>{s.roll_no} — {s.name}</option>)}</select></label>
            <label>Status<select name="status"><option value="present">Present</option><option value="absent">Absent</option><option value="excused">Excused</option></select></label>
            <label>Reason<input name="reason" minLength={5} required placeholder="Why is this correction needed?" /></label><button disabled={busy}>Save correction</button>
          </form>
        </article>}
      <article className="card wide"><h2>{role === "student" ? "My attendance history" : "Class session history"}</h2>
        <div className="table-wrap"><table><thead><tr>{(role === "student" ? ["Date","Subject","Status"] : ["Date","Subject","Class","Present","Absent","Status"]).map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>
          {(data?.attendance || []).map((a: any) => <tr key={a.id}><td>{dateText(a.marked_at || a.opens_at)}</td><td>{a.subject_code}</td>{role !== "student" && <><td>Year {a.year} {a.section}</td><td>{a.present_count ?? "—"}</td><td>{a.absent_count ?? "—"}</td></>}<td><span className={`status ${a.status}`}>{a.status}</span></td></tr>)}
          {!data?.attendance.length && <tr><td colSpan={role === "student" ? 3 : 6}>No attendance records yet.</td></tr>}
        </tbody></table></div>
      </article>
    </section>}

    {tab === "Sessions" && <section className="cards">
      <article className="card"><h2>Create attendance session</h2><form onSubmit={e => submitForm(e, "session.create", f => ({ year: Number(f.get("year")), section: String(f.get("section")), dept: String(f.get("dept") || "CSE-AIML"), subject_code: String(f.get("subject_code")), classroom_id: String(f.get("classroom_id")), opens_at: new Date(String(f.get("opens_at"))).toISOString(), closes_at: new Date(String(f.get("closes_at"))).toISOString() }))}>
        <label>Year<select name="year">{[1,2,3,4].map(n => <option key={n}>{n}</option>)}</select></label><label>Section<input name="section" required placeholder="A" /></label><label>Department<input name="dept" defaultValue="CSE-AIML" required /></label><label>Subject code<input name="subject_code" required placeholder="CS301" /></label>
        <label>Classroom<select name="classroom_id" required>{data?.classrooms.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}</select></label>
        <label>Opens at<input type="datetime-local" name="opens_at" required /></label><label>Closes at<input type="datetime-local" name="closes_at" required /></label><button disabled={busy || !data?.classrooms.length}>Create session</button>
        {!data?.classrooms.length && <p className="small">An HOD must configure a classroom before sessions can be opened.</p>}
      </form></article>
      <article className="card wide"><h2>Open sessions</h2>{sessions.map(s => <div className="list-row" key={s.id}><div><strong>{s.subject_code}</strong><p>Year {s.year} {s.section} · {s.classroom_name || "Classroom"} · closes {dateText(s.closes_at)}</p></div><div className="action-list"><button onClick={() => openQr(s.id)} disabled={busy}>Generate QR</button><button className="secondary-button" onClick={() => void send({action:"session.close",id:s.id})} disabled={busy}>Close &amp; finalize</button></div></div>)}{!sessions.length && <p>No open sessions.</p>}
        {qr && <div className="qr-panel"><h3>Live attendance QR</h3><img src={qr.image} width="240" height="240" alt="Rotating attendance QR code" /><p>Expires: {dateText(qr.expires)}</p><label>Token (fallback)<input readOnly value={qr.token} onFocus={e => e.currentTarget.select()} /></label><button className="secondary-button" onClick={() => { void navigator.clipboard?.writeText(qr.token); setNotice("QR token copied."); }}>Copy token</button></div>}
      </article>
    </section>}

    {tab === "Students" && <section className="cards">
      <article className="card"><h2>Import student roster</h2><p>Paste a JSON array with roll_no, name, year, section, dept, email and optional phone. Imports are transactional.</p>
        <form onSubmit={async e => { e.preventDefault(); const form = new FormData(e.currentTarget); try { const rows = JSON.parse(String(form.get("rows") || "[]")); setBusy(true); const res = await fetch("/api/v1/students/import", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rows})}); const r = await res.json(); if (!res.ok) throw new Error(r.error || "Import failed"); setNotice(`Imported ${r.imported} students. Student login accounts must be provisioned separately.`); await refresh(); e.currentTarget.reset(); } catch (err) { setNotice(err instanceof Error ? err.message : "Invalid JSON"); } finally { setBusy(false); } }}>
          <label>Student rows JSON<textarea name="rows" rows={8} required placeholder={'[{"roll_no":"24CS001","name":"Student Name","year":3,"section":"A","dept":"CSE-AIML","email":"student@example.edu"}]'} /></label><button disabled={busy}>Import students</button>
        </form>
      </article>
      <article className="card wide"><h2>Student roster</h2><div className="table-wrap"><table><thead><tr><th>Roll number</th><th>Name</th><th>Year</th><th>Section</th><th>Department</th><th>Status</th></tr></thead><tbody>{data?.students.map(s => <tr key={s.id}><td>{s.roll_no}</td><td>{s.name}</td><td>{s.year}</td><td>{s.section}</td><td>{s.dept}</td><td>{s.status}</td></tr>)}</tbody></table></div></article>
    </section>}

    {tab === "Classes" && <section className="card"><h2>Assigned classes</h2><div className="table-wrap"><table><thead><tr><th>Subject</th><th>Year</th><th>Section</th><th>Department</th></tr></thead><tbody>{data?.assignments.map(a => <tr key={a.id || a.subject_code}><td>{a.subject_code}</td><td>{a.year}</td><td>{a.section}</td><td>{a.dept}</td></tr>)}</tbody></table></div><h2>Class roster</h2><div className="table-wrap"><table><thead><tr><th>Roll number</th><th>Name</th><th>Class</th></tr></thead><tbody>{data?.students.map(s => <tr key={s.id}><td>{s.roll_no}</td><td>{s.name}</td><td>Year {s.year} {s.section}</td></tr>)}</tbody></table></div></section>}

    {tab === "Timetable" && <section className="cards">
      {role === "hod" && <article className="card"><h2>Add timetable slot</h2><form onSubmit={e => submitForm(e, "timetable.create", f => ({dept:String(f.get("dept") || "CSE-AIML"),year:Number(f.get("year")),section:String(f.get("section")),day_of_week:Number(f.get("day_of_week")),start_time:String(f.get("start_time")),end_time:String(f.get("end_time")),subject_code:String(f.get("subject_code")),subject_name:String(f.get("subject_name")),faculty_user_id:String(f.get("faculty_user_id") || "") || null,classroom_id:String(f.get("classroom_id") || "") || null}))}>
        <label>Department<input name="dept" defaultValue="CSE-AIML" required /></label><label>Year<select name="year">{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label><label>Section<input name="section" required defaultValue="A" /></label><label>Day<select name="day_of_week">{dayNames.map((d,i)=><option value={i} key={d}>{d}</option>)}</select></label><label>Start<input type="time" name="start_time" required /></label><label>End<input type="time" name="end_time" required /></label><label>Subject code<input name="subject_code" required /></label><label>Subject name<input name="subject_name" required /></label><label>Faculty account<select name="faculty_user_id"><option value="">Unassigned</option>{data?.assignments.map(a=><option key={a.faculty_user_id} value={a.faculty_user_id}>{a.faculty_name || a.email}</option>)}</select></label><label>Classroom<select name="classroom_id"><option value="">Unassigned</option>{data?.classrooms.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button disabled={busy}>Add timetable slot</button>
      </form></article>}
      <article className="card wide"><h2>Weekly timetable</h2><div className="table-wrap"><table><thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Class</th><th>Faculty / Room</th></tr></thead><tbody>{data?.timetable.map(t=><tr key={t.id}><td>{dayNames[Number(t.day_of_week)]}</td><td>{String(t.start_time).slice(0,5)}–{String(t.end_time).slice(0,5)}</td><td>{t.subject_code} — {t.subject_name}</td><td>Year {t.year} {t.section}</td><td>{t.faculty_name || t.classroom_name || "—"}</td></tr>)}{!data?.timetable.length && <tr><td colSpan={5}>No timetable slots configured.</td></tr>}</tbody></table></div></article>
    </section>}

    {tab === "Leave" && <section className="cards">
      {role === "student" && <article className="card"><h2>Apply for leave</h2><form onSubmit={e => submitForm(e,"leave.create",f=>({from_date:String(f.get("from_date")),to_date:String(f.get("to_date")),leave_type:String(f.get("leave_type")),reason:String(f.get("reason"))}))}>
        <label>From date<input type="date" name="from_date" required /></label><label>To date<input type="date" name="to_date" required /></label><label>Leave type<select name="leave_type"><option value="medical">Medical</option><option value="personal">Personal</option><option value="official">Official</option><option value="other">Other</option></select></label><label>Reason<textarea name="reason" minLength={5} maxLength={1000} required rows={4} placeholder="Explain why you need leave" /></label><button disabled={busy}>Submit leave request</button></form></article>}
      <article className="card wide"><h2>{role === "student" ? "My leave requests" : "Leave review queue"}</h2>{data?.leaves.map(l=><div className="list-row" key={l.id}><div><strong>{l.student_name ? `${l.student_name} (${l.roll_no})` : l.leave_type}</strong><p>{l.from_date} to {l.to_date} · {l.leave_type} · {l.reason}</p>{l.review_note && <p>Review: {l.review_note}</p>}<span className={`status ${l.status}`}>{l.status}</span></div>{role !== "student" && l.status === "pending" && <div className="action-list"><button onClick={() => void send({action:"leave.review",id:l.id,status:"approved",review_note:"Approved"})} disabled={busy}>Approve</button><button className="secondary-button" onClick={async()=>{const note=window.prompt("Reason for rejection?");if(note && note.trim().length>=3) await send({action:"leave.review",id:l.id,status:"rejected",review_note:note});}} disabled={busy}>Reject</button></div>}</div>)}{!data?.leaves.length && <p>No leave requests.</p>}</article>
    </section>}

    {(tab === "Fines" || tab === "Fine management") && <section className="cards">
      {role === "hod" && <article className="card"><h2>Absence fine policy</h2><p>Fine is generated once per student per local campus date, not once per class period. Approved leave is exempt.</p><form onSubmit={e=>submitForm(e,"fine.policy",f=>({amount:Number(f.get("amount"))}))}><label>Fine per absent day (₹)<input type="number" name="amount" min="0" max="10000" step="1" value={fineAmount} onChange={e=>setFineAmount(e.target.value)} required /></label><button disabled={busy}>Save fine policy</button></form></article>}
      <article className="card wide"><h2>{role === "student" ? "My fine ledger" : "Fine ledger and resolution"}</h2><p>Outstanding balance: <strong>{money(role === "student" ? unpaidTotal : data?.summary?.unpaidFinePaise || 0)}</strong></p><div className="table-wrap"><table><thead><tr><th>Student</th><th>Absent date</th><th>Reason</th><th>Amount</th><th>Status</th>{role==="hod"&&<th>Action</th>}</tr></thead><tbody>{data?.fines.map(f=><tr key={f.id}><td>{f.student_name || data.profile?.name || data.user.email}</td><td>{f.absent_date}</td><td>{f.reason}</td><td>{money(f.amount_paise)}</td><td><span className={`status ${f.status}`}>{f.status}</span></td>{role==="hod"&&<td>{f.status==="unpaid"&&<div className="action-list"><button onClick={()=>void send({action:"fine.resolve",id:f.id,status:"paid",resolution_note:"Payment confirmed by HOD"})} disabled={busy}>Mark paid</button><button className="secondary-button" onClick={async()=>{const note=window.prompt("Waiver reason?");if(note&&note.trim().length>=3) await send({action:"fine.resolve",id:f.id,status:"waived",resolution_note:note});}} disabled={busy}>Waive</button></div>}</td>}</tr>)}{!data?.fines.length&&<tr><td colSpan={role==="hod"?6:5}>No fine entries yet.</td></tr>}</tbody></table></div></article>
    </section>}

    {tab === "Classrooms" && <section className="cards"><article className="card"><h2>Register classroom</h2><p>Use the room's real coordinates. The radius is the allowed attendance distance.</p><form onSubmit={e=>submitForm(e,"classroom.create",f=>({code:String(f.get("code")),name:String(f.get("name")),building:String(f.get("building")||""),latitude:Number(f.get("latitude")),longitude:Number(f.get("longitude")),radius_m:Number(f.get("radius_m")||60)}))}>
      <label>Room code<input name="code" required /></label><label>Room name<input name="name" required /></label><label>Building<input name="building" /></label><label>Latitude<input type="number" name="latitude" step="any" min="-90" max="90" required /></label><label>Longitude<input type="number" name="longitude" step="any" min="-180" max="180" required /></label><label>Radius (metres)<input type="number" name="radius_m" min="10" max="500" defaultValue="60" required /></label><button disabled={busy}>Save classroom</button></form></article>
      <article className="card wide"><h2>Configured classrooms</h2><div className="table-wrap"><table><thead><tr><th>Code</th><th>Room</th><th>Building</th><th>Radius</th><th>Coordinates</th></tr></thead><tbody>{data?.classrooms.map(c=><tr key={c.id}><td>{c.code}</td><td>{c.name}</td><td>{c.building || "—"}</td><td>{c.radius_m} m</td><td>{c.latitude}, {c.longitude}</td></tr>)}</tbody></table></div></article></section>}

    {tab === "Notifications" && <section className="card"><h2>Notifications</h2>{data?.notifications.map(n=><div className="list-row" key={n.id}><div><strong>{n.title}</strong><p>{n.body}</p><span className="small">{dateText(n.created_at)} · {n.category}</span></div><span className={n.read_at ? "status paid" : "status pending"}>{n.read_at ? "read" : "new"}</span></div>)}{!data?.notifications.length&&<p>No notifications yet.</p>}</section>}
    <p className="small dash-footer">CampusAttend · Role-based access · Times shown in your device locale · Data stored in Neon PostgreSQL</p>
  </main>;
}

function SessionCards({ sessions, onMark, busy }: { sessions: Session[]; onMark: (event: FormEvent<HTMLFormElement>, id: string) => void; busy: boolean }) {
  return <div className="session-list">{sessions.map(s=><div className="session-card" key={s.id}><div><strong>{s.subject_code}</strong><p>Year {s.year} {s.section} · {s.classroom_name || "Classroom"}</p><span className="small">Closes {dateText(s.closes_at)}</span></div><form onSubmit={e=>onMark(e,s.id)}><label>Live QR token<input name="qr_token" minLength={20} required placeholder="Paste token from classroom QR" /></label><button disabled={busy}>Mark present</button></form></div>)}{!sessions.length&&<p>No live attendance sessions are available for your class right now.</p>}</div>;
}
