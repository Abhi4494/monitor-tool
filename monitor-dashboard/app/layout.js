import "./globals.css";

export const metadata = {
  title: "Website Monitor",
  description: "Live status, error logs and alerts",
};

// Nav + page container are rendered by <Protected> so the login page stays bare.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
