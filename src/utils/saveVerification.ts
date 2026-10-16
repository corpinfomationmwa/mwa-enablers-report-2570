/**
 * MWA Enablers Report 2570 - Save Verification Utility
 * 
 * หน้าที่:
 * ทำการตรวจสอบความถูกต้องของข้อมูลหลังการบันทึก (Read-Back Verification)
 * โดยนำข้อมูลจาก Form Payload ที่ผู้ใช้กรอก มาเปรียบเทียบกับ Record ที่อ่านกลับจากฐานข้อมูลจริง
 * เพื่อรับประกันว่าข้อมูลถูกจัดเก็บครบถ้วนและไม่มีฟิลด์ใดตกหล่นก่อนดำเนินการสร้าง PDF และส่งอีเมล
 */

import { CreateReportInput, EnablersReport } from '../types/enablers';
import { formatFiscalMonthWithYear } from './fiscalYear';

export interface SaveVerificationResult {
  success: boolean;
  mismatchFields: string[];
  message: string;
  verifiedAt: string;
}

/**
 * ฟังก์ชันตรวจสอบความสอดคล้องของข้อมูลหลังบันทึก (Authoritative Verification)
 */
export function verifySavedRecord(
  formPayload: CreateReportInput,
  savedRecord: EnablersReport,
  expectedSubmissionId?: string
): SaveVerificationResult {
  const mismatchFields: string[] = [];
  const verifiedAt = new Date().toISOString();

  // 1. ตรวจสอบ Record ID และความมีอยู่ของข้อมูล
  if (!savedRecord || !savedRecord.id) {
    return {
      success: false,
      mismatchFields: ['record_id'],
      message: 'ไม่พบรหัสรายงาน (Record ID) หลังการบันทึกข้อมูล',
      verifiedAt
    };
  }

  // 2. ตรวจสอบ Submission ID (ถ้ามี)
  if (expectedSubmissionId) {
    const recordSubId = savedRecord.submission_id || savedRecord.submissionId;
    if (recordSubId && recordSubId !== expectedSubmissionId) {
      mismatchFields.push('submission_id');
    }
  }

  // 3. ตรวจสอบข้อมูลผู้รายงาน
  if (formPayload.recorder_name.trim() !== (savedRecord.recorder_name || '').trim()) {
    mismatchFields.push('recorder_name');
  }

  if (formPayload.recorder_status.trim() !== (savedRecord.recorder_status || '').trim()) {
    mismatchFields.push('recorder_status');
  }

  if ((formPayload.recorder_affiliation || '').trim() !== (savedRecord.recorder_affiliation || '').trim()) {
    mismatchFields.push('recorder_affiliation');
  }

  if (formPayload.recorder_dept.trim() !== (savedRecord.recorder_dept || '').trim()) {
    mismatchFields.push('recorder_dept');
  }

  if (formPayload.recorder_phone.trim() !== (savedRecord.recorder_phone || '').trim()) {
    mismatchFields.push('recorder_phone');
  }

  if (formPayload.recorder_email.trim() !== (savedRecord.recorder_email || '').trim()) {
    mismatchFields.push('recorder_email');
  }

  // 4. ตรวจสอบเดือนที่ดำเนินการสื่อสาร (Normalized format with Year BE)
  const normFormMonth = formatFiscalMonthWithYear(formPayload.communication_month);
  const normSavedMonth = formatFiscalMonthWithYear(savedRecord.communication_month);
  if (normFormMonth !== normSavedMonth) {
    mismatchFields.push('communication_month');
  }

  // 5. ตรวจสอบประเด็น Enablers ที่เลือก
  const formTopics = (formPayload.executive_topics || []).map(t => t.trim()).sort();
  const savedTopics = (savedRecord.executive_topics || []).map(t => t.trim()).sort();
  if (formTopics.length !== savedTopics.length) {
    mismatchFields.push('executive_topics_count');
  } else {
    const isTopicsMatched = formTopics.every((topic, idx) => topic === savedTopics[idx]);
    if (!isTopicsMatched) {
      mismatchFields.push('executive_topics_content');
    }
  }

  // 6. ตรวจสอบรายละเอียดการสื่อสาร
  const formDetails = formPayload.communication_details_text || [];
  const savedDetails = savedRecord.communication_details_text || [];
  if (formDetails.length !== savedDetails.length) {
    mismatchFields.push('communication_details_count');
  } else {
    formDetails.forEach((fd, i) => {
      const sd = savedDetails[i];
      if (!sd) {
        mismatchFields.push(`communication_details_item_${i + 1}`);
        return;
      }
      if (fd.communicator.trim() !== (sd.communicator || '').trim()) {
        mismatchFields.push(`communication_details_communicator_${i + 1}`);
      }
      if (fd.channel.trim() !== (sd.channel || '').trim()) {
        mismatchFields.push(`communication_details_channel_${i + 1}`);
      }
      if (fd.details.trim() !== (sd.details || '').trim()) {
        mismatchFields.push(`communication_details_details_${i + 1}`);
      }
    });
  }

  // 7. ตรวจสอบปัญหา อุปสรรค และข้อเสนอแนะ
  if ((formPayload.problems || '').trim() !== (savedRecord.problems || '').trim()) {
    mismatchFields.push('problems');
  }

  if ((formPayload.suggestions || '').trim() !== (savedRecord.suggestions || '').trim()) {
    mismatchFields.push('suggestions');
  }

  // ผลการตรวจสอบ
  const success = mismatchFields.length === 0;
  return {
    success,
    mismatchFields,
    message: success
      ? 'ตรวจสอบข้อมูลจากฐานข้อมูลสมบูรณ์ครบถ้วน (Read-Back Verification Passed)'
      : `ข้อมูลที่บันทึกไม่ตรงกับฟอร์มใน ${mismatchFields.length} ฟิลด์ (${mismatchFields.join(', ')})`,
    verifiedAt
  };
}
