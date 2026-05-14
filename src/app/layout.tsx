import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { Header } from "@/components/header";
import { AgentSidebar } from "@/components/agent-sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Thinker - AI Collaborative Chat",
  description:
    "Multi-agent AI discussion platform with Leader, Explorer, Thinker, and Critic agents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>
            <div className="flex h-screen flex-col">
              <Header />
              <div className="flex flex-1 overflow-hidden">
                <AgentSidebar className="hidden w-64 shrink-0 border-r lg:flex" />
                <main className="flex-1 overflow-auto">{children}</main>
              </div>
            </div>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
