import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import 'react-toastify/dist/ReactToastify.css';
import Navbar from "./components/Navbar";
import { ToastContainer } from "react-toastify";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

// 1. Move viewport to its own export
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  // 2. Add metadataBase to resolve relative image URLs
  metadataBase: new URL("https://optima-flow-ac.vercel.app"),
  title: {
    default: "OptimaFlow | Next-Gen Transport Management",
    template: "%s | OptimaFlow",
  },
  description: "OptimaFlow is a high-performance ERP dashboard built by Aryan Chheda. Automate daily route notary, freight billing, and GST-compliant invoicing for road logistics businesses.",
  // 3. Fix: Authors URL should be a string
  authors: [{ name: "Aryan Chheda", url: "https://ac-portfolio-phi.vercel.app" }],
  keywords: ["Logistics ERP", "Transport Management", "Billing System", "Fleet Management", "GST Invoicing", "Aryan Chheda"],
  creator: "Aryan Chheda",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    url: "https://optima-flow-ac.vercel.app",
    title: "OptimaFlow | Logistics Command Center",
    description: "Streamline your transport business operations with real-time analytics and automated billing.",
    siteName: "OptimaFlow",
    images: [
      {
        url: "/optima-flow.png",
        width: 1200,
        height: 630,
        alt: "OptimaFlow Dashboard Preview",
      },
    ],
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full flex flex-col font-sans max-w-[90%] mx-auto" suppressHydrationWarning={true}>
        <ToastContainer
          position="top-right"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
        <Navbar />
        {children}
      </body>
    </html>
  );
}