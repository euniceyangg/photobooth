import "./globals.css";

export const metadata = {
  title: "Photo Booth",
  description: "A little photo booth for your phone.",
  appleWebApp: {
    capable: true,
    title: "Photo Booth",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#111111",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
