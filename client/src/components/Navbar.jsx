import { CalendarDays, HandHeart, ChevronDown, LogIn, LogOut, Menu, Plus, UserPlus, X } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import useDisclosure from '../hooks/useDisclosure';
import cx from '../utils/cx';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { Button } from './ui';

function navClass({ isActive }) {
  return cx(
    'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150',
    isActive ? 'bg-sunken text-ink' : 'text-ink-muted hover:text-ink'
  );
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase() || '?';
}

function Avatar({ name, className = 'size-8 text-xs' }) {
  return (
    <span aria-hidden="true" className={cx('grid shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent', className)}>
      {initials(name)}
    </span>
  );
}

function UserSummary({ user }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <Avatar name={user.name} className="size-10 text-sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
        <p className="truncate text-xs text-ink-muted">{user.email}</p>
        {user.role !== 'user' && (
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">{user.role}</p>
        )}
      </div>
    </div>
  );
}

const menuItemClass =
  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink transition-colors duration-150 hover:bg-sunken';

// Desktop: avatar button that opens an account panel.
function UserMenu({ user, isOrganizer, onLogout }) {
  const { open, toggle, containerRef, triggerRef } = useDisclosure();
  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={`Account: ${user.name}`}
        className="flex items-center gap-1.5 rounded-full p-1 pr-2 text-ink-muted transition-colors duration-150 hover:bg-sunken hover:text-ink"
      >
        <Avatar name={user.name} />
        <ChevronDown className={cx('size-4', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div
          id="account-menu"
          className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-line bg-surface p-1.5 shadow-pop"
        >
          <UserSummary user={user} />
          <div className="my-1 h-px bg-line" />
          <Link to="/me" className={menuItemClass}>
            <CalendarDays className="size-4 text-ink-muted" aria-hidden="true" /> My events
          </Link>
          {isOrganizer && (
            <Link to="/events/new" className={menuItemClass}>
              <Plus className="size-4 text-ink-muted" aria-hidden="true" /> Create event
            </Link>
          )}
          <div className="my-1 h-px bg-line" />
          <button type="button" onClick={onLogout} className={menuItemClass}>
            <LogOut className="size-4 text-ink-muted" aria-hidden="true" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

// Mobile: hamburger that opens a full-width panel under the bar.
function MobileMenu({ user, isOrganizer, onLogout }) {
  const { open, toggle, containerRef, triggerRef } = useDisclosure();
  return (
    <div ref={containerRef} className="md:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="grid size-9 place-items-center rounded-full text-ink transition-colors duration-150 hover:bg-sunken"
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
      </button>
      {open && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-full z-40 border-b border-line bg-surface px-4 pb-4 pt-2 shadow-pop"
        >
          <Link to="/volunteer" className={menuItemClass}>
            <HandHeart className="size-4 text-ink-muted" aria-hidden="true" /> Want to volunteer
          </Link>
          {user ? (
            <>
              <UserSummary user={user} />
              <div className="my-1 h-px bg-line" />
              <Link to="/me" className={menuItemClass}>
                <CalendarDays className="size-4 text-ink-muted" aria-hidden="true" /> My events
              </Link>
              {isOrganizer && (
                <Link to="/events/new" className={menuItemClass}>
                  <Plus className="size-4 text-ink-muted" aria-hidden="true" /> Create event
                </Link>
              )}
              <div className="my-1 h-px bg-line" />
              <button type="button" onClick={onLogout} className={menuItemClass}>
                <LogOut className="size-4 text-ink-muted" aria-hidden="true" /> Log out
              </button>
            </>
          ) : (
            <div className="grid gap-2 pt-2">
              <Button as={Link} to="/login" variant="secondary" fullWidth>
                <LogIn aria-hidden="true" /> Log in
              </Button>
              <Button as={Link} to="/register" fullWidth>
                <UserPlus aria-hidden="true" /> Sign up
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, isLoading, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const isOrganizer = hasRole('organizer', 'admin');

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/65">
      <nav aria-label="Main" className="relative mx-auto flex h-16 max-w-page items-center gap-2 px-4 sm:px-6">
        <Link to="/" aria-label="Pune Buzz home: all events" className="shrink-0 rounded-lg md:mr-6">
          <Logo />
        </Link>

        {/* Desktop links. The logo is the link to the event list. */}
        <div className="hidden items-center gap-1 md:flex">
            {user && (
              <NavLink to="/me" className={navClass}>
                My events
              </NavLink>
            )}
            <NavLink to="/volunteer" className={(s) => cx(navClass(s), 'inline-flex items-center gap-1.5')}>
              <HandHeart className="size-4" aria-hidden="true" /> Want to volunteer
            </NavLink>
            {isOrganizer && (
              <NavLink to="/events/new" className={navClass}>
                Create event
              </NavLink>
            )}
          </div>

        {/* ml-auto keeps this group on the right whether or not the links above render. */}
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {!isLoading && (
            <>
              <div className="hidden items-center gap-2 md:flex">
                {user ? (
                  <UserMenu user={user} isOrganizer={isOrganizer} onLogout={handleLogout} />
                ) : (
                  <>
                    <NavLink to="/login" className={navClass}>
                      Log in
                    </NavLink>
                    <Button as={Link} to="/register" size="sm">
                      Sign up
                    </Button>
                  </>
                )}
              </div>
              <MobileMenu user={user} isOrganizer={isOrganizer} onLogout={handleLogout} />
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
