# Decisions

## Questions for the stakeholder

- Which customer organizations and user populations are in scope, and will they share one Auth0 tenant?
- Is Auth0 the fixed IdP, or is the goal to support customer-managed IdPs? What onboarding and tenant discovery are expected?
- Which issuer, ACS URL, NameID format, and claims are contractual? Is email an identifier or only a mutable contact attribute?
- Which Auth0 launch surface should represent IdP initiation, and must it work for every customer?
- What session lifetime, logout semantics, account linking, JIT provisioning, and audit requirements apply?
- Which HTTPS origins will be registered, and who owns Auth0 configuration and signing-certificate rotation?

## Assumptions

This is a single-tenant localhost demo. Auth0 is the SAML IdP and this Node service is the SP. The SP entity ID is `SAML_ISSUER`; the ACS is `SAML_CALLBACK_URL` (default `${APP_BASE_URL}/auth/saml/acs`). NameID is email-address format, and the demo retains only NameID, issuer, session index, email, and selected name attributes. No tenant credentials or test users were supplied, so actual end-to-end authentication remains dependent on local Auth0 configuration.

## Validation and replay handling

- `@node-saml/passport-saml` performs SAML parsing and cryptographic validation; the application does not parse or validate XML signatures itself. The configured IdP certificate is trusted, and at least one of the response or assertion signatures must validate (Auth0 can be configured to sign either one). The library validates the audience and assertion time conditions. After signature validation, the application checks that every assertion subject-confirmation recipient exactly matches the configured ACS URL.
- SP-initiated request IDs are checked by the library's in-memory request cache when `InResponseTo` is present. `ifPresent` is necessary on the shared ACS because Auth0 IdP-initiated responses have no `InResponseTo`.
- After library validation, the verify callback obtains the ID from the parsed assertion and claims it in a bounded ten-minute in-memory replay cache. Duplicate IDs are rejected; the cache refuses new assertions rather than evicting unexpired IDs when full. The assertion age is limited to five minutes (with two minutes of accepted clock skew).
- Both request and assertion caches are local to one Node process. This protects this single-process demo but is not a multi-instance replay defense. A production deployment needs a shared, atomic, TTL-backed store and operational monitoring.

## Sessions, identity, and logout

- Express sessions use an HTTP-only, SameSite=Lax cookie and a 30-minute lifetime. The default Express in-memory store is intentionally limited to this demo; production should use a shared store, HTTPS-only cookies, explicit CSRF protections, and session revocation policy.
- No user database is built. If JIT provisioning is added, key the external identity by trusted IdP issuer plus immutable SAML NameID. Email is mutable and should not be the only durable key. Account linking requires a verified-email or administrator-approved policy.
- When the Auth0 tenant exposes SAML SLO, SP logout sends a signed LogoutRequest and validates the correlated LogoutResponse; the callback handles signed IdP LogoutRequests and removes the Passport identity. Local app session state remains the authorization source of truth. SLO requires a public HTTPS callback and an SP key pair. If SLO is unavailable or unconfigured, local logout still destroys the session and may redirect through Auth0 `/v2/logout`; that fallback cannot notify the SP of a separate IdP-originated logout.

## Scope and follow-up

The Auth0 tenant, test account, HTTPS deployment, multi-tenant configuration, signing-certificate rotation, authorization, and persistent user provisioning are outside the supplied assignment inputs. Configure a disposable Auth0 tenant and exercise both login flows and (if the tenant supports it) both logout directions. Then add negative integration tests for duplicate assertions, invalid signatures, wrong audience/recipient, and expired assertions; move session and replay/request caches to shared stores before multi-instance deployment.

## AI use

The assignment was compared against the parallel `paxafe-copilot` implementation as a reference. AI assistance was used to inspect both implementations, align the backend routes and frontend flow, and add the replay guard and focused tests. The implementer should still configure and personally exercise the Auth0 tenant before presenting this as a verified live integration.
