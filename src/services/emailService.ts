/**
 * MWA Enablers Report 2570 - Email Service
 * 
 * หน้าที่:
 * 1. กำหนดโครงสร้าง Subject และ Email Body ตาม Reference จากโปรเจกต์ต้นแบบ
 * 2. จัดการ Email Attachment (PDF Report ฉบับเดียวกับ Viewer / Download)
 * 3. ส่งข้อมูลยืนยันไปยังผู้บันทึกและระบบ โดยเชื่อมต่อกับ API / GAS ของระบบปัจจุบัน
 * 
 * *Source of Truth: อิงข้อมูลจาก Verified / Current Record*
 */

import { EnablersReport } from '../types/enablers';
import { formatThaiDate, formatFiscalMonthWithYear } from '../utils/fiscalYear';
import { getEnablersGasApiUrl, isGasEndpointConfigured } from '../config/enablersConfig';

export interface EmailAttachmentPayload {
  filename: string;
  mimeType: string;
  dataBase64?: string;
  blob?: Blob;
}

export interface EmailConfirmationPayload {
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
  recordId: string;
  submissionId: string;
  attachment?: EmailAttachmentPayload;
}

export interface SendEmailResult {
  success: boolean;
  message: string;
  recipient: string;
  timestamp: string;
  alreadySent?: boolean;
  status?: 'EMAIL_SENT' | 'EMAIL_FAILED' | 'EMAIL_SUCCESS';
  emailSent?: boolean;
  stage?: 'EMAIL_SUCCESS' | 'EMAIL_FAILED';
}

// v2 ignores old flags created by the previous simulation mode.
const EMAIL_SENT_KEY_PREFIX = 'mwa_enablers_email_sent_v2_';

/**
 * ตรวจสอบว่าเคยส่งอีเมลสำหรับ recordId + submissionId นี้แล้วหรือไม่
 */
