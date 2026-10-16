
/**
 * MWA Enablers Report 2570 - Google Sheet Sync Service
 *
 * หน้าที่:
 * ซิงก์ข้อมูลสรุปรายงานไปยัง Google Sheets ผ่าน Google Apps Script
 *
 * หลักการ Non-Blocking:
 * 1. Google Sheets ล้มเหลว ต้องไม่ทำให้การบันทึกข้อมูลหลักใน Supabase ล้มเหลว
 * 2. ใช้ AbortController + Timeout ป้องกันคำขอค้าง
 * 3. ถือว่าซิงก์สำเร็จเฉพาะเมื่อ Apps Script ตอบ success: true
 * 4. บันทึก Cache เฉพาะเมื่อได้รับการยืนยันความสำเร็จ
 * 5. Retry ด้วย Record ID / Submission ID เดิมได้
 * 6. ไม่จำลองความสำเร็จเมื่อไม่ได้ตั้งค่า GAS URL
 */

import { EnablersReport } from '../types/enablers';
import {
  getEnablersGasApiUrl,
  isGasEndpointConfigured
} from '../config/enablersConfig';

export interface GoogleSheetSyncResult {
  success: boolean;
  message: string;
  timestamp: string;
  error?: string;
  row?: number;
  duplicate?: boolean;
  driveUploaded?: boolean;
  driveFiles?: any[];
}

const SHEET_SYNCED_CACHE_KEY_PREFIX =
  'mwa_enablers_sheet_synced_';

interface GasApiResponse {
  success?: boolean;
  saved?: boolean;
  verified?: boolean;
  duplicate?: boolean;
  sheetSynced?: boolean;
  driveUploaded?: boolean;
  driveFilesCount?: number;
  driveFiles?: any[];
  partialSuccess?: boolean;
  driveError?: string;
  message?: string;
  status?: string;
  reportId?: string;
  submissionId?: string;
  row?: number;
}

/**
 * สร้าง Cache key ของรายการที่ซิงก์แล้ว
 */
function getSyncCacheKey(
  recordId: string,
  submissionId?: string
): string {
  return (
    `${SHEET_SYNCED_CACHE_KEY_PREFIX}` +
    `${recordId}_${submissionId || ''}`
  );
}

/**
 * ตรวจสอบว่ารายงานเคยซิงก์สำเร็จแล้วหรือไม่
 */
export function isReportSyncedToSheet(
  recordId: string,
  submissionId?: string
): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return (
      localStorage.getItem(
        getSyncCacheKey(recordId, submissionId)
      ) === 'true'
    );
  } catch {
    return false;
  }
}

/**
 * บันทึกสถานะซิงก์สำเร็จลง Cache
 */
export function markReportSyncedToSheet(
  recordId: string,
  submissionId?: string
): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(
      getSyncCacheKey(recordId, submissionId),
      'true'
    );
  } catch (error) {
    // Cache ใช้เพื่อป้องกันการซิงก์ซ้ำเท่านั้น
    // การบันทึก Cache ไม่สำเร็จต้องไม่ทำให้ระบบหลักล้มเหลว
    console.warn(
      '[GoogleSheetSync] Unable to save sync cache:',
      error
    );
  }
}

/**
 * ส่งผลลัพธ์เมื่อซิงก์ไม่สำเร็จ
 */
function createFailureResult(
  message: string,
  timestamp: string
): GoogleSheetSyncResult {
  return {
    success: false,
    message: `Google Sheets: ยังไม่ยืนยันการบันทึก (${message})`,
    timestamp,
    error: message
  };
}

/**
 * ซิงก์ข้อมูลรายงานไปยัง Google Sheets
 *
 * หมายเหตุ:
 * ฟังก์ชันนี้ไม่ throw error ออกไปยังผู้เรียก
 * เพื่อคงหลักการ Non-Blocking
 */
