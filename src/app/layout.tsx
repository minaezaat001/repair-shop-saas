import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Core Repair Academy - نظام إدارة مراكز الصيانة",
  description: "نظام متكامل لإدارة مراكز الصيانة والإصلاح",
  other: {
    "google": "notranslate",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" translate="no">
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body>{children}</body>
    </html>
  );
}
