// Runs Zod schemas against req.body / req.query / req.params and replaces them
// with the parsed values. Unknown keys are stripped (z.object default), so
// controllers only ever see fields the schema declares.
// Usage: validate({ body: schema, query: schema, params: schema })
const { ZodError } = require('zod');

const PARTS = ['params', 'query', 'body'];

function validate(schemas) {
  return function validateRequest(req, res, next) {
    const issues = [];
    const parsed = {};

    for (const part of PARTS) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (result.success) {
        parsed[part] = result.data;
      } else {
        issues.push(...result.error.issues.map((i) => ({ ...i, path: [part, ...i.path] })));
      }
    }

    if (issues.length) return next(new ZodError(issues));

    for (const [part, value] of Object.entries(parsed)) {
      // Express 5 exposes req.query as a getter, so plain assignment throws.
      Object.defineProperty(req, part, { value, writable: true, configurable: true, enumerable: true });
    }
    next();
  };
}

module.exports = validate;
