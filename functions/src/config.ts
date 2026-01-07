import { defineSecret, defineString } from 'firebase-functions/params';

export const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
export const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
export const SENDGRID_API_KEY = defineSecret('SENDGRID_API_KEY');

export const APP_BASE_URL = defineString('APP_BASE_URL', { default: 'http://localhost:3000' }); // e.g. https://YOUR_DOMAIN
export const ADMIN_EMAIL_ALLOWLIST = defineString('ADMIN_EMAIL_ALLOWLIST', { default: '' }); // comma-separated emails

export const SENDGRID_FROM_EMAIL = defineString('SENDGRID_FROM_EMAIL', { default: 'no-reply@example.com' }); // e.g. no-reply@YOUR_DOMAIN

export const STRIPE_CONNECT_RETURN_PATH = '/creator/stripe' as const;
export const STRIPE_CONNECT_REFRESH_PATH = '/creator/stripe' as const;
