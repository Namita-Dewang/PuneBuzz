import { useState } from 'react';
import { getErrorMessage, getFieldErrors } from '../utils/apiError';
import AuthLayout from './AuthLayout';
import PasswordInput from './PasswordInput';
import { Button, Field, Input } from './ui';

// Shared by the login and register pages.
// - fields: [{ name, label, type, autoComplete, minLength, hint }]; type
//   'password' gets a show/hide eye button.
// - validate(values) (optional): client-side checks, returning { field: message }.
//   Shown after the first submit attempt, then updated as the user types.
// - header (optional): content above the title, e.g. a step indicator.
// - onSubmit(values) should throw the Axios error on failure; server field
//   errors are shown under their inputs, anything else above the button.
export default function AuthForm({ title, subtitle, header, fields, validate, submitLabel, onSubmit, notice, footer }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ''])));
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const clientErrors = attempted && validate ? validate(values) : {};
  const serverErrors = getFieldErrors(error);
  const fieldErrors = { ...serverErrors, ...clientErrors };
  const hasServerFieldErrors = Object.keys(serverErrors).length > 0;

  async function handleSubmit(event) {
    event.preventDefault();
    setAttempted(true);
    const problems = validate ? validate(values) : {};
    if (Object.keys(problems).length) {
      document.getElementById(Object.keys(problems)[0])?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout header={header} title={title} subtitle={subtitle} footer={footer}>
      {notice && (
        <p className="mb-5 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">{notice}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {fields.map((field) => {
          const fieldError = fieldErrors[field.name];
          return (
            <Field key={field.name} name={field.name} label={field.label} hint={field.hint} error={fieldError}>
              {(p) => {
                const inputProps = {
                  ...p,
                  autoComplete: field.autoComplete,
                  minLength: field.minLength,
                  required: true,
                  invalid: Boolean(fieldError),
                  value: values[field.name],
                  onChange: (e) => {
                    const { value } = e.target;
                    setValues((v) => ({ ...v, [field.name]: value }));
                  },
                };
                return field.type === 'password' ? (
                  <PasswordInput {...inputProps} />
                ) : (
                  <Input {...inputProps} type={field.type ?? 'text'} />
                );
              }}
            </Field>
          );
        })}

        {error && !hasServerFieldErrors && (
          <p role="alert" className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
            {getErrorMessage(error)}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={submitting}>
          {submitting ? 'Please wait…' : submitLabel}
        </Button>
      </form>
    </AuthLayout>
  );
}
