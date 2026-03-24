import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import ThemeRegistry from "@/components/ThemeRegistry/ThemeRegistry";

const inter = Inter({ subsets: ["latin"], display: 'swap', variable: '--font-inter' });

export const metadata = {
  title: "Map Chat - Real-time Location Chat",
  description: "Discover and chat with people nearby on a live interactive map.",
  icons: {
    icon: "/favicon.ico",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} min-h-screen overflow-hidden`} suppressHydrationWarning>
        <ThemeRegistry>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
