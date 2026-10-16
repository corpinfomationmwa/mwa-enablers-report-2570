/**
 * MWA Enablers Report 2570 - API Service Layer
 * 
 * สถาปัตยกรรม: Browser Client -> Supabase Edge Function (enablers-api) -> PostgreSQL Database
 * 
 * หน้าที่:
 * 1. เชื่อมต่อผ่าน Supabase Edge Function (enablers-api) เพื่อความปลอดภัยสูงสุดสำหรับระบบที่ไม่มีหน้า Login
 * 2. Zero-Direct-Access Enforcement: Client เบราว์เซอร์ไม่มีสิทธิ์เข้าถึงตาราง public.enablers_reports โดยตรง (ถูก REVOKE สิทธิ์ทุกประการจาก anon)
 * 3. ส่งต่อ Ephemeral Proof Token เพื่อคุ้มครองขั้นตอน SAVE -> VERIFY
 * 4. รองรับ operations: create, verify, getData, getById, delete, testConnection
 * 5. ตรวจสอบและรายงานข้อผิดพลาดอย่างชัดเจน ห้ามใช้ข้อมูลจำลองเป็นผลสำเร็จ
 */

import {
  EnablersReport,
  CreateReportInput,
  EnablersFilterParams,
  VerifyReportPayload,
  EnablersApiResponse,
  FiscalQuarter,
  ReportStatus
} from '../types/enablers';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  getSupabaseUrl
} from '../lib/supabase';
import { isGasEndpointConfigured } from '../config/enablersConfig';
import { formatFiscalMonthWithYear, FISCAL_YEAR_TARGET } from '../utils/fiscalYear';

export interface IEnablersApiService {
  create(payload: CreateReportInput): Promise<EnablersApiResponse<EnablersReport>>;
  getData(filters?: EnablersFilterParams): Promise<EnablersApiResponse<EnablersReport[]>>;
  getById(id: string, adminPasscode?: string, verificationToken?: string): Promise<EnablersApiResponse<EnablersReport>>;
  delete(id: string, adminPasscode?: string): Promise<EnablersApiResponse<{ deletedId: string }>>;
  verify(id: string, verificationData: VerifyReportPayload): Promise<EnablersApiResponse<EnablersReport>>;
  getAdminPasscode(): string | null;
  setAdminPasscode(passcode: string | null): void;
  clearAdminPasscode(): void;
  isAdminUnlocked(): boolean;
  testConnection(targetUrl?: string): Promise<{
    success: boolean;
    endpoint: string;
    isMock: boolean;
    message: string;
  }>;
}

// Session memory สำหรับเก็บ Admin Passcode ชั่วคราวใน Browser Session (ไม่ฮาร์ดโค้ด ไม่บันทึกถาวรลงดิสก์)
let sessionAdminPasscode: string | null = null;
try {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    sessionAdminPasscode = window.sessionStorage.getItem('mwa_enablers_admin_session_key');
  }
} catch {
  // Ignore sessionStorage errors in restricted environments
}

// Memory cache สำหรับเก็บ Ephemeral Verification Token ระหว่างขั้นตอน SAVE -> VERIFY ภายใน Session
const inMemoryVerificationTokens = new Map<string, string>();

/**
 * แปลงข้อมูลแถวจากฐานข้อมูลเป็น Frontend EnablersReport
 */
