import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import AuthForm from '../components/AuthForm';
import { useAuth } from '../context/AuthContext';

const FIELDS = [
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
];

// Where to go after logging in: back to the protected page that sent us here.
export function redirectTarget(location) {
  const from = location.state?.from;
  return from ? `${from.pathname}${from.search ?? ''}` : '/';
}

export default function LoginPage() {
  const { user, login, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const target = redirectTarget(location);

  if (user) return <Navigate to={target} replace />;

  return (
    <AuthForm
      title="Log in"
      subtitle="Welcome back. Book seats at events and keep track of your waitlist spots."
      fields={FIELDS}
      submitLabel="Log in"
      notice={sessionExpired ? 'Your session has expired. Please log in again.' : null}
      onSubmit={async (values) => {
        await login(values);
        navigate(target, { replace: true });
      }}
      footer={
        <>
          New here?{' '}
          <Link to="/register" state={location.state} className="font-medium text-accent underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    />
  );
}
