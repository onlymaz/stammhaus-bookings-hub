# Deployment Guide

This project is a Vite single-page app that connects directly to Supabase.

## Quick Deploy

Run:

```sh
npm run deploy:kit
```

That command will:

1. build the production app into `dist/`
2. copy an Apache SPA fallback file to `dist/.htaccess`
3. copy an Nginx example config to `dist/_hosting/nginx.conf`
4. copy a short upload note to `dist/_hosting/DEPLOY-README.txt`

## What To Upload

Upload the contents of `dist/` to your web hosting public folder.

Examples:

- cPanel / Apache: upload all files from `dist/` into `public_html/`
- Nginx VPS: upload all files from `dist/` into your site root such as `/var/www/stammhaus-bookings-hub/`

## Apache Or cPanel

Keep the generated `dist/.htaccess` file in the upload root.

It handles React Router fallback so routes like `/auth` still load correctly.

## Nginx

Use the example file at `config/deploy/nginx.conf` or the generated copy at `dist/_hosting/nginx.conf`.

The important part is:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## Environment Variables

This frontend reads:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Those values are embedded during the build step. If they change, rebuild and re-upload the app.

## Notes

- You do not need to run Node.js on the web host for normal frontend hosting.
- You normally deploy the built `dist/` folder, not the raw source code.
- Supabase Edge Functions stay hosted in Supabase and are not deployed with the static site.
