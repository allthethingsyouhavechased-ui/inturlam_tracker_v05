import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { SidebarProvider } from "@/components/SidebarContext";
import SidebarMobileFrame from "@/components/SidebarMobileFrame";
import GuestShell from "@/components/GuestShell";
import { getCurrentActor } from "@/lib/identity";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "İNTURLAM · Operations",
  description: "İNTURLAM marka, içerik ve görev operasyon merkezi",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const actor = await getCurrentActor();
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}try{if(localStorage.getItem('sidebar-collapsed')==='1'){document.documentElement.dataset.sidebar='collapsed'}}catch(e){}`,
          }}
        />
        <a href="#main-content" className="skip-link">İçeriğe geç</a>
        {!actor ? (
          <main id="main-content" tabIndex={-1} className="min-h-screen px-4 sm:px-6">{children}</main>
        ) : actor.kind === "guest" ? (
          <GuestShell actor={actor}>{children}</GuestShell>
        ) : (
          <SidebarProvider>
            <div className="flex min-h-screen bg-background">
              <SidebarMobileFrame><Sidebar /></SidebarMobileFrame>
              <div className="flex min-w-0 flex-1 flex-col">
                <Header />
                <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
                  <div className="page-shell mx-auto w-full max-w-[var(--page-max)] px-4 py-6 sm:px-6 sm:py-8">{children}</div>
                </main>
              </div>
            </div>
          </SidebarProvider>
        )}
      </body>
    </html>
  );
}
