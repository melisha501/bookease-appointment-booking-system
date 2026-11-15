// DashboardLayout — wraps CUSTOMER and ADMIN pages.
// Structure: Sidebar (fixed) → Topbar → page content.
//
// Customer and Admin use SEPARATE menu items, so they stay separate
// dashboards while sharing ONE layout component.

import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

export default function DashboardLayout({
  children,
  items = [],
  title = 'Dashboard',
  subtitle = '',
  userName = 'User',
  roleLabel = 'Dashboard',
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar
        items={items}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        roleLabel={roleLabel}
      />

      <div className="flex min-h-screen flex-col md:pl-64">
        <Topbar
          title={title}
          subtitle={subtitle}
          userName={userName}
          roleLabel={roleLabel}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
