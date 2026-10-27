import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { useApply } from '../../hooks/useVolunteer';
import { getErrorCode, getErrorMessage, getFieldErrors } from '../../utils/apiError';
import ChoiceField from '../ChoiceField';
import { Button, Field, Input, Modal, Textarea } from '../ui';

const EMPTY = { motivation: '', volunteeredBefore: '', pastExperience: '', skills: '', availability: '', phone: '' };

const AVAILABILITY = [
  { value: 'full', label: 'The whole event', description: 'From setup to the end.' },
  { value: 'partial', label: 'Part of it', description: "You'll agree the hours with the organizer." },
  { value: 'setup', label: 'Setup and pack-up only', description: 'Before doors open and after it ends.' },
];

const YES_NO = [
  { value: 'yes', label: 'Yes', description: "I've volunteered before." },
  { value: 'no', label: 'Not yet', description: 'This would be my first time.' },
];

// Mirrors the server's rules (validators/volunteer.schemas.js) so most
// mistakes show before submitting.
function validate(v) {
  const errors = {};
  if (v.motivation.trim().length < 20) errors.motivation = 'Tell the organizer a little more (at least 20 characters).';
  if (!v.volunteeredBefore) errors.volunteeredBefore = 'Please answer yes or no.';
  if (!v.availability) errors.availability = 'Choose how much of the event you can help with.';
  if (!/^\+?[0-9][0-9 ()-]{6,18}[0-9]$/.test(v.phone.trim())) errors.phone = 'Enter a valid phone number, e.g. +91 98765 43210.';
  return errors;
}

// The application form, shared by the Volunteer page and the event page.
// `target`: { role: { id, title }, eventTitle } or null when closed.
export default function ApplyModal({ target, onClose }) {
  const apply = useApply();
  const [values, setValues] = useState(EMPTY);
  const [attempted, setAttempted] = useState(false);

  // Fresh form each time it opens for a role.
  useEffect(() => {
    if (target) {
      setValues(EMPTY);
      setAttempted(false);
      apply.reset();
    }
  }, [target?.role.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const serverErrors = getFieldErrors(apply.error);
  const errors = { ...serverErrors, ...(attempted ? validate(values) : {}) };
  const generalError = apply.error && !Object.keys(serverErrors).length ? getErrorMessage(apply.error) : null;
  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: typeof e === 'string' ? e : e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setAttempted(true);
    const problems = validate(values);
    if (Object.keys(problems).length) {
      document.getElementById(`apply-${Object.keys(problems)[0]}`)?.focus();
      return;
    }
    try {
      await apply.mutateAsync({
        roleId: target.role.id,
        answers: {
          motivation: values.motivation.trim(),
          volunteeredBefore: values.volunteeredBefore === 'yes',
          pastExperience: values.volunteeredBefore === 'yes' ? values.pastExperience.trim() || null : null,
          skills: values.skills.trim() || null,
          availability: values.availability,
          phone: values.phone.trim(),
        },
      });
      onClose();
    } catch {
      // Shown in the form (field errors or the message below).
    }
  }

  const closedByServer = ['ROLE_FULL', 'EVENT_CLOSED', 'ALREADY_APPLIED'].includes(getErrorCode(apply.error));

  return (
    <Modal
      open={Boolean(target)}
      size="lg"
      title={target ? `Volunteer as ${target.role.title}` : ''}
      description={target?.eventTitle}
      pending={apply.isPending}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={apply.isPending}>
            Cancel
          </Button>
          {!closedByServer && (
            <Button type="submit" form="apply-form" loading={apply.isPending}>
              {!apply.isPending && <Send aria-hidden="true" />}
              {apply.isPending ? 'Sending…' : 'Send application'}
            </Button>
          )}
        </>
      }
    >
      <p>A few quick questions for the organizer. Your answers are only shared with them.</p>
      <form id="apply-form" onSubmit={submit} noValidate className="space-y-6 pt-3 text-ink">
        <Field name="apply-motivation" label="1. Why are you excited to volunteer at this event?" error={errors.motivation}>
          {(p) => (
            <Textarea
              {...p}
              rows={4}
              invalid={Boolean(errors.motivation)}
              maxLength={1000}
              value={values.motivation}
              onChange={set('motivation')}
              placeholder="What draws you to it? What would you like to get out of it?"
            />
          )}
        </Field>

        <div>
          <ChoiceField
            name="apply-volunteeredBefore"
            label="2. Have you volunteered before?"
            columns={2}
            options={YES_NO}
            value={values.volunteeredBefore}
            onChange={set('volunteeredBefore')}
            error={errors.volunteeredBefore}
          />
          {values.volunteeredBefore === 'yes' && (
            <Field name="apply-pastExperience" label="Tell us about it" optional className="mt-3" error={errors.pastExperience}>
              {(p) => (
                <Textarea {...p} rows={2} maxLength={1000} value={values.pastExperience} onChange={set('pastExperience')} placeholder="Where, and what did you do?" />
              )}
            </Field>
          )}
        </div>

        <Field name="apply-skills" label="3. What skills or experience can you bring?" optional error={errors.skills}>
          {(p) => (
            <Textarea {...p} rows={2} maxLength={1000} value={values.skills} onChange={set('skills')} placeholder="e.g. first aid, photography, speaking Marathi, crowd management" />
          )}
        </Field>

        <ChoiceField
          name="apply-availability"
          label="4. How much of the event can you help with?"
          options={AVAILABILITY}
          value={values.availability}
          onChange={set('availability')}
          error={errors.availability}
        />

        <Field
          name="apply-phone"
          label="5. Phone number"
          hint="So the organizer can reach you about the day. Only they can see it."
          error={errors.phone}
        >
          {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" invalid={Boolean(errors.phone)} value={values.phone} onChange={set('phone')} placeholder="+91 98765 43210" />}
        </Field>

        {generalError && (
          <p role="alert" className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
            {generalError}
          </p>
        )}
      </form>
    </Modal>
  );
}
