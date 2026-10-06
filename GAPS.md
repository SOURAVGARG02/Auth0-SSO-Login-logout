# Configuration and production gaps

| Gap | Demo behavior | Before production |
|---|---|---|
| Auth0 tenant and test user | Values are placeholders; no tenant access details were provided. | Configure a disposable tenant and test both login flows end to end. |
| Tenant/customer discovery | One IdP configuration is used. | Define tenant isolation, home-realm discovery, and onboarding for customer IdPs. |
| Canonical SP URLs and claims | Values come from `.env`; email-address NameID and selected name claims are displayed. | Register stable HTTPS URLs and agree on required claim formats and missing-claim policy. |
| User persistence and account linking | No user records are stored. | Decide JIT provisioning and link identities by trusted issuer plus immutable NameID; define verified account linking. |
| Replay/request caches | Bounded in-memory assertion-ID replay guard plus the SAML library's in-memory request-ID cache. | Replace with shared atomic TTL-backed caches before running multiple instances. |
| Sessions | In-memory Express session store, 30-minute cookie. | Use a shared durable store, HTTPS-only cookies, CSRF controls, and revocation policy. |
| Logout | Clears the local session and optionally redirects through Auth0 logout. No SAML SLO or IdP-originated logout handler. | Agree logout semantics and implement/test signed SLO callbacks if required. |
| Signing certificate lifecycle | One configured Auth0 signing certificate. | Define secure distribution, rollover, monitoring, and rollback. |

This is a local integration demo, not a verified production Auth0 deployment. The implementation should not be represented as end-to-end verified until a disposable tenant and test account have been configured and used to exercise both login flows.
