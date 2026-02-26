import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components//ui/theme-provider";
import { ClerkProvider } from "@clerk/nextjs";
import { ConditionalLayout } from "./components/conditional-layout";
import { Toaster } from "@/components/ui/toaster";
import { UsageProvider } from "./contexts/UsageContext";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import "react-datepicker/dist/react-datepicker.css";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'MeetWise - Team Workspace',
  description: 'A workspace for your team, powered by Stream Chat and Clerk.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en"  suppressHydrationWarning className="bg-dark">
      <ClerkProvider
        appearance={{
          layout: {
            socialButtonsVariant: "iconButton",
            logoImageUrl: "/meetwise.png",
          },
          variables: {
            colorText: "#fff",
            colorPrimary: "#0E78F9",
            colorBackground: "#1C1F2E",
            colorInputBackground: "#252A41",
            colorInputText: "#fff",
          },
        }}
      >
      <body
        className={`${inter.className} bg-dark-2} `}
      >
        <Toaster />
        <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            <UsageProvider>
              <ConditionalLayout>
          
        {children}
        </ConditionalLayout>
        </UsageProvider>
        </ThemeProvider>
      </body>
    </ClerkProvider>
    </html>
  );
}