function normalizeReportRow(row: any): EnablersReport {
  const parseJsonSafe = (val: any, fallback: any) => {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  };

  const finalFiscalYear = Number(row.fiscal_year) || FISCAL_YEAR_TARGET;
  const allEvidenceFiles = parseJsonSafe(row.evidence_files ?? row.evidenceFiles, []);
  const rawCommunicationDetails = parseJsonSafe(row.communication_details_text, []);
  // Restore per-topic file content from the single canonical evidence_files array.
  // Older records that already include dataUrl in communication_details_text remain compatible.
  const communicationDetails = Array.isArray(rawCommunicationDetails)
    ? rawCommunicationDetails.map((item: any) => ({
        ...item,
        evidenceFiles: Array.isArray(item.evidenceFiles)
          ? item.evidenceFiles.map((meta: any) => {
              if (meta?.dataUrl || meta?.base64) return meta;
              const fullFile = Array.isArray(allEvidenceFiles)
                ? allEvidenceFiles.find((file: any) => file?.id && file.id === meta?.id)
                : undefined;
              return fullFile ? { ...meta, ...fullFile } : meta;
            })
          : []
      }))
    : [];

  return {
    id: String(row.id || ''),
    submission_id: row.submission_id || row.submissionId || undefined,
    submissionId: row.submission_id || row.submissionId || undefined,
    created_date: row.created_date
      ? new Date(row.created_date).toISOString()
      : new Date().toISOString(),
    recorder_name: String(row.recorder_name || ''),
    recorder_status: String(row.recorder_status || ''),
    recorder_affiliation: row.recorder_affiliation || undefined,
    recorder_dept: String(row.recorder_dept || ''),
    recorder_place: String(row.recorder_place || ''),
    recorder_phone: String(row.recorder_phone || ''),
    recorder_email: String(row.recorder_email || ''),
    communication_month: formatFiscalMonthWithYear(
      row.communication_month || '',
      finalFiscalYear
    ),
    fiscal_year: finalFiscalYear,
    fiscal_quarter: (row.fiscal_quarter as FiscalQuarter) || 'Q1',
    executive_topics: parseJsonSafe(row.executive_topics, []),
    communication_details_text: communicationDetails,
    problems: row.problems || '',
    suggestions: row.suggestions || '',
    evidence_links: parseJsonSafe(row.evidence_links, []),
    evidenceFiles: allEvidenceFiles,
    pdf_base64: row.pdf_base64 || undefined,
    pdf_url: row.pdf_url || undefined,
    is_verified: Boolean(row.is_verified),
    status: (row.status as ReportStatus) || 'submitted',
    verified_by: row.verified_by || undefined,
    verified_date: row.verified_date
      ? new Date(row.verified_date).toISOString()
      : undefined,
    verification_notes: row.verification_notes || undefined,
    updated_date: row.updated_date
      ? new Date(row.updated_date).toISOString()
      : undefined
  };
}

async function describeEdgeFunctionError(error: any): Promise<string> {
  const context = error?.context;
  const status = typeof context?.status === 'number' ? context.status : undefined;
  let detail = '';
  try {
    if (context && typeof context.clone === 'function') {
      const responseText = await context.clone().text();
      if (responseText) {
        try {
          const parsed = JSON.parse(responseText);
          detail = String(parsed?.error || parsed?.message || parsed?.msg || responseText);
        } catch {
          detail = responseText;
        }
      }
    }
  } catch {
    // Preserve the SDK message if the response body cannot be read.
  }
  const safeDetail = detail.replace(/\s+/g, ' ').trim().slice(0, 500);
  return [status ? `HTTP ${status}` : '', safeDetail || error?.message || 'ไม่ทราบรายละเอียดจาก Edge Function']
    .filter(Boolean)
    .join(': ');
}

