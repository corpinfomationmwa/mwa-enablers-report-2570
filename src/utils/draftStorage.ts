/**
 * MWA Enablers Report 2570 - Draft Storage Utility
 * 
 * หน้าที่:
 * 1. บันทึกและกู้คืน Form Draft อัตโนมัติ (Autosave) ระหว่างที่ผู้ใช้กำลังพิมพ์
 * 2. จัดการ submissionId แบบคงที่เพื่อป้องกันการส่งซ้ำ (Idempotency)
 * 3. จัดการ Metadata ของไฟล์แนบ เพื่อแจ้งเตือนให้ผู้ใช้เลือกไฟล์ใหม่กรณีรีเฟรชเบราว์เซอร์
 */

import { CommunicationDetailItem } from '../types/enablers';

export interface FormDraftFileMeta {
  name: string;
  size: number;
  type?: string;
  mimeType?: string;
  dataUrl?: string; // เก็บ dataUrl ขนาดเล็ก (ถ้ามี)
}

export interface EnablersFormDraft {
  submissionId: string;
  recorderName: string;
  recorderFirstName?: string;
  recorderSurname?: string;
  recorderPosition: string;
  recorderAffiliation: string;
  recorderDept: string;
  recorderPhone: string;
  recorderEmail: string;
  selectedMonth: string;
  selectedTopics: string[];
  communicationDetails: Array<Omit<CommunicationDetailItem, 'evidenceFiles'> & {
    evidenceFilesMeta?: FormDraftFileMeta[];
  }>;
  problems: string;
  suggestions: string;
  updatedAt: string;
}

const ENABLERS_DRAFT_KEY = 'mwa_enablers_2570_form_draft_v1';

/**
 * สร้าง submissionId รูปแบบมาตรฐาน sub_<timestamp>_<random>
 * สร้างครั้งเดียวต่อ 1 การกรอกรายงาน และคงค่าเดิมไว้จนกว่าจะส่งสำเร็จ
 */
export function generateSubmissionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `sub_${timestamp}_${random}`;
}

/**
 * บันทึกแบบร่างลง localStorage
 */
export function saveFormDraft(draft: EnablersFormDraft): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ENABLERS_DRAFT_KEY, JSON.stringify(draft));
  } catch (err) {
    console.warn('[DraftStorage] Failed to save draft:', err);
  }
}

/**
 * ดึงแบบร่างจาก localStorage
 */
export function getFormDraft(): EnablersFormDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ENABLERS_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EnablersFormDraft;
    // ตรวจสอบความสมบูรณ์เบื้องต้น
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn('[DraftStorage] Failed to read draft:', err);
    return null;
  }
}

/**
 * ตรวจสอบว่ามีแบบร่างค้างอยู่หรือไม่
 */
export function hasFormDraft(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(ENABLERS_DRAFT_KEY);
    if (!raw) return false;
    const draft = JSON.parse(raw) as EnablersFormDraft;
    // มีข้อมูลข้อความสำคัญอย่างน้อย 1 รายการ
    return !!(
      draft?.recorderName?.trim() ||
      draft?.recorderPosition?.trim() ||
      draft?.recorderDept?.trim() ||
      draft?.problems?.trim() ||
      draft?.suggestions?.trim() ||
      (draft?.communicationDetails && draft.communicationDetails.some(d => d.details?.trim()))
    );
  } catch {
    return false;
  }
}

/**
 * ล้างแบบร่างหลังบันทึกและตรวจสอบข้อมูลสำเร็จแล้ว
 */
export function clearFormDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ENABLERS_DRAFT_KEY);
  } catch (err) {
    console.warn('[DraftStorage] Failed to clear draft:', err);
  }
}
