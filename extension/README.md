# NewsIntel Browser Extension

Manifest V3 extension that shows, for any open news article, which other
outlets covered the same story, who broke it first, and the ideological lean
spread of coverage. Calls the local NewsIntel API's `GET /lookup?url=...`.

## Loading in development

**Chrome / Edge / Brave**

1. Visit `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select this directory

**Firefox**

1. Visit `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…** → pick `manifest.json`

## Configuration

Click the ⚙ icon inside the popup to change the API URL (defaults to
`http://localhost:8000`).

## Icons

PNG icons live in `icons/`. Replace the placeholders with real artwork before
publishing to the Chrome Web Store or AMO.
