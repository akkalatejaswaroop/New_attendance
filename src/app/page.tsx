export default function Home() {
  return <main>
    <section className="hero">
      <span className="pill">CAMPUS ATTENDANCE PLATFORM</span>
      <h1>Attendance you can<br/>verify with confidence.</h1>
      <p>One secure place for HODs, faculty, and students to manage class attendance using rotating QR codes and classroom location checks.</p>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:24}}>
        <a className="button" href="/login">Sign in</a>
        <a className="button" style={{background:"#172033"}} href="/health">Check service status</a>
      </div>
    </section>
    <section className="cards">
      <article className="card"><h2>HOD</h2><p>Import student rosters, manage sections, assign faculty, review reports, and audit corrections.</p></article>
      <article className="card"><h2>Faculty</h2><p>Start classroom sessions, rotate QR codes, and monitor attendance as it arrives.</p></article>
      <article className="card"><h2>Student</h2><p>Scan the live class QR, verify classroom location, and view your attendance history.</p></article>
    </section>
    <p className="small">Prototype UI. Configure and test the database, authentication, email delivery, and abuse protections before real student use.</p>
  </main>;
}
