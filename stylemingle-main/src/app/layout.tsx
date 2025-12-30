export const metadata = {
  title: 'StyleMingle',
  description: 'StyleMingle app',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
