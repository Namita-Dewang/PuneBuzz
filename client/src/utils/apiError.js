// Helpers for the API's error shape: { error: { code, message, details? } }

export function getErrorCode(error) {
  return error?.response?.data?.error?.code ?? null;
}

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return null;
  if (!error.response) {
    return error.code === 'ECONNABORTED'
      ? 'The server took too long to respond. Please try again.'
      : "Can't reach the server. Check your connection and try again.";
  }
  return error.response.data?.error?.message ?? fallback;
}

// VALIDATION_ERROR details as { fieldName: message }, e.g. { email: 'Invalid email address' }.
// The API reports paths like "body.email"; the first message per field wins.
export function getFieldErrors(error) {
  const details = error?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  const fields = {};
  for (const { path, message } of details) {
    const field = String(path).replace(/^(body|query|params)\./, '');
    if (!(field in fields)) fields[field] = message;
  }
  return fields;
}
