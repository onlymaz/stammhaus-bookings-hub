Stammhaus Bookings Hub deploy kit

1. Build the app:
   npm run deploy:kit

2. Upload everything inside the dist folder to your hosting document root.

3. If your hosting uses Apache or cPanel:
   Keep the generated .htaccess file in the upload root.

4. If your hosting uses Nginx:
   Upload the dist contents and apply _hosting/nginx.conf on the server.

5. This app is a static frontend.
   The current VITE_SUPABASE_* values are baked in at build time.

6. If you change Supabase project values later:
   Update .env, rebuild, and upload the new dist contents again.
