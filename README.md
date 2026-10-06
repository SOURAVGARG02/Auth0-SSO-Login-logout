# Paxafe Auth0 SAML SSO demo

A small Node.js Service Provider (SP) and browser UI for exercising Auth0 as a SAML Identity Provider. It supports SP-initiated login and unsolicited IdP-initiated login, displays selected assertion identity claims, and provides local logout with an optional redirect through Auth0 logout.

## Requirements and local setup

Requires Node.js 20 or later.

```sh
npm install
cp .env.example .env
```

Set a unique session secret in `.env` (for example, generate one with `openssl rand -base64 48`), then fill in the Auth0 SAML values described below. Do not commit `.env`; it is ignored by Git.

```sh
npm start
```

Open <http://localhost:3000>. Run the focused replay-cache tests with `npm test`.

The app can start before Auth0 is configured. `/health` reports whether the SAML settings are present, `/auth/saml/metadata` serves SP metadata, and login attempts return a clear `503` configuration message until the Auth0 entry point and signing certificate are supplied.

## Configure Auth0 as the IdP

Create a disposable Auth0 tenant and a Regular Web Application for the SAML IdP. Enable **Add-ons → SAML2 Web App**. Configure the SAML add-on with:

- **Application Callback URL / ACS / Recipient / Destination:** the `SAML_CALLBACK_URL` value in `.env` (default: `http://localhost:3000/auth/saml/acs`).
- **Audience / SP Entity ID:** the `SAML_ISSUER` value in `.env` (default: `urn:paxafe:saml-demo`).
- **NameID:** email address. Map `email`, `displayName`, `givenName`, and `sn` when available.
- **Response/assertion signing:** enable signing on at least one of the response or assertion. The SP validates whichever trusted signature Auth0 provides.

The SP metadata is available at `/auth/saml/metadata`. It can be used to copy the entity ID and ACS location into Auth0. From the Auth0 SAML add-on's Usage section, copy the IdP Login URL to `SAML_ENTRY_POINT` and the IdP signing certificate to `SAML_IDP_CERT`. PEM newlines may be entered as `\n` inside the quoted `.env` value. If the Auth0 login URL requires a connection hint, set `AUTH0_SAML_CONNECTION`.

For the optional direct IdP-launch link on the page, set `AUTH0_IDP_INITIATED_URL` to the Auth0 SAML application's IdP-initiated launch URL. Alternatively, use the Auth0 dashboard's **Test** tab or the configured application tile. Both should post the unsolicited SAML response to the same ACS above. The UI displays the ACS URL actually configured by the server.

No Auth0 tenant access details or test user credentials are included in this project. Use a disposable tenant and test account; do not use real user data.

## Exercise both login flows

### SP-initiated

Click **Login with SSO** or visit `/auth/saml/login`. The SP sends an AuthnRequest to Auth0; the signed response returns to the ACS. The page identifies the completed flow and displays the normalized user identity.

### IdP-initiated

Start from Auth0's SAML application's **Test** flow or configured dashboard tile (or the optional direct Auth0 launch link). Auth0 sends an unsolicited signed response to the same ACS without an SP request. The page labels the result **IdP-initiated login** and displays the identity.

The app's SP metadata URL is `/auth/saml/metadata`; the session-protected identity endpoint is `/auth/me`.

## Logout

**End local session** destroys the Express session. If `AUTH0_DOMAIN` is set, the browser is also redirected through Auth0's `/v2/logout` endpoint and returned to the app; set `AUTH0_CLIENT_ID` when required by the tenant's logout configuration. This is a pragmatic logout redirect, not SAML Single Logout. An IdP-triggered logout request is not implemented.

## Implementation boundaries

- `backend/src/config/saml.js` loads and validates the IdP settings.
- `backend/src/auth/passport.js` configures Passport SAML and maps a validated assertion to a minimal user object.
- `backend/src/saml/replay-cache.js` rejects reused assertion IDs with a bounded, expiring in-memory cache.
- `backend/src/routes/auth.js` implements login, ACS, metadata, identity, and logout endpoints.
- `frontend/` provides both-flow instructions and displays the session identity without rendering raw assertion XML.
- `DECISIONS.md` records the assumptions, validation and session tradeoffs, and remaining production work.

SAML request IDs and sessions are held in process memory, which is appropriate only for this single-process demo. For multiple instances, use a shared session store and shared atomic replay/request cache. Tenant setup and end-to-end login cannot be verified until an Auth0 tenant and test account are configured.
