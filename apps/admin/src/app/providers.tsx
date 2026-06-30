"use client";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { AppToastContainer } from "@/components/ui/app-toast-container";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <AppToastContainer />
    </ThemeProvider>
  );
}
