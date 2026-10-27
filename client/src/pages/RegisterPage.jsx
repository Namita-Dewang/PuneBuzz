import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import AuthForm from '../components/AuthForm';
import AuthLayout from '../components/AuthLayout';
import ChoiceField from '../components/ChoiceField';
import { Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { redirectTarget } from './LoginPage';

const ACCOUNT_TYPES = [
  { value: 'user', label: 'Attend events', description: 'Find events, book seats and join waitlists.' },
  {
    value: 'organizer',
    label: 'Organize events',
    description: 'Create events and manage who is coming. You can still book seats at other events.',
  },
];

const DETAIL_FIELDS = [
  { name: 'name', label: 'Name', autoComplete: 'name' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', minLength: 8, hint: 'At least 8 characters.' },
  { name: 'confirmPassword', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
];

function validateDetails(values) {
  const errors = {};
  if (values.password.length < 8) errors.password = 'Password must be at least 8 characters.';
  if (!values.confirmPassword) errors.confirmPassword = 'Please type your password again.';
  else if (values.confirmPassword !== values.password) errors.confirmPassword = "Passwords don't match.";
  return errors;
}

function StepLabel({ step }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Step {step} of 2</p>
      <div aria-hidden="true" className="flex gap-1">
        {[1, 2].map((n) => (
          <span key={n} className={`h-1 w-6 rounded-full ${n <= step ? 'bg-accent' : 'bg-line-strong'}`} />
        ))}
      </div>
    </div>
  );
}

function LoginLink({ state }) {
  return (
    <>
      Already have an account?{' '}
      <Link to="/login" state={state} className="font-medium text-accent underline-offset-4 hover:underline">
        Log in
      </Link>
    </>
  );
}

// Two steps, with the account type kept in the URL (/register?as=organizer)
// so Back returns to step 1 and a reload doesn't lose the choice.
export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const target = redirectTarget(location);

  const chosen = ACCOUNT_TYPES.find((t) => t.value === searchParams.get('as'));
  const [accountType, setAccountType] = useState(chosen?.value ?? 'user');

  if (user) return <Navigate to={target} replace />;

  // ---------------------------------------------------------------- step 1
  if (!chosen) {
    return (
      <AuthLayout
        header={<StepLabel step={1} />}
        title="Create an account"
        subtitle="Find what's on across Pune, or put on your own event."
        footer={<LoginLink state={location.state} />}
      >
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            // Keep location.state so a "log in to book" redirect still works afterwards.
            navigate({ search: `?as=${accountType}` }, { state: location.state });
          }}
        >
          <ChoiceField
            name="role"
            label="How will you use PuneBuzz?"
            options={ACCOUNT_TYPES}
            value={accountType}
            onChange={setAccountType}
          />
          <Button type="submit" size="lg" fullWidth>
            Next
          </Button>
        </form>
      </AuthLayout>
    );
  }

  // ---------------------------------------------------------------- step 2
  return (
    <AuthForm
      key={chosen.value}
      header={
        <>
          <button
            type="button"
            onClick={() => navigate({ search: '' }, { state: location.state, replace: true })}
            className="mb-5 text-sm font-medium text-ink-muted transition hover:text-ink"
          >
            ← Back
          </button>
          <StepLabel step={2} />
        </>
      }
      title="Your details"
      subtitle={
        <>
          Signing up to <span className="font-medium text-ink">{chosen.label.toLowerCase()}</span>.
        </>
      }
      fields={DETAIL_FIELDS}
      validate={validateDetails}
      submitLabel="Create account"
      onSubmit={async ({ name, email, password }) => {
        const newUser = await register({ name, email, password, role: chosen.value });
        // New organizers go straight to creating their first event, unless a
        // protected page sent them here (then go back there).
        const landing = newUser.role === 'organizer' && !location.state?.from ? '/events/new' : target;
        navigate(landing, { replace: true });
      }}
      footer={<LoginLink state={location.state} />}
    />
  );
}
