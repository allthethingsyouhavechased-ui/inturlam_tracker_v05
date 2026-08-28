import type { Metadata, Viewport } from "next";
import { Archivo, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import UndoBar from "@/components/UndoBar";
import Sidebar from "@/components/Sidebar";
import { SidebarProvider } from "@/components/SidebarContext";
import SidebarMobileFrame from "@/components/SidebarMobileFrame";
import GuestShell from "@/components/GuestShell";
import { getCurrentActor } from "@/lib/identity";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "INTracker",
  description: "INTracker marka, içerik ve görev operasyon merkezi",
  appleWebApp: { capable: true, title: "INTracker", statusBarStyle: "default" },
};

// Telefonda tarayıcı çubuğu uygulamanın zeminiyle aynı renge boyanır; koyu tema
// tercihi için ikinci bir değer veriliyor, yoksa açık gri çubuk siyah sayfanın
// üstünde bant gibi duruyor.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1efea" },
    { media: "(prefers-color-scheme: dark)", color: "#09090a" },
  ],
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
      className={`${archivo.variable} ${spaceGrotesk.variable} h-full antialiased`}
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
            {/* Yalnızca ekip kabuğunda: guest portalında gidilecek bölüm yok. */}
            <KeyboardShortcuts />
            {/* Bekleyen yıkıcı işlemin geri alma çubuğu — hangi ekranda silme
                yapıldığından bağımsız, uygulamada tek örnek. */}
            <UndoBar />
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
