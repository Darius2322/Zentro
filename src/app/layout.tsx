import "./globals.css";
import type { Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex" });

export const metadata = {
  title: "Zentro — appointment booking for salons and barbershops",
  description:
    "Give your salon, barbershop or beauty studio its own booking page. Clients only see times that are genuinely free.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1F6F5C",
  width: "device-width",
  initialScale: 1,
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
