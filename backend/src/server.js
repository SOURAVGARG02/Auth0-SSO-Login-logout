const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const session = require('express-session');
const { passport, samlStatus, samlLogoutStatus } = require('./auth/passport');
const authRoutes = require('./routes/auth');
const { readConfig } = require('./config/saml');

const config = readConfig();
if (!config.sessionSecret || config.sessionSecret.length < 32 ||
    /replace|change-me|your_/i.test(config.sessionSecret)) {
  throw new Error('Set SESSION_SECRET in .env to a unique random value of at least 32 characters.');
}

const app = express();
const frontendDir = path.resolve(__dirname, '../../frontend');

app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(session({
  name: 'paxafe.sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 60 * 1000,
    sameSite: samlLogoutStatus.configured ? 'none' : 'lax',
    httpOnly: true,
    secure: samlLogoutStatus.configured || process.env.NODE_ENV === 'production',
  },
}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    samlConfigured: samlStatus.configured,
    appBaseUrl: config.appBaseUrl,
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    callbackUrl: config.callbackUrl,
    idpInitiatedUrl: config.idpInitiatedUrl || null,
    samlConfigured: samlStatus.configured,
    samlLogoutConfigured: samlLogoutStatus.configured,
    samlLogoutMessage: samlLogoutStatus.message,
  });
});

app.use('/auth', authRoutes);
app.use(express.static(frontendDir));

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === 'SAML_REPLAY') {
    return res.status(409).send('SAML replay rejected.');
  }

  console.error('Request failed:', error.message);
  return res.status(500).send('The request could not be completed.');
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Paxafe SSO demo listening on http://localhost:${config.port}`);
  });
}

module.exports = { app };
