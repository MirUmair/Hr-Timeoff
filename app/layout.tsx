import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExampleHR Time Off",
  description: "A polished time-off workflow with mock HCM verification and optimistic updates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
