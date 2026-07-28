import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "LeadGen Property Manager",
  description: "Internal management app for rank-and-rent lead generation.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