class EnablersApiService implements IEnablersApiService {
  /**
   * 1. CREATE (SAVE): บันทึกรายงานผ่าน Supabase Edge Function (enablers-api)
   *    และรับ Ephemeral Verification Token สำหรับใช้ในขั้นตอนถัดไป
   */
  async create(payload: CreateReportInput): Promise<EnablersApiResponse<EnablersReport>> {
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: 'ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase: กรุณาระบุ VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ในสภาพแวดล้อมระบบ',
        timestamp: new Date().toISOString()
      };
    }

    try {
      const supabase = getSupabaseClient();

      // เรียกใช้งาน Supabase Edge Function 'enablers-api'
      const { data, error } = await supabase.functions.invoke('enablers-api', {
        body: {
          action: 'create',
          payload
        }
      });

      if (error) {
        const detail = await describeEdgeFunctionError(error);
        console.warn('[EnablersApiService] Edge Function invoke warning:', detail);
        return {
          success: false,
          error: `ไม่สามารถบันทึกข้อมูลผ่าน Supabase Edge Function ได้: ${detail}`,
          timestamp: new Date().toISOString()
        };
      }

      if (!data || !data.success || !data.data) {
        return {
          success: false,
          error: data?.error || 'Edge Function ตอบกลับข้อผิดพลาดในการบันทึกข้อมูล',
          timestamp: new Date().toISOString()
        };
      }

      const savedReport = normalizeReportRow(data.data);

      // บันทึก Token ลับชั่วคราวใน Memory สำหรับนำไปใช้ในขั้น verify
      if (data.verification_token) {
        inMemoryVerificationTokens.set(savedReport.id, data.verification_token);
      }

      return {
        success: true,
        message: data.message || 'บันทึกรายงาน Enablers 2570 สำเร็จเรียบร้อยแล้ว',
        data: savedReport,
        verification_token: data.verification_token,
        source: 'edge_function',
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      console.warn('[EnablersApiService] Unexpected error during create:', err?.message);
      return {
        success: false,
        error: `เกิดข้อผิดพลาดในการเชื่อมต่อ Edge Function: ${err?.message || 'Network Error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 2. VERIFY: รับรองรายงานผ่าน Edge Function ด้วย Ephemeral Proof Token + Submission ID
   */
  async verify(id: string, verificationData: VerifyReportPayload): Promise<EnablersApiResponse<EnablersReport>> {
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: 'ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase: กรุณาระบุ VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY',
        timestamp: new Date().toISOString()
      };
    }

    try {
      const supabase = getSupabaseClient();
      const token = verificationData.verification_token || inMemoryVerificationTokens.get(id) || '';

      const { data, error } = await supabase.functions.invoke('enablers-api', {
        body: {
          action: 'verify',
          id,
          submission_id: verificationData.submission_id,
          verification_token: token,
          verification: {
            status: verificationData.status,
            verified_by: verificationData.verified_by,
            verification_notes: verificationData.verification_notes
          }
        }
      });

      if (error) {
        console.warn('[EnablersApiService] Edge Function verify invoke warning:', error.message);
        return {
          success: false,
          error: `ไม่สามารถรับรองรายงานผ่าน Edge Function ได้: ${error.message}`,
          timestamp: new Date().toISOString()
        };
      }

      if (!data || !data.success || !data.data) {
        return {
          success: false,
          error: data?.error || 'ไม่สามารถรับรองรายงานได้ (การตรวจสอบสิทธิ์หรือข้อมูลไม่ถูกต้อง)',
          timestamp: new Date().toISOString()
        };
      }

      // ลบ Token ออกจากหน่วยความจำเมื่อรับรองเสร็จสิ้นแล้ว
      inMemoryVerificationTokens.delete(id);

      const verifiedReport = normalizeReportRow(data.data);

      return {
        success: true,
        data: verifiedReport,
        message: data.message || `รับรองรายงาน ${id} เรียบร้อยแล้ว`,
        source: 'edge_function',
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      console.warn('[EnablersApiService] Unexpected error during verify:', err?.message);
      return {
        success: false,
        error: `เกิดข้อผิดพลาดในการรับรองรายงาน: ${err?.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 3. GET DATA: ดึงรายการข้อมูลรายงานผ่าน Supabase Edge Function เท่านั้น (ต้องใช้ Admin Passcode)
   */
  async getData(filters?: EnablersFilterParams): Promise<EnablersApiResponse<EnablersReport[]>> {
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: 'ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase: กรุณาระบุ VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY',
        data: [],
        timestamp: new Date().toISOString()
      };
    }

    try {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.functions.invoke('enablers-api', {
        body: { action: 'getData', filters: filters || {} }
      });

      if (error) {
        console.warn('[EnablersApiService] Edge Function getData warning:', error.message);
        return {
          success: false,
          error: `ไม่สามารถดึงข้อมูลผ่าน Edge Function ได้: ${error.message}`,
          data: [],
          timestamp: new Date().toISOString()
        };
      }

      if (!data || !data.success || !Array.isArray(data.data)) {
        return {
          success: false,
          error: data?.error || 'Edge Function ตอบกลับข้อมูลไม่ถูกต้อง',
          require_admin: data?.require_admin,
          data: [],
          timestamp: new Date().toISOString()
        };
      }

      const reports = data.data.map(normalizeReportRow);
      return {
        success: true,
        data: reports,
        source: 'edge_function',
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      console.warn('[EnablersApiService] Unexpected error during getData:', err?.message);
      return {
        success: false,
        error: `ไม่สามารถเชื่อมต่อ Edge Function ได้: ${err.message}`,
        data: [],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 4. GET BY ID: ดึงรายงานฉบับเดียวผ่าน Supabase Edge Function เท่านั้น
   */
  async getById(id: string, adminPasscode?: string, verificationToken?: string): Promise<EnablersApiResponse<EnablersReport>> {
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: 'ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase',
        timestamp: new Date().toISOString()
      };
    }

    try {
      const supabase = getSupabaseClient();
      const token = verificationToken || inMemoryVerificationTokens.get(id) || '';
      const effectivePasscode = (adminPasscode || sessionAdminPasscode || '').trim();

      const { data, error } = await supabase.functions.invoke('enablers-api', {
        body: {
          action: 'getById',
          id,
          admin_passcode: effectivePasscode,
          verification_token: token
        }
      });

      if (error || !data || !data.success || !data.data) {
        return {
          success: false,
          error: data?.error || error?.message || `ไม่พบข้อมูลรายงานรหัส ${id}`,
          require_admin: data?.require_admin,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        data: normalizeReportRow(data.data),
        source: 'edge_function',
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      return {
        success: false,
        error: `เกิดข้อผิดพลาดในการดึงรายงาน: ${err.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 5. DELETE: ลบรายงานผ่าน Edge Function พร้อมตรวจสอบสิทธิ์ Admin Passcode
   */
  async delete(id: string, adminPasscode?: string): Promise<EnablersApiResponse<{ deletedId: string }>> {
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: 'ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase',
        timestamp: new Date().toISOString()
      };
    }

    try {
      const supabase = getSupabaseClient();
      const effectivePasscode = (adminPasscode || sessionAdminPasscode || '').trim();

      const { data, error } = await supabase.functions.invoke('enablers-api', {
        body: {
          action: 'delete',
          id,
          admin_passcode: effectivePasscode
        }
      });

      if (error) {
        return {
          success: false,
          error: `ไม่สามารถลบรายงานผ่าน Edge Function ได้: ${error.message}`,
          timestamp: new Date().toISOString()
        };
      }

      if (!data || !data.success) {
        return {
          success: false,
          error: data?.error || 'ไม่อนุญาตให้ลบรายงาน (สิทธิ์ไม่เพียงพอ)',
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        message: data.message || `ลบรายงานรหัส ${id} เรียบร้อยแล้ว`,
        data: { deletedId: id },
        source: 'edge_function',
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      return {
        success: false,
        error: `เกิดข้อผิดพลาดในการลบรายงาน: ${err.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * จัดการ Session Admin Passcode ฝั่ง Client (ไม่ฮาร์ดโค้ด ไม่บันทึกถาวร)
   */
  getAdminPasscode(): string | null {
    return sessionAdminPasscode;
  }

  setAdminPasscode(passcode: string | null): void {
    sessionAdminPasscode = passcode ? passcode.trim() : null;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        if (sessionAdminPasscode) {
          window.sessionStorage.setItem('mwa_enablers_admin_session_key', sessionAdminPasscode);
        } else {
          window.sessionStorage.removeItem('mwa_enablers_admin_session_key');
        }
      }
    } catch {
      // Ignore
    }
  }

  clearAdminPasscode(): void {
    this.setAdminPasscode(null);
  }

  isAdminUnlocked(): boolean {
    return Boolean(sessionAdminPasscode && sessionAdminPasscode.length > 0);
  }

  /**
   * 6. TEST CONNECTION: ตรวจสอบการเชื่อมต่อไปยัง Edge Function หรือ GAS URL
   */
  async testConnection(targetUrl?: string): Promise<{
    success: boolean;
    endpoint: string;
    isMock: boolean;
    message: string;
  }> {
    // กรณีระบุ targetUrl (ทดสอบ GAS Web App URL จากหน้า EngineConfigView)
    if (targetUrl) {
      if (!isGasEndpointConfigured(targetUrl)) {
        return {
          success: true,
          endpoint: targetUrl || '(ยังไม่ได้กำหนด URL)',
          isMock: true,
          message: 'ระบบพร้อมใช้งานในโหมด Enablers Standalone Engine'
        };
      }

      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ping', timestamp: Date.now() })
        });
        if (response.ok) {
          return {
            success: true,
            endpoint: targetUrl,
            isMock: false,
            message: 'เชื่อมต่อกับ Google Apps Script ของ Enablers Report 2570 สำเร็จ'
          };
        } else {
          return {
            success: false,
            endpoint: targetUrl,
            isMock: false,
            message: `Endpoint ตอบสนองด้วยรหัส HTTP ${response.status}`
          };
        }
      } catch (err: any) {
        return {
          success: false,
          endpoint: targetUrl,
          isMock: false,
          message: `ไม่สามารถเชื่อมต่อ Endpoint ได้: ${err.message || 'Network Error'}`
        };
      }
    }

    // กรณีไม่ระบุ targetUrl: ทดสอบ Supabase Edge Function
    const endpoint = getSupabaseUrl();
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        endpoint: endpoint || '(ยังไม่ได้กำหนด URL)',
        isMock: false,
        message: 'ยังไม่ได้กำหนดค่า VITE_SUPABASE_URL หรือ VITE_SUPABASE_ANON_KEY ในระบบ'
      };
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('enablers-api', {
        body: { action: 'ping' }
      });

      if (!error && data && data.success) {
        return {
          success: true,
          endpoint: `${endpoint}/functions/v1/enablers-api`,
          isMock: false,
          message: 'เชื่อมต่อกับ Supabase Edge Function (enablers-api) สำเร็จ พร้อมใช้งาน'
        };
      }

      return {
        success: false,
        endpoint: `${endpoint}/functions/v1/enablers-api`,
        isMock: false,
        message: `ไม่สามารถเข้าถึง Edge Function ได้: ${error?.message || data?.error || 'Function not responding'}`
      };
    } catch (err: any) {
      return {
        success: false,
        endpoint,
        isMock: false,
        message: `ไม่สามารถเชื่อมต่อไปยัง Supabase Edge Function ได้: ${err.message || 'CORS or Network Error'}`
      };
    }
  }
}

export const enablersApiService = new EnablersApiService();
export default enablersApiService;
