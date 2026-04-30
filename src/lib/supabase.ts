/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Strict URL validation: must be a string and start with http
const isValidUrl = typeof rawUrl === 'string' && rawUrl.startsWith('http');
const supabaseUrl = isValidUrl ? rawUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = rawKey || 'placeholder-key';

if (!isValidUrl) {
  console.warn('Supabase URL is missing or invalid. Using placeholder URL.');
}

if (!rawKey) {
  console.warn('Supabase Anon Key is missing. Using placeholder key.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
