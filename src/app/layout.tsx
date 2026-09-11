import "./globals.css";
import { IBM_Plex_Sans } from "next/font/google";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex" });

export const metadata = {
  title: "Zentro",
  description: "Appointment booking and business management for salons and beauty studios.",
  manifest: "/manifest.json",
  themeColor: "#1F6F5C",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plexSans.variable}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
