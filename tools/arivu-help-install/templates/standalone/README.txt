Arivu Help Center — Vercel (standalone)
=========================================

Deploy this folder as a new Vercel project. No copying into an existing app.

1. Import to Vercel (vercel.com/new → Import, or `npx vercel`)
2. Add environment variables from .env (Vercel → Settings → Environment Variables)
3. Create a Deploy Hook (Settings → Git → Deploy Hooks) → paste URL into VERCEL_DEPLOY_HOOK_URL
4. In Arivu → Articles settings, set publish webhook to https://yoursite.com/api/arivu-webhook
5. Deploy — build syncs articles into public/help/ as SEO-ready HTML

Each publish triggers a redeploy via the webhook → fresh static HTML.

Already have a Next.js site on the same domain?
Use "Add to existing project" in Arivu settings, or use the embed deploy kit instead.
