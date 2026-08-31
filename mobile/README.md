# Arivu Mobile (Capacitor)

Dedicated **mobile-native UX** for iOS/Android — not the responsive desktop shell.

## Architecture

```
mobile/          Mobile Vue app + Capacitor (android/, ios/)
client/          Desktop + responsive web (unchanged)
server/          Shared API
```

Same backend, same auth — **separate mobile UI** aligned to Arivu brand tokens.

## Run locally

```bash
cd mobile
cp .env.example .env   # VITE_API_ORIGIN=http://localhost:3000
npm install
npm run dev            # http://localhost:5174
```

## Native build

```bash
npm run generate:icons   # App icon + splash from client/public/assets/logo/ (Logo_light, Logo_dark)
VITE_API_ORIGIN=http://localhost:3000 npm run cap:sync:native
npx cap open ios
# or
npx cap open android
```

## Mobile UX

**First launch:** welcome carousel → login → home hub.

| Surface | Purpose |
|---------|---------|
| **Home hub** | Workspace header, search, metric cards, recents, collapsible inbox/tasks/modules |
| **Inbox** | Thread list → read → reply |
| **Tasks** | My open tasks → complete |
| **Floating nav** | Home · Inbox · Tasks · Apps grid + **Ask** pill above the nav |
| **Astra** | Floating “Ask” pill (logo + label) above the nav — opens full-screen AI chat |
| **Apps sheet** | Permission-aware module launcher (People, Deals, Cases, …) |
| **FAB (+)** | Quick jump to common modules |
| **Search** | Global search across your workspace data |

### Modules

People · Organizations · Deals · Events · Cases · Forms · Items · Responses — list + detail views backed by the shared API. Modules appear only when permitted.

## Brand

Arivu primary `#6049E7`, neutral palette, Inter — matched to `client/src/assets/main.css` tokens. Floating pill navigation and bottom sheets for a native feel.

## Desktop parity

Full CRM editing remains on **web** (`client/`). Mobile is read-first with quick navigation — not a desktop wrapper.
