import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthGuard from "@/components/AuthGuard";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ToastProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TATA Steel — Maintenance Wizard",
  description: "AI Maintenance Command Center for Steel Manufacturing",
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('steelplant-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider>
          <ToastProvider>
            <div className="mesh-bg" aria-hidden />
            <AuthGuard>{children}</AuthGuard>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
