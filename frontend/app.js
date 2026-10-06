const message = document.querySelector('#message');

fetch('/api/config')
  .then(response => response.json())
  .then(config => {
    document.querySelector('#acs-url').textContent = config.callbackUrl;
    if (config.idpInitiatedUrl) {
      const launchLink = document.querySelector('#idp-launch');
      launchLink.href = config.idpInitiatedUrl;
      launchLink.hidden = false;
    }
    if (!config.samlConfigured) {
      message.hidden = false;
      message.textContent = 'SAML is not configured yet. Set the Auth0 SAML entry point and signing certificate in .env.';
    }
    const logoutStatus = document.querySelector('#logout-status');
    logoutStatus.textContent = config.samlLogoutConfigured
      ? 'SAML Single Logout is enabled. Sign out here or initiate logout from the Auth0 IdP.'
      : config.samlLogoutMessage || 'Logout ends the local session; Auth0 logout is optional.';
  })
  .catch(() => {
    document.querySelector('#acs-url').textContent = `${window.location.origin}/auth/saml/acs`;
  });

fetch('/auth/me')
  .then(async response => {
    if (response.status === 401) return null;
    if (!response.ok) throw new Error(`Session request failed (${response.status}).`);
    return response.json();
  })
  .then(payload => {
    if (!payload?.authenticated) return;
    document.querySelector('#signed-out').hidden = true;
    document.querySelector('#signed-in').hidden = false;
    document.querySelector('#flow-label').textContent = `Flow: ${payload.loginFlow || 'SAML SSO'}`;
    const user = payload.user;
    document.querySelector('#identity-name').textContent = user.displayName || user.email;
    document.querySelector('#identity-email').textContent = user.email || 'Email claim not provided';
    document.querySelector('#avatar').textContent = (user.displayName || user.email || '?').slice(0, 1).toUpperCase();
    document.querySelector('#claims').textContent = JSON.stringify(user, null, 2);
  })
  .catch(() => {
    message.hidden = false;
    message.textContent = 'Unable to load the current session.';
  });

if (new URLSearchParams(location.search).has('error')) {
  message.hidden = false;
  message.textContent = 'SAML sign-in failed. Check server logs and Auth0/SAML settings.';
}

if (new URLSearchParams(location.search).get('flow') === 'logout') {
  document.querySelector('#logout-result').hidden = false;
}
