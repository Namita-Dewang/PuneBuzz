const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const env = require('./config/env');
const mounts = require('./routes');
const openapi = require('./docs/openapi');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);
// Security headers. The defaults suit a JSON API; Swagger UI's assets are
// served from this origin, so the default Content-Security-Policy allows them.
app.use(helmet());
// exposedHeaders: lets the client read the Excel export's filename.
app.use(cors({ origin: env.CORS_ORIGIN, exposedHeaders: ['Content-Disposition'] }));
app.use(express.json({ limit: '100kb' }));

const api = express.Router();
for (const { path, router } of mounts) api.use(path, router);
app.use('/api/v1', api);

app.get('/api/docs.json', (req, res) => res.json(openapi));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, {
  customSiteTitle: 'PuneBuzz API',
  swaggerOptions: { persistAuthorization: true },
}));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