export function isEmailAlreadySent(recordId: string, submissionId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = `${EMAIL_SENT_KEY_PREFIX}${recordId}_${submissionId}`;
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

/**
 * บันทึกสถานะว่าส่งอีเมลเรียบร้อยแล้ว
 */
export function markEmailSent(recordId: string, submissionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${EMAIL_SENT_KEY_PREFIX}${recordId}_${submissionId}`;
    localStorage.setItem(key, 'true');
  } catch {
    // ignore
  }
}

/**
 * สร้าง Subject ตามรูปแบบ Reference:
 * "รายงานการสื่อสารของผู้บริหาร ประจำปีงบประมาณ 2570 - Record ID #<recordId>"
 */
export function buildConfirmationEmailSubject(recordId: string): string {
  return `รายงานการสื่อสารของผู้บริหาร ประจำปีงบประมาณ 2570 - Record ID #${recordId}`;
}

/**
 * สร้าง Email Body ตามรูปแบบ Reference:
 */
export function buildConfirmationEmailContent(
  record: EnablersReport,
  submissionId: string
): string {
  const communicators = record.communication_details_text
    .map(c => c.communicator.trim())
    .filter(Boolean);
  const communicatorsList = Array.from(new Set(communicators)).join(', ') || '-';
  const formattedDate = formatThaiDate(record.created_date || new Date().toISOString());

  return `สวัสดีครับคุณ ${record.recorder_name} (${record.recorder_status})

ระบบได้รับข้อมูลการส่งรายงานการสื่อสารภายในและภายนอกองค์กร สำหรับผู้บริหาร ประจำปีงบประมาณ 2570 แล้ว

สรุปข้อมูลการรายงาน:
• รหัสรายงาน (Record ID): ${record.id}
• รหัสการส่ง (Submission ID): ${submissionId}
• ประจำเดือน: ${formatFiscalMonthWithYear(record.communication_month, record.fiscal_year)}
• ประจำไตรมาส: ${record.fiscal_quarter} (ปีงบประมาณ ${record.fiscal_year})
• สายงาน / หน่วยงาน: ${record.recorder_affiliation || '-'} / ${record.recorder_dept}
• ผู้สื่อสาร / ผู้ถ่ายทอดสาร: ${communicatorsList}
• ประเด็น Enablers: ${record.executive_topics.join(', ')}
• วันที่บันทึกข้อมูล: ${formattedDate}
• ผู้บันทึก: ${record.recorder_name}
• อีเมลผู้บันทึก: ${record.recorder_email || '-'}

(เอกสาร PDF รายงานฉบับเต็มได้ถูกแนบมาในอีเมลนี้แล้ว)

ส่วนข้อมูลข่าวสารและประเมินผลการสื่อสาร
กองบริหารภาพลักษณ์และแผนการสื่อสาร ฝ่ายสื่อสารองค์กร
การประปานครหลวง (กปน.)

(นี่คืออีเมลอัตโนมัติ กรุณาอย่าตอบกลับ)`;
}

/**
 * ฟังก์ชันส่งอีเมลยืนยัน (Client & Integration Layer)
 * แนบไฟล์ PDF ฉบับเดียวกับ Viewer / Download
 */
export async function sendConfirmationEmail(
  record: EnablersReport,
  submissionId: string,
  pdfBlob?: Blob | null
): Promise<SendEmailResult> {
  const recipientEmail = record.recorder_email?.trim();
  const timestamp = new Date().toISOString();

  if (!recipientEmail || !recipientEmail.includes('@')) {
    return {
      success: false,
      status: 'EMAIL_FAILED',
      emailSent: false,
      stage: 'EMAIL_FAILED',
      message: 'ไม่ได้ระบุอีเมลผู้รับที่ถูกต้องในรายงาน',
      recipient: recipientEmail || '-',
      timestamp
    };
  }

  // ป้องกันการส่งอีเมลซ้ำ (Duplicate Guard ด้วย recordId + submissionId)
  if (isEmailAlreadySent(record.id, submissionId)) {
    return {
      success: true,
      status: 'EMAIL_SENT',
      emailSent: true,
      stage: 'EMAIL_SUCCESS',
      message: `อีเมลถูกส่งแล้ว (เคยส่งไปยัง ${recipientEmail} เรียบร้อยแล้ว)`,
      recipient: recipientEmail,
      timestamp,
      alreadySent: true
    };
  }

  const subject = buildConfirmationEmailSubject(record.id);
  const body = buildConfirmationEmailContent(record, submissionId);
  const filename = `MWA_Communication_Report_${record.id}.pdf`;

  if (!pdfBlob || pdfBlob.size === 0) {
    return { success: false, status: 'EMAIL_FAILED', emailSent: false, stage: 'EMAIL_FAILED', message: 'ยังไม่ส่งอีเมล: ไม่พบไฟล์ PDF สำหรับแนบ', recipient: recipientEmail, timestamp };
  }

  const gasUrl = getEnablersGasApiUrl();
  const isGasActive = isGasEndpointConfigured(gasUrl);

  try {
    if (isGasActive) {
      console.info(`[EmailService] Dispatching real email request to GAS: ${gasUrl}`);
      let pdfBase64: string | undefined;
      if (pdfBlob) {
        try {
          const buffer = await pdfBlob.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          pdfBase64 = btoa(binary);
        } catch (bErr) {
          console.warn('[EmailService] Failed to serialize PDF blob to Base64:', bErr);
        }
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        signal: controller.signal,
        body: JSON.stringify({
          action: 'sendReportEmail',
          submissionId,
          recordId: record.id,
          to: recipientEmail,
          recipientEmail,
          recorderEmail: recipientEmail,
          subject,
          body,
          reportData: record,
          data: record,
          attachment: pdfBase64 ? {
            filename,
            mimeType: 'application/pdf',
            dataBase64: pdfBase64
          } : undefined,
          clientTimestamp: timestamp
        })
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`GAS Email Dispatch HTTP Error: ${response.status}`);
      }

      const resData = await response.json();
      if (!resData || resData.success !== true || resData.emailSent !== true) {
        throw new Error(resData?.emailError || resData?.message || 'Apps Script ไม่ยืนยันว่าการส่งอีเมลสำเร็จ');
      }

      // Mark sent only after the server confirms GmailApp.sendEmail succeeded.
      markEmailSent(record.id, submissionId);

      return {
        success: true,
        status: 'EMAIL_SENT',
        emailSent: true,
        stage: 'EMAIL_SUCCESS',
        message: resData.message || `ส่งอีเมลยืนยันไปยัง ${recipientEmail} เรียบร้อยแล้ว (พร้อมแนบไฟล์ ${filename})`,
        recipient: recipientEmail,
        timestamp
      };
    }

    // ห้ามจำลองการส่งสำเร็จใน production เพราะทำให้ผู้ใช้เข้าใจว่าอีเมลถูกส่งจริง
    return {
      success: false,
      status: 'EMAIL_FAILED',
      emailSent: false,
      stage: 'EMAIL_FAILED',
      message: 'ยังไม่ได้ส่งอีเมลจริง: กรุณาตั้งค่า Google Apps Script URL สำหรับส่งอีเมล',
      recipient: recipientEmail,
      timestamp
    };
  } catch (error: any) {
    console.error('[EmailService] Send email failed:', error);
    return {
      success: false,
      status: 'EMAIL_FAILED',
      emailSent: false,
      stage: 'EMAIL_FAILED',
      message: error.message || 'เกิดข้อผิดพลาดในการส่งอีเมล',
      recipient: recipientEmail,
      timestamp
    };
  }
}
