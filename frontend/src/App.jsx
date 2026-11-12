// App — defines the app's routes.
// - Public (PublicLayout): Home, Services, Service Details, Specialists, Booking, Login, Register
// - Customer (DashboardLayout + ProtectedRoute role CUSTOMER): dashboard pages
// - Admin (DashboardLayout + ProtectedRoute role ADMIN): management pages
// Auth is backed by the Express API (JWT). Other data is being migrated step by step.

import { Routes, Route } from 'react-router-dom';
import {
  CalendarDays,
  Clock,
  FileText,
  Layers,
  LayoutDashboard,
  Scissors,
  User,
  Users,
} from 'lucide-react';

import Home from './pages/Home';
import Services from './pages/Services';
import ServiceDetails from './pages/ServiceDetails';
import Specialists from './pages/Specialists';
import SpecialistDetails from './pages/SpecialistDetails';
import Booking from './pages/Booking';
import Login from './pages/Login';
import Register from './pages/Register';
import CustomerOverview from './pages/CustomerOverview';
import MyAppointments from './pages/MyAppointments';
import BookingDetails from './pages/BookingDetails';
import CustomerProfile from './pages/CustomerProfile';
import AdminOverview from './pages/AdminOverview';
import AdminAppointments from './pages/AdminAppointments';
import AdminServices from './pages/AdminServices';
import AdminCategories from './pages/AdminCategories';
import AdminProviders from './pages/AdminProviders';
import AdminWorkingHours from './pages/AdminWorkingHours';
import AdminCustomers from './pages/AdminCustomers';
import AdminCustomerDetails from './pages/AdminCustomerDetails';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { useDemo } from './store/DemoContext';

const customerMenu = [
  { label: 'Overview', to: '/customer', icon: LayoutDashboard, end: true },
  { label: 'My Appointments', to: '/customer/appointments', icon: CalendarDays },
  { label: 'Booking Details', to: '/customer/appointments/details', icon: FileText },
  { label: 'Profile', to: '/customer/profile', icon: User },
];

const adminMenu = [
  { label: 'Overview', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Appointments', to: '/admin/appointments', icon: CalendarDays },
  { label: 'Services', to: '/admin/services', icon: Scissors },
  { label: 'Categories', to: '/admin/categories', icon: Layers },
  { label: 'Providers', to: '/admin/providers', icon: User },
  { label: 'Working Hours', to: '/admin/working-hours', icon: Clock },
  { label: 'Customers', to: '/admin/customers', icon: Users },
];

export default function App() {
  const { user } = useDemo();
  const customerName = user?.name || 'Customer';

  const adminLayout = (title, subtitle, page) => (
    <ProtectedRoute role="ADMIN">
      <DashboardLayout items={adminMenu} title={title} subtitle={subtitle} userName={user?.name || 'Admin'} roleLabel="Admin">
        {page}
      </DashboardLayout>
    </ProtectedRoute>
  );

  return (
    <Routes>
      {/* ----- Public pages ----- */}
      <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
      <Route path="/services" element={<PublicLayout><Services /></PublicLayout>} />
      <Route path="/services/:id" element={<PublicLayout><ServiceDetails /></PublicLayout>} />
      <Route path="/specialists" element={<PublicLayout><Specialists /></PublicLayout>} />
      <Route path="/specialists/:id" element={<PublicLayout><SpecialistDetails /></PublicLayout>} />
      <Route path="/booking" element={<PublicLayout><Booking /></PublicLayout>} />
      <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
      <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />

      {/* ----- Customer dashboard (protected) ----- */}
      <Route
        path="/customer"
        element={
          <ProtectedRoute role="CUSTOMER">
            <DashboardLayout items={customerMenu} title="Customer Overview" subtitle="Welcome back" userName={customerName} roleLabel="Customer">
              <CustomerOverview />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/appointments"
        element={
          <ProtectedRoute role="CUSTOMER">
            <DashboardLayout items={customerMenu} title="My Appointments" subtitle="Your upcoming & past bookings" userName={customerName} roleLabel="Customer">
              <MyAppointments />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/appointments/details"
        element={
          <ProtectedRoute role="CUSTOMER">
            <DashboardLayout items={customerMenu} title="Booking Details" subtitle="Appointment summary" userName={customerName} roleLabel="Customer">
              <BookingDetails />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/profile"
        element={
          <ProtectedRoute role="CUSTOMER">
            <DashboardLayout items={customerMenu} title="Profile" subtitle="Your personal information" userName={customerName} roleLabel="Customer">
              <CustomerProfile />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* ----- Admin dashboard ----- */}
      <Route path="/admin" element={adminLayout('Admin Overview', 'Business summary', <AdminOverview />)} />
      <Route path="/admin/appointments" element={adminLayout('Appointments', 'Approve, reject & update statuses', <AdminAppointments />)} />
      <Route path="/admin/services" element={adminLayout('Services', 'Add, edit & delete services', <AdminServices />)} />
      <Route path="/admin/categories" element={adminLayout('Categories', 'Organize services by category', <AdminCategories />)} />
      <Route path="/admin/providers" element={adminLayout('Providers', 'Manage specialists & staff', <AdminProviders />)} />
      <Route path="/admin/working-hours" element={adminLayout('Working Hours', 'Provider schedules', <AdminWorkingHours />)} />
      <Route path="/admin/customers" element={adminLayout('Customers', 'Your client list', <AdminCustomers />)} />
      <Route path="/admin/customers/:id" element={adminLayout('Customer Details', 'Profile & appointment history', <AdminCustomerDetails />)} />

      {/* ----- Catch-all ----- */}
      <Route
        path="*"
        element={
          <PublicLayout>
            <div className="mx-auto max-w-md px-4 py-24 text-center">
              <h1 className="text-4xl font-bold text-ink">404</h1>
              <p className="mt-3 text-ink-soft">The page you are looking for does not exist.</p>
            </div>
          </PublicLayout>
        }
      />
    </Routes>
  );
}
