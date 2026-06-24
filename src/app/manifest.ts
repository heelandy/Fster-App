import type { MetadataRoute } from 'next';

/**
 * Web App Manifest (served at /manifest.webmanifest) — makes the app installable
 * as a PWA on Android, desktop Chrome/Edge, and iOS "Add to Home Screen". Launches
 * standalone (no browser chrome) from the dashboard, themed in the coral brand.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Foster Care Home Management System',
    short_name: 'Foster',
    description:
      'Securely manage placements, appointments, documents, medications, expenses, and more.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbf4ee',
    theme_color: '#dd6647',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
