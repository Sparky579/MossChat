# MossChat feedback worker

This Cloudflare Worker receives browser feedback and sends it to `1779894826@qq.com` through Resend. It accepts requests only from `https://chat.utilgadgets.com` by default.

From this directory, set the required secrets:

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_FROM
```

`RESEND_FROM` must be a sender verified in Resend, for example `MossChat Feedback <feedback@utilgadgets.com>`.

To use the release notification checkbox, create a Resend Audience and set its ID:

```bash
npx wrangler secret put RESEND_AUDIENCE_ID
```

Deploy the Worker:

```bash
npx wrangler deploy
```

In Cloudflare, attach the Worker to the route `chat.utilgadgets.com/feedback`. The browser form uses `/feedback`, so this route keeps feedback on the same public origin. If a separate Worker domain is preferred, build MossChat with `NEXT_PUBLIC_FEEDBACK_ENDPOINT` set to its full URL.
