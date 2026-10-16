/**
 * MWA Enablers Report 2570 - Print / Document Converter
 * 
 * หน้าที่:
 * แปลง verified / current record ไปเป็น PrintPayload / Document Model
 * ตามหลักการของ Reference: recordToPrintPayload(record)
 * 
 * Source of Truth: ข้อมูลจาก Record จริง ไม่สร้างข้อมูล Mock
 */

import { EnablersReport, AttachedEvidenceFile } from '../types/enablers';
import { formatThaiDate, formatFiscalMonthWithYear, FISCAL_YEAR_TARGET } from '../utils/fiscalYear';

export interface PrintTableRow {
  index: number;
  communicator: string;      // 1. ผู้ถ่ายทอดสาร
  topicOrDetails: string;    // 2. ประเด็นการสื่อสาร / สาระสำคัญ
  channel: string;           // 3. ช่องทางการสื่อสาร
  recipients: string;        // 4. ผู้รับสาร
  evidenceFiles: AttachedEvidenceFile[]; // 5. หลักฐาน (ถ้ามี)
}

export interface PrintDocumentPayload {
  reportId: string;
  documentTitle: string;
  fiscalYear: string;
  month: string;
  quarter: string;
  createdDateThai: string;
  
  // ผู้จัดทำเอกสาร
  author: {
    name: string;
    position: string;
    affiliation: string;
    department: string;
    affiliationDepartment: string;
    phone: string;
    email: string;
  };
  
  // ประเด็น Enablers
  enablersTopics: string[];
  
  // ตาราง 5 ช่อง
  tableRows: PrintTableRow[];
  
  // ท้ายเอกสาร
  problems: string;
  suggestions: string;
  
  // การรับรอง / ลายเซ็น
  signOff: {
    recorderName: string;
    recorderPosition: string;
    recorderDept: string;
    verifiedBy: string;
  };
}

/**
 * จัดรูปแบบสายงาน/หน่วยงานสำหรับส่วนหัวเอกสารราชการ
 * - ถ้ามีทั้งคู่: "<affiliation> / <department>"
 * - ถ้ามีเพียงค่าเดียว: แสดงเฉพาะค่าที่มี (ไม่แสดง "- /")
 * - ถ้าไม่มีทั้งคู่: "-"
 */
export function formatAffiliationDepartment(affiliation?: string, department?: string): string {
  const aff = (affiliation || '').trim().replace(/^-+$/, '');
  const dept = (department || '').trim().replace(/^-+$/, '');

  if (aff && dept) {
    return `${aff} / ${dept}`;
  }
  if (aff) return aff;
  if (dept) return dept;
  return '-';
}

/**
 * จัดการข้อความตำแหน่งสำหรับใต้ชื่อผู้ลงนาม
 * - แสดงเฉพาะชื่อตำแหน่งจริง
 * - ตัดคำว่า "ตำแหน่ง" หรือ "ตำแหน่ง:" ด้านหน้าออก (ถ้ามี)
 * - หากเป็นค่าว่าง ช่องว่าง หรือ null/undefined คืนค่าเป็น empty string (ไม่ใส่ fallback "-")
 */
export function formatSignOffPosition(pos?: string): string {
  if (!pos) return '';
  const trimmed = pos.trim();
  if (!trimmed || trimmed === '-') return '';
  return trimmed.replace(/^ตำแหน่ง\s*:?\s*/, '').trim();
}

import { currentPdfStore } from './currentPdfStore';

/**
 * แปลง EnablersReport เป็น PrintDocumentPayload (Source of Truth)
 * อิงการจัดข้อมูลตาม Section 5:
 * - ผู้จัดทำเอกสาร = recorder_name, recorder_status, recorder_affiliation / recorder_dept, phone, email
 * - ตาราง 5 ช่อง:
 *   1. ผู้ถ่ายทอดสาร = item.communicator
 *   2. ประเด็นการสื่อสาร = รวม Enablers Topics + สาระสำคัญ (item.details)
 *   3. ช่องทางการสื่อสาร = item.channel
 *   4. ผู้รับสาร = item.recipients
 *   5. หลักฐาน (ถ้ามี) = item.evidenceFiles (เชื่อมโยงข้อมูลไฟล์จริง ไม่ทิ้ง dataUrl/base64)
 */

/** Resolve recorder position from all known payload/schema variants. */
function resolveRecorderPosition(record: EnablersReport): string {
  const source = record as any;
  const candidates = [
    source.recorder_position,
    source.recorderPosition,
    source.recorder_title,
    source.recorderTitle,
    source.job_title,
    source.jobTitle,
    source.position,
    source.author?.position,
    source.recorder?.position,
    source.recorder_status
  ];

  for (const candidate of candidates) {
    const formatted = formatSignOffPosition(
      typeof candidate === 'string' ? candidate : candidate == null ? '' : String(candidate)
    );
    if (!formatted) continue;
    const normalized = formatted.replace(/[＊*•]+/g, '').trim();
    if (!normalized || /^[-–—]+$/.test(normalized)) continue;
    if (/^(ตำแหน่ง|ตำแหน่งผู้รายงาน|position)\s*:?$/i.test(normalized)) continue;
    if (/^(ตำแหน่ง|position)\s*[＊*]$/i.test(normalized)) continue;
    return normalized;
  }
  return '';
}

