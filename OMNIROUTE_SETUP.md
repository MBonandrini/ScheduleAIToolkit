# OmniRoute browser setup

The suite defaults to OmniRoute at `http://localhost:20128/v1`.

## Recommended local configuration

1. Start OmniRoute and confirm `http://localhost:20128` opens.
2. Connect at least one provider in OmniRoute. The suite also retries `felo/auto` when the standard `auto` route has no available provider.
3. If this suite is hosted on GitHub Pages, add the exact site origin (for example `https://your-name.github.io`) under OmniRoute Dashboard -> Security -> CORS Allowed Origins. Do not use a wildcard for a public/production deployment.
4. The suite sends a harmless non-empty placeholder Bearer header for normal local/keyless OmniRoute compatibility. No provider API key is stored in the website.
5. If your OmniRoute installation has `REQUIRE_API_KEY=true`, use an Endpoint Key from OmniRoute in the Advanced section of AI Settings. It is session-only in the website. For normal local use with `REQUIRE_API_KEY=false`, no real endpoint key is required.
6. In AI Settings, click Open OmniRoute and then Run Connection Test. The diagnostics separately test `/v1/models` and a real chat completion.

## Browser security

An HTTPS GitHub Pages site calling a local service is a cross-origin browser request. OmniRoute must allow that exact browser origin. Some browsers can also ask for local-network/loopback permission. These are browser/server security controls and cannot be bypassed safely from JavaScript.
