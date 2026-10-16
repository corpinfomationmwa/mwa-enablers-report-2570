/**
 * MWA Enablers Report 2570 - Data Models & Types
 * Dedicated data models strictly isolated for Enablers Report 2570
 */

export interface AttachedEvidenceFile {
  id?: string;
  name: string;
  size: number;
  type?: string;
  mimeType?: string;
  dataUrl?: string;
  base64?: string;
  url?: string;
}

export interface CommunicationDetailItem {
  id?: string;
  communicator: string;         // ผู้สื่อสาร (เช่น ผวก., รผก.(ก), ชผก., ผู้อำนวยการฝ่าย)
  channel: string;              // ช่องทาง (เช่น การประชุมประจำเดือน, Town Hall, Morning Talk, Line Official, Intranet)
  recipients: string;           // กลุ่มเป้าหมาย / ผู้รับการสื่อสาร (เช่น พนักงานสายงาน..., ผู้ปฏิบัติงานระดับส่วน/แผนก)
  details: string;              // สาระสำคัญของการสื่อสาร
  attachmentDetails: string;    // รายละเอียดสิ่งที่แนบมาด้วย / เอกสารประกอบการสื่อสาร
  evidenceFiles?: AttachedEvidenceFile[]; // ไฟล์หลักฐานจริง สูงสุด 3 ไฟล์ต่อประเด็น
}

export interface EvidenceLinkItem {
  id?: string;
  url: string;                  // ลิงก์หลักฐาน / ภาพถ่าย / เอกสารอ้างอิง
  title: string;                // คำอธิบายหลักฐาน
  type?: 'image' | 'document' | 'folder' | 'other';
  fileData?: AttachedEvidenceFile;
}

export type FiscalQuarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export type ReportStatus = 'draft' | 'submitted' | 'verified' | 'rejected';

export interface EnablersReport {
  id: string;                                   // ENB-2570-xxxxxxxx
  submission_id?: string;                       // sub_<timestamp>_<random>
  submissionId?: string;                        // Alias for submission_id
  created_date: string;                         // วันที่บันทึกรายงาน (ISO string / Formatted Thai)
  recorder_name: string;                        // ชื่อ-นามสกุล ผู้รายงาน
  recorder_status: string;                      // ตำแหน่ง/สถานะผู้รายงาน (เก็บค่าตำแหน่งที่กรอก)
  recorder_affiliation?: string;                // สายงาน
  recorder_dept: string;                        // ฝ่าย/หน่วยงาน
  recorder_place: string;                       // กอง/ส่วน/สถานที่ปฏิบัติงาน
  recorder_phone: string;                       // เบอร์โทรศัพท์ติดต่อ
  recorder_email: string;                       // อีเมล MWA
  communication_month: string;                  // เดือนที่ดำเนินการสื่อสาร (เช่น ตุลาคม 2569, มกราคม 2570)
  fiscal_year: number;                          // ปีงบประมาณ 2570
  fiscal_quarter: FiscalQuarter;                 // ไตรมาสตามปีงบประมาณ กปน. (Q1=ต.ค.-ธ.ค., Q2=ม.ค.-มี.ค., Q3=เม.ย.-มิ.ย., Q4=ก.ค.-ก.ย.)
  executive_topics: string[];                   // ประเด็นสำคัญที่ผู้บริหารสื่อสาร / ประเด็น Enablers
  communication_details_text: CommunicationDetailItem[]; // รายการรายละเอียดการสื่อสาร (รองรับหลายรายการ)
  problems: string;                             // ปัญหาและอุปสรรค
  suggestions: string;                          // ข้อเสนอแนะ
  evidence_links: EvidenceLinkItem[];           // ลิงก์หลักฐาน (รองรับหลายรายการ)
  evidenceFiles?: AttachedEvidenceFile[];        // ไฟล์หลักฐานแนบรวม
  evidence_files?: AttachedEvidenceFile[];       // ไฟล์หลักฐานแนบรวม (snake_case compatibility)

  
  // Verification fields
  pdf_base64?: string;                          // เอกสาร PDF Base64
  pdf_url?: string;                             // เอกสาร PDF URL
  is_verified?: boolean;
  status?: ReportStatus;
  verified_by?: string;                         // ผู้ตรวจสอบ/รับรอง
  verified_date?: string;                       // วันที่ตรวจสอบ
  verification_notes?: string;                  // ข้อคิดเห็นการตรวจสอบ
  updated_date?: string;                        // วันที่แก้ไขล่าสุด
}

export type CreateReportInput = Omit<EnablersReport, 'id' | 'created_date' | 'is_verified' | 'status' | 'verified_by' | 'verified_date'>;

export interface EnablersFilterParams {
  fiscal_quarter?: FiscalQuarter | 'all';
  fiscal_year?: number;
  communication_month?: string;
  recorder_dept?: string;
  status?: ReportStatus | 'all';
  search_keyword?: string;
}

export interface VerifyReportPayload {
  verified_by: string;
  status: 'verified' | 'rejected';
  verification_notes?: string;
  submission_id?: string;
  verification_token?: string;
}

export interface EnablersApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp?: string;
  source?: 'supabase' | 'edge_function' | 'gas' | 'local_storage';
  verification_token?: string;
  require_admin?: boolean;
}
