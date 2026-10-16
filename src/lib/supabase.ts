/**
 * MWA Enablers Report 2570 - Supabase Client
 * 
 * เชื่อมต่อกับ Supabase โดยใช้ VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY
 * หมายเหตุความปลอดภัย:
 * - ใช้เฉพาะ Publishable Key (Anon Key) ฝั่ง Browser เท่านั้น
 * - ห้ามใช้ service_role หรือ Secret Key ในโค้ดฝั่ง Client เด็ดขาด
 * - การควบคุมสิทธิ์เข้าถึงจัดการผ่าน Row Level Security (RLS) บนตาราง public.enablers_reports
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL_STORAGE_KEY = 'mwa_supabase_url_override';
const SUPABASE_ANON_KEY_STORAGE_KEY = 'mwa_supabase_anon_key_override';

/**
 * ดึงค่า Supabase Project URL
 */
export function getSupabaseUrl(): string {
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem(SUPABASE_URL_STORAGE_KEY);
    if (override && override.trim()) return override.trim();
  }
  return (import.meta.env.VITE_SUPABASE_URL || '').trim();
}

/**
 * ดึงค่า Supabase Publishable / Anon Key
 */
export function getSupabaseAnonKey(): string {
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem(SUPABASE_ANON_KEY_STORAGE_KEY);
    if (override && override.trim()) return override.trim();
  }
  return (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
}

/**
 * ตรวจสอบว่าได้กำหนดค่าเชื่อมต่อ Supabase ถูกต้องหรือไม่
 */
export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) return false;
  if (!url.startsWith('https://')) return false;
  if (url.includes('YOUR_SUPABASE') || key.includes('YOUR_SUPABASE')) return false;

  return true;
}

let clientInstance: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

/**
 * รับ instance ของ Supabase Client (Singleton with dynamic config support)
 */
export function getSupabaseClient(): SupabaseClient {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!isSupabaseConfigured()) {
    throw new Error(
      'ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase: กรุณาระบุ VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ในสภาพแวดล้อม'
    );
  }

  // Re-instantiate if config changed
  if (!clientInstance || lastUsedUrl !== url || lastUsedKey !== key) {
    clientInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    lastUsedUrl = url;
    lastUsedKey = key;
  }

  return clientInstance;
}

/**
 * Helper บันทึกการตั้งค่าชั่วคราวสำหรับสภาพแวดล้อมทดสอบ
 */
export function setSupabaseConfigOverride(url?: string, anonKey?: string): void {
  if (typeof window === 'undefined') return;
  if (url && url.trim()) {
    localStorage.setItem(SUPABASE_URL_STORAGE_KEY, url.trim());
  } else if (url !== undefined) {
    localStorage.removeItem(SUPABASE_URL_STORAGE_KEY);
  }

  if (anonKey && anonKey.trim()) {
    localStorage.setItem(SUPABASE_ANON_KEY_STORAGE_KEY, anonKey.trim());
  } else if (anonKey !== undefined) {
    localStorage.removeItem(SUPABASE_ANON_KEY_STORAGE_KEY);
  }

  clientInstance = null;
}

/**
 * Default Supabase Client export (safe singleton or null if not configured)
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? getSupabaseClient()
  : null;
