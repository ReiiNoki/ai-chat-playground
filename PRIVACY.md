# Privacy Policy for AI Chat Playground

Last updated: September 4, 2026

AI Chat Playground is a browser extension for testing user-configured, OpenAI-compatible API endpoints. The extension does not operate a developer-controlled backend and does not collect, sell, or use personal information for advertising or analytics.

## Data stored locally

The extension may store the following data in `chrome.storage.local` in the user's browser profile:

- API endpoint URLs and model configuration
- API keys entered by the user
- System prompts
- Chat messages and compatible reasoning output
- Saved custom endpoints and open chat tabs
- Interface language and keyboard shortcut preferences

API keys are stored locally as plain text within the extension's isolated Chrome storage area. Users should avoid using keys with unnecessary privileges and may remove all saved keys from the extension's Local data settings.

## Data sent to third parties

When the user loads models, tests a connection, or sends a chat message, the extension sends the necessary request data directly to the API endpoint selected by the user. Depending on the action, this may include:

- The API key
- The selected model and generation parameters
- System prompts and chat messages

These requests are governed by the privacy policy and terms of the selected API provider. The extension developer does not receive these requests.

For a custom endpoint, the extension may request the endpoint origin's favicon and home page without cookies or a referrer in order to display a tab icon. Favicon discovery is limited to the same origin as the configured endpoint; redirects or icon declarations pointing to other origins are ignored. The downloaded page is only inspected for favicon declarations and is not executed.

## Host access

The extension requests access only to an API origin when the user attempts to save or use that endpoint. The permission is used for API requests and, for custom endpoints, favicon discovery. The extension does not inject scripts into websites or read browsing history.

## Data sharing

The extension does not sell user data. It does not share data with the extension developer, advertisers, data brokers, or analytics services. Data is transmitted only to endpoints explicitly selected by the user as necessary to provide the requested API-testing functionality.

## Retention and deletion

Data remains in the user's local Chrome profile until it is cleared by the user or the extension is removed. The extension provides controls to clear the current chat, clear all chat messages, and remove all saved API keys.

## Security

The extension uses HTTPS when the configured endpoint uses HTTPS. Users may configure HTTP endpoints, including local development servers; HTTP traffic is not encrypted in transit. Users are responsible for selecting trusted API endpoints and protecting their API credentials.

## Changes

This policy may be updated when the extension's data practices change. The published version will show the latest revision date.

## Contact

Questions about this policy can be sent through the support contact listed on the AI Chat Playground Chrome Web Store page.