export async function syncReportToGoogleSheetSafe(
  report: EnablersReport,
  submissionId: string,
  timeoutMs: number = 35000
): Promise<GoogleSheetSyncResult> {
  const timestamp = new Date().toISOString();

  try {
    // 1. ตรวจสอบข้อมูลระบุตัวตนของรายการ
    if (!report || !report.id) {
      return createFailureResult(
        'ไม่พบ Report ID',
        timestamp
      );
    }

    if (!submissionId || !submissionId.trim()) {
      return createFailureResult(
        'ไม่พบ Submission ID',
        timestamp
      );
    }

    // 2. ตรวจสอบ Cache
    // ใช้ได้เฉพาะกรณีที่เคยยืนยันความสำเร็จแล้ว
    if (isReportSyncedToSheet(report.id, submissionId)) {
      return {
        success: true,
        message: 'Google Sheets: รายการนี้เคยซิงก์สำเร็จแล้ว',
        timestamp
      };
    }

    // 3. อ่านและตรวจสอบ GAS Endpoint
    let gasUrl: string;

    try {
      gasUrl = String(getEnablersGasApiUrl() || '').trim();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'ไม่สามารถอ่านค่า GAS URL ได้';

      console.warn('[GoogleSheetSync] Config error:', message);

      return createFailureResult(message, timestamp);
    }

    if (!gasUrl || !isGasEndpointConfigured(gasUrl)) {
      const message =
        'ยังไม่ได้ตั้งค่า Google Apps Script Web App URL ที่ใช้งานได้';

      console.warn('[GoogleSheetSync]', message);

      // ห้ามตั้ง Cache และห้ามจำลอง Success
      return createFailureResult(message, timestamp);
    }

    // ตรวจรูปแบบ URL เบื้องต้น
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(gasUrl);
    } catch {
      return createFailureResult(
        'รูปแบบ Google Apps Script URL ไม่ถูกต้อง',
        timestamp
      );
    }

    if (
      parsedUrl.protocol !== 'https:' ||
      parsedUrl.hostname !== 'script.google.com'
    ) {
      return createFailureResult(
        'URL ต้องเป็น HTTPS Google Apps Script Web App URL',
        timestamp
      );
    }

    // 4. สร้าง Request
    // Uploading evidence files through Apps Script can take longer than metadata-only sync.
    // Allow up to 90s for reports with binary attachments, and 35s for metadata-only.
    const evidenceFiles = Array.isArray((report as any).evidenceFiles) ? (report as any).evidenceFiles : [];
    const hasBinaryEvidence = evidenceFiles.some((file: any) => Boolean(file?.dataUrl || file?.base64 || (file?.url && /^data:/i.test(file.url))));
    const effectiveTimeout = Math.max(1000, hasBinaryEvidence ? Math.max(timeoutMs, 90000) : timeoutMs);

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      timer = setTimeout(
        () => controller.abort(),
        effectiveTimeout
      );

      const response = await fetch(gasUrl, {
        method: 'POST',

        // ใช้ text/plain เพื่อลดโอกาสเกิด CORS preflight
        // สำหรับ Google Apps Script Web App
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8'
        },

        signal: controller.signal,

        body: JSON.stringify({
          action: 'saveReport',
          submissionId,
          reportId: report.id,
          payload: report,
          clientTimestamp: timestamp
        })
      });

      // 5. ตรวจ HTTP status
      if (!response.ok) {
        throw new Error(
          `Google Apps Script HTTP Error: ${response.status}`
        );
      }

      // 6. อ่าน JSON จาก Apps Script
      let data: GasApiResponse;

      try {
        data = await response.json() as GasApiResponse;
      } catch {
        throw new Error(
          'Google Apps Script ไม่ได้ตอบกลับ JSON ที่ถูกต้อง'
        );
      }

      // 7. สำคัญ: ตรวจผลลัพธ์จากเซิร์ฟเวอร์จริง
      // รองรับหลากหลายรูปแบบของ Apps Script response
      const isConfirmedSuccess =
        data.success === true ||
        String(data.success).toLowerCase() === 'true' ||
        (data.saved === true && data.row !== undefined) ||
        data.sheetSynced === true ||
        String(data.status).toLowerCase() === 'success' ||
        data.duplicate === true ||
        (data.partialSuccess === true && data.row !== undefined) ||
        (data.row !== undefined && /บันทึกข้อมูล.*(?:Google Sheets|Google Sheet|ชีต|ชีท)|sheet.*saved/i.test(String(data.message || '')));

      if (!isConfirmedSuccess) {
        throw new Error(
          data.message ||
          `Apps Script ไม่ยืนยันการบันทึก${data.status ? ` (${data.status})` : ''}`
        );
      }

      const isDriveUploaded =
        data.driveUploaded === true ||
        String(data.driveUploaded).toLowerCase() === 'true' ||
        (Array.isArray(data.driveFiles) && data.driveFiles.length > 0) ||
        Boolean(data.driveFilesCount && data.driveFilesCount > 0);

      const filesCount = Array.isArray(data.driveFiles)
        ? data.driveFiles.length
        : (data.driveFilesCount || 0);

      // 8. บันทึก Cache หลังยืนยัน Success เท่านั้น
      markReportSyncedToSheet(report.id, submissionId);

      console.info(
        '[GoogleSheetSync] Sync confirmed:',
        {
          reportId: report.id,
          submissionId,
          row: data.row,
          duplicate: data.duplicate === true,
          driveUploaded: isDriveUploaded
        }
      );

      // UI status reports only the Google Sheets save result. Drive upload is a
      // separate side-effect and must not make a saved Sheet row look like failure.
      const responseMessage = String(data.message || '');
      let resolvedMessage = data.duplicate
        ? 'Google Sheets: รายการนี้บันทึกไว้แล้ว ไม่ได้เพิ่มแถวซ้ำ'
        : (data.partialSuccess === true || /google\s*drive|driveapp|ไดรฟ์|อัปโหลดไฟล์.*ไม่สำเร็จ/i.test(responseMessage))
          ? 'Google Sheets: บันทึกข้อมูลสำเร็จ'
          : (responseMessage && !/google\s*drive|driveapp|ไดรฟ์/i.test(responseMessage))
            ? responseMessage
            : 'Google Sheets: บันทึกข้อมูลสำเร็จ';

      return {
        success: true,
        message: resolvedMessage,
        timestamp,
        row: data.row,
        duplicate: data.duplicate === true,
        driveUploaded: isDriveUploaded,
        driveFiles: data.driveFiles
      };
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  } catch (error: unknown) {
    const isTimeout =
      error instanceof Error &&
      error.name === 'AbortError';

    const evidenceFiles = Array.isArray((report as any)?.evidenceFiles) ? (report as any).evidenceFiles : [];
    const hasBinary = evidenceFiles.some((file: any) => Boolean(file?.dataUrl || file?.base64 || (file?.url && /^data:/i.test(file.url))));
    const effectiveTimeoutSec = Math.max(1000, hasBinary ? Math.max(timeoutMs, 90000) : timeoutMs) / 1000;

    const errorMessage = isTimeout
      ? `หมดเวลาเชื่อมต่อ Google Sheets (${effectiveTimeoutSec} วินาที)`
      : error instanceof Error
        ? error.message
        : 'ไม่สามารถเชื่อมต่อ Google Sheets ได้';

    console.warn(
      '[GoogleSheetSync] Sync failed (Non-Blocking):',
      errorMessage
    );

    // ห้ามบันทึก Cache เมื่อเกิดข้อผิดพลาด
    // เพื่อให้ผู้ใช้สามารถ Retry รายการเดิมได้
    return createFailureResult(
      errorMessage,
      timestamp
    );
  }
}
