const express = require('express');
const cors = require('cors');
const corsOptions = require('./config/cors');
const { JSON_BODY_LIMIT } = require('./config/env');
const { authMiddleware } = require('./middlewares/auth.middleware');
const { errorMiddleware } = require('./middlewares/error.middleware');
const { notFound } = require('./middlewares/notFound.middleware');

const partyRoutes = require('./modules/parties/party.routes');
const zonePartiesRoutes = require('./modules/zoneParties/zoneParties.routes');
const partyProductRoutes = require('./modules/partyProducts/partyProduct.routes');
const partyOrderProductsRateRoutes = require('./modules/partyOrderProductsRate/partyOrderProductsRate.routes');

const app = express();

app.use(cors(corsOptions));
app.use(express.json({ limit: JSON_BODY_LIMIT || '50mb' }));
app.use(express.urlencoded({ limit: JSON_BODY_LIMIT || '50mb', extended: true }));

app.use(authMiddleware);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'party-service', timestamp: new Date().toISOString() });
});

app.use('/api/parties', partyRoutes);
app.use('/api/zones', zonePartiesRoutes);
app.use('/api/party-products', partyProductRoutes);
app.use('/api/party-order-products-rate', partyOrderProductsRateRoutes);

app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
