# MossChat Vercel edge proxy

`mosschat.xyz` remains on Cloudflare DNS, while this Worker forwards all general
site traffic to the stable Vercel production alias. Cloudflare's more-specific
`/feedback` routes continue to be served by the `mosschat-feedback` Worker.

Deploy after changing this Worker:

```bash
npx wrangler@3.114.10 deploy
```
