import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmaPass 事業者向け 整備記録",
  description: "修理業者・メーカー・中古店が端末の整備記録を書き込むサイト",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
