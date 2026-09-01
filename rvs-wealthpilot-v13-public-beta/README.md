# RVS WealthPilot — V13 Public Beta

AI Investing Copilot for Indian mutual-fund research and portfolio understanding.

## Public Beta features
- Live mutual-fund NAV search through a server-side AMFI feed.
- Portfolio dashboard and illustrative XIRR/return views.
- Monthly investment planner.
- SIP reminder workflow preview.
- Market mood / intelligence UI.
- User profile: name, email, mobile and profile photo.
- Persistent AI-created-tool disclaimer.
- Public-beta banner and demo-data disclosure.

## Important
AMFI provides latest NAV and historical NAV facilities; historical NAV downloads are limited to 90 days per request. https://www.amfiindia.com/net-asset-value/nav-download

AMFI also states that its information may not account for individual objectives/risk and that historical performance is not a guarantee of future results. Users should verify current information and suitability before investing. https://www.amfiindia.com/investor

This application is a prototype/public beta and is not financial advice. Do not expose secrets in GitHub.

## Run locally
```bash
npm install
npm run dev -- --webpack
```

## Deploy
Push the repository to GitHub and import it into Vercel. No AMFI API key is required for the current NAV connector.
