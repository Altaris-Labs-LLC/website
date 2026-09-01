import "./globals.css";
import "./ascent.css";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import SiteChrome from "@/components/SiteChrome";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-ascent-display",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-ascent-body",
});

export const metadata = {
  title: "Altaris Labs",
  description:
    "Altaris Labs builds ambitious software—custom applications and products designed to bring your goals within reach.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${sourceSans.variable}`}
    >
      <body>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
