// App — defines the app's routes.
// - Public (PublicLayout): Home, Services, Provider directory, Specialists, Booking, logins
// - Customer (DashboardLayout + ProtectedRoute role CUSTOMER): dashboard pages
// - Provider (DashboardLayout + ProtectedRoute role PROVIDER): provider dashboard pages
// - Admin (DashboardLayout + ProtectedRoute role ADMIN): management pages
// Auth is backed by the Express API (JWT). All portals share one database.

import { Routes, Route } from 'react-router-dom';
import {
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  Clock,
  FileText,
  Layers,
  LayoutDashboard,
  Scissors,
  User,
  UserRound,
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
import Providers from './pages/Providers';
import ProviderDetails from './pages/ProviderDetails';
import ProviderRegister from './pages/ProviderRegister';
import ProviderOverview from './pages/ProviderOverview';
import ProviderServices from './pages/ProviderServices';
import ProviderAppointments from './pages/ProviderAppointments';
import ProviderAvailability from './pages/ProviderAvailability';
import ProviderProfile from './pages/ProviderProfile';
import CustomerOverview from './pages/CustomerOverview';
import MyAppointments from './pages/MyAppointments';
import BookingDetails from './pages/BookingDetails';
import CustomerProfile from './pages/CustomerProfile';
import AdminOverview from './pages/AdminOverview';
import AdminAppointments from './pages/AdminAppointments';
import AdminServices from './pages/AdminServices';
import AdminCategories from './pages/AdminCategories';
import AdminProviders from './pages/AdminProviders';
import AdminApprovals from './pages/AdminApprovals';
import AdminWorkingHours from './pages/AdminWorkingHours';
import AdminCustomers from './pages/AdminCustomers';
import AdminCustomerDetails from './pages/AdminCustomerDetails';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import NotFound from './pages/NotFound';
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
  { label: 'Approvals', to: '/admin/approvals', icon: BadgeCheck },
  { label: 'Working Hours', to: '/admin/working-hours', icon: Clock },
  { label: 'Customers', to: '/admin/customers', icon: Users },
];

const providerMenu = [
  { label: 'Overview', to: '/provider', icon: LayoutDashboard, end: true },
  { label: 'My Services', to: '/provider/services', icon: Scissors },
  { label: 'Appointments', to: '/provider/appointments', icon: CalendarDays },
  { label: 'Availability', to: '/provider/availability', icon: CalendarClock },
  { label: 'Provider Profile', to: '/provider/profile', icon: UserRound },
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

  const providerLayout = (title, subtitle, page) => (
    <ProtectedRoute role="PROVIDER">
      <DashboardLayout
        items={providerMenu}
        title={title}
        subtitle={subtitle}
        userName={user?.name || 'Provider'}
        roleLabel="Provider"
      >
        {page}
      </DashboardLayout>
    </ProtectedRoute>
  );

  return (
    <>
      <ScrollToTop />
      <Routes>
      {/* ----- Public pages ----- */}
      <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
      <Route path="/services" element={<PublicLayout><Services /></PublicLayout>} />
      <Route path="/services/:id" element={<PublicLayout><ServiceDetails /></PublicLayout>} />
      <Route path="/providers" element={<PublicLayout><Providers /></PublicLayout>} />
      <Route path="/providers/:id" element={<PublicLayout><ProviderDetails /></PublicLayout>} />
      <Route path="/specialists" element={<PublicLayout><Specialists /></PublicLayout>} />
      <Route path="/specialists/:id" element={<PublicLayout><SpecialistDetails /></PublicLayout>} />
      <Route path="/booking" element={<PublicLayout><Booking /></PublicLayout>} />
      <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
      <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />
      <Route path="/provider/login" element={<PublicLayout><Login portal="provider" /></PublicLayout>} />
      <Route path="/provider/register" element={<PublicLayout><ProviderRegister /></PublicLayout>} />

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

      {/* ----- Provider dashboard (protected) ----- */}
      <Route path="/provider" element={providerLayout('Provider Overview', 'Welcome back', <ProviderOverview />)} />
      <Route path="/provider/services" element={providerLayout('My Services', 'Create, publish & manage your catalog', <ProviderServices />)} />
      <Route path="/provider/appointments" element={providerLayout('Appointments', 'Bookings for your services', <ProviderAppointments />)} />
      <Route path="/provider/availability" element={providerLayout('Availability', 'Weekly working hours', <ProviderAvailability />)} />
      <Route path="/provider/profile" element={providerLayout('Provider Profile', 'Public identity & contact details', <ProviderProfile />)} />

      {/* ----- Admin dashboard ----- */}
      <Route path="/admin" element={adminLayout('Admin Overview', 'Business summary', <AdminOverview />)} />
      <Route path="/admin/appointments" element={adminLayout('Appointments', 'Approve, reject & update statuses', <AdminAppointments />)} />
      <Route path="/admin/services" element={adminLayout('Services', 'Add, edit & delete services', <AdminServices />)} />
      <Route path="/admin/categories" element={adminLayout('Categories', 'Organize services by category', <AdminCategories />)} />
      <Route path="/admin/providers" element={adminLayout('Providers', 'Manage specialists & staff', <AdminProviders />)} />
      <Route path="/admin/approvals" element={adminLayout('Approvals', 'Review provider accounts & services', <AdminApprovals />)} />
      <Route path="/admin/working-hours" element={adminLayout('Working Hours', 'Provider schedules', <AdminWorkingHours />)} />
      <Route path="/admin/customers" element={adminLayout('Customers', 'Your client list', <AdminCustomers />)} />
      <Route path="/admin/customers/:id" element={adminLayout('Customer Details', 'Profile & appointment history', <AdminCustomerDetails />)} />

      {/* ----- Catch-all ----- */}
      <Route
        path="*"
        element={
          <PublicLayout>
            <NotFound />
          </PublicLayout>
        }
      />
    </Routes>
    </>
  );
}
