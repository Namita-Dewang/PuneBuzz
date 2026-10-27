import { Outlet, Route, Routes } from 'react-router';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import CreateEventPage from './pages/CreateEventPage';
import EditEventPage from './pages/EditEventPage';
import EventDetailPage from './pages/EventDetailPage';
import HomePage from './pages/HomePage';
import ManageEventPage from './pages/ManageEventPage';
import LoginPage from './pages/LoginPage';
import MyEventsPage from './pages/MyEventsPage';
import NotFoundPage from './pages/NotFoundPage';
import RegisterPage from './pages/RegisterPage';
import VolunteerPage from './pages/VolunteerPage';

function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Navbar />
      <main className="mx-auto w-full max-w-page flex-1 px-4 sm:px-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="volunteer" element={<VolunteerPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="me" element={<MyEventsPage />} />
          {/* Ownership is checked on these pages and by the API. */}
          <Route path="events/:id/edit" element={<EditEventPage />} />
          <Route path="events/:id/manage" element={<ManageEventPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={['organizer', 'admin']} />}>
          <Route path="events/new" element={<CreateEventPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
