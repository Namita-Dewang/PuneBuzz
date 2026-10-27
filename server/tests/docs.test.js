// Keeps the OpenAPI spec honest: every route the app serves must be
// documented, and every documented operation must exist.
const request = require('supertest');
const app = require('../src/app');
const mounts = require('../src/routes');
const openapi = require('../src/docs/openapi');
const { pool } = require('./helpers/db');

afterAll(() => pool.end());

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

// "/events" + "/:id/rsvp" -> "/events/{id}/rsvp"
function toOpenApiPath(mount, routePath) {
  const joined = `${mount}${routePath === '/' ? '' : routePath}`;
  return joined.replace(/:(\w+)/g, '{$1}');
}

const served = mounts.flatMap(({ path, router }) =>
  router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${toOpenApiPath(path, layer.route.path)}`)
    )
);

const documented = Object.entries(openapi.paths).flatMap(([path, item]) =>
  METHODS.filter((m) => item[m]).map((m) => `${m.toUpperCase()} ${path}`)
);

describe('OpenAPI docs', () => {
  it('found the routes to compare (sanity check)', () => {
    // 1 health + 3 auth + 8 events/RSVP + 2 venues + 1 me, at the time of writing.
    expect(served.length).toBeGreaterThanOrEqual(15);
  });

  it('documents every route the app serves', () => {
    expect(served.filter((r) => !documented.includes(r))).toEqual([]);
  });

  it('documents no route that does not exist', () => {
    expect(documented.filter((r) => !served.includes(r))).toEqual([]);
  });

  it('only references schemas and responses that are defined', () => {
    const refs = [...JSON.stringify(openapi).matchAll(/"#\/components\/(schemas|responses)\/(\w+)"/g)];
    const missing = refs.filter(([, kind, name]) => !openapi.components[kind][name]).map(([, kind, name]) => `${kind}/${name}`);
    expect(missing).toEqual([]);
  });

  it('serves the raw spec at /api/docs.json', async () => {
    const res = await request(app).get('/api/docs.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
  });

  it('serves Swagger UI at /api/docs', async () => {
    const res = await request(app).get('/api/docs/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});

describe('security headers (helmet)', () => {
  it('sets the standard helmet headers on API responses', async () => {
    const res = await request(app).get('/api/v1/venues');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('still sends CORS headers for the allowed client origin', async () => {
    const res = await request(app).get('/api/v1/venues').set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('sends no CORS allow header for other origins', async () => {
    const res = await request(app).get('/api/v1/venues').set('Origin', 'https://evil.example');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
