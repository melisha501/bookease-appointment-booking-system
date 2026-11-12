// PublicLayout — wraps PUBLIC pages (Home, Services, Specialists, Booking,
// Login, Register). Structure: Navbar → page content → Footer.
// Usage: <PublicLayout><Home /></PublicLayout>

import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function PublicLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
