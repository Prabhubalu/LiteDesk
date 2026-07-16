import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Add your site header / navigation here */}
        <header id="site-header" />
        {children}
        {/* Add your site footer here */}
        <footer id="site-footer" />
      </body>
    </html>
  );
}
