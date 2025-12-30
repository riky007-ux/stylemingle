/**
 * Root layout for the App Router.
 * Wraps all pages under src/app with a basic HTML/body structure.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