export function recordToPrintPayload(record: EnablersReport): PrintDocumentPayload {
  const enablersList = (record.executive_topics || []).filter(Boolean);

  // รวบรวมไฟล์ต้นฉบับจริงที่มีข้อมูล binary จากทุกแหล่งที่เป็นไปได้
  const allAvailableFiles: AttachedEvidenceFile[] = [
    ...(record.evidenceFiles || []),
    ...(record.evidence_files || []),
    ...currentPdfStore.getEvidenceFiles(record.id),
    ...currentPdfStore.getEvidenceFiles(record.submission_id)
  ];

  const fileLookup = new Map<string, AttachedEvidenceFile>();
  allAvailableFiles.forEach(f => {
    if (f.id && !fileLookup.has(f.id)) fileLookup.set(f.id, f);
    if (f.name && !fileLookup.has(f.name)) fileLookup.set(f.name, f);
  });

  const tableRows: PrintTableRow[] = (record.communication_details_text || []).map((item, idx) => {
    // ประเด็นการสื่อสาร / สาระสำคัญของการสื่อสาร
    const details = (item.details || '').trim();
    const topicOrDetails = details || (enablersList.length > 0 ? enablersList.join(', ') : '-');

    const itemFiles = item.evidenceFiles || [];
    // เชื่อมโยง metadata กับไฟล์ต้นฉบับจริงที่มี dataUrl, base64 หรือ URL
    const resolvedEvidenceFiles: AttachedEvidenceFile[] = itemFiles.map(file => {
      // 1. ถ้ามีเนื้อหาไฟล์อยู่แล้ว ใช้ได้ทันที
      if (file.dataUrl || file.base64 || (file.url && /^data:/i.test(file.url))) {
        return file;
      }
      // 2. ค้นหาจาก lookup map ที่รวบรวมจาก root report / currentPdfStore
      const found = (file.id ? fileLookup.get(file.id) : undefined) ||
                    (file.name ? fileLookup.get(file.name) : undefined) ||
                    currentPdfStore.findEvidenceFile(file.id) ||
                    currentPdfStore.findEvidenceFile(file.name);

      if (found) {
        return {
          ...file,
          dataUrl: found.dataUrl || file.dataUrl,
          base64: found.base64 || file.base64,
          url: file.url || found.url,
          mimeType: file.mimeType || found.mimeType,
          type: file.type || found.type
        };
      }
      return file;
    });

    // หาก item ไม่มีไฟล์ระบุไว้ แต่ใน root report มีไฟล์ชุดเดียวกับรายการนี้ (กรณี 1 รายการ)
    const finalFiles = resolvedEvidenceFiles.length > 0
      ? resolvedEvidenceFiles
      : (record.communication_details_text.length === 1 && allAvailableFiles.length > 0)
        ? allAvailableFiles
        : [];

    return {
      index: idx + 1,
      communicator: item.communicator || '-',
      topicOrDetails,
      channel: item.channel || '-',
      recipients: item.recipients || '-',
      evidenceFiles: finalFiles
    };
  });


  return {
    reportId: record.id,
    documentTitle: 'รายงานการสื่อสารตามแผนการสื่อสารภายในและภายนอกองค์กรของผู้บริหาร',
    fiscalYear: String(record.fiscal_year || FISCAL_YEAR_TARGET),
    month: formatFiscalMonthWithYear(record.communication_month, record.fiscal_year || FISCAL_YEAR_TARGET),
    quarter: record.fiscal_quarter || 'Q1',
    createdDateThai: formatThaiDate(record.created_date || new Date().toISOString()),
    author: {
      name: record.recorder_name || '-',
      position: record.recorder_status || '-',
      affiliation: record.recorder_affiliation || '',
      department: record.recorder_dept || '',
      affiliationDepartment: formatAffiliationDepartment(record.recorder_affiliation, record.recorder_dept),
      phone: record.recorder_phone || '-',
      email: record.recorder_email || '-'
    },
    enablersTopics: enablersList,
    tableRows,
    problems: record.problems || '',
    suggestions: record.suggestions || '',
    signOff: {
      recorderName: record.recorder_name || '-',
      // รองรับชื่อฟิลด์ตำแหน่งจาก schema/เวอร์ชันก่อนหน้า
      // Resolve the actual position from current and legacy field names.
      // Ignore UI placeholders such as '*', 'ตำแหน่ง *', and '-'.
      recorderPosition: resolveRecorderPosition(record),
      recorderDept: record.recorder_dept || '-',
      verifiedBy: record.verified_by || 'คณะทำงานขับเคลื่อน Enablers กปน.'
    }
  };
}
