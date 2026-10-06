import type { ReactNode } from "react";
import "./globals.css";
import "./styles.css";
import "../../lib/audit-init";

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
