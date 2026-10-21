import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampusAttend",
  description: "Secure classroom attendance with QR and location verification."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <header><a className="brand" href="/">Campus<span>Attend</span></a><span className="pill">QR + CLASSROOM LOCATION</span></header>
    {children}
  </body></html>;
}
