import React, { useState } from 'react';
import {
  X,
  Calendar,
  User,
  Building2,
  Phone,
  Mail,
  FileCheck2,
  ExternalLink,
  ShieldCheck,
  Trash2,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Printer
} from 'lucide-react';
import { EnablersReport, VerifyReportPayload } from '../types/enablers';
import { formatThaiDate, formatFiscalMonthWithYear, FISCAL_QUARTERS_INFO } from '../utils/fiscalYear';
import { PdfViewerModal } from './PdfViewerModal';
import enablersApiService from '../services/enablersApiService';

interface ReportDetailModalProps {
  report: EnablersReport | null;
  onClose: () => void;
  onVerify: (id: string, payload: VerifyReportPayload) => Promise<void>;
  onDelete: (id: string, adminPasscode?: string) => Promise<void>;
}

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  report,
  onClose,
  onVerify,
  onDelete
}) => {
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [verifierName, setVerifierName] = useState('ผู้แทนคณะทำงาน Enablers กปน.');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [deletePasscode, setDeletePasscode] = useState(() => enablersApiService.getAdminPasscode() || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  if (!report) return null;

  const quarterInfo = FISCAL_QUARTERS_INFO[report.fiscal_quarter];

  const handleConfirmVerify = async (status: 'verified' | 'rejected') => {
    setIsProcessing(true);
    try {
      await onVerify(report.id, {
        verified_by: verifierName,
        status,
        verification_notes: verificationNotes
      });
      setShowVerifyDialog(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsProcessing(true);
    try {
      await onDelete(report.id, deletePasscode);
      setShowDeleteDialog(false);
      setDeletePasscode('');
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopySummary = () => {
    const summary = `[MWA Enablers Report 2570]
รหัสรายงาน: ${report.id}
ปีงบประมาณ: 2570 (${report.fiscal_quarter} - เดือน ${formatFiscalMonthWithYear(report.communication_month, report.fiscal_year)})
ผู้รายงาน: ${report.recorder_name} (${report.recorder_dept})
โทรศัพท์: ${report.recorder_phone || '-'}
ประเด็นหลัก: ${report.executive_topics.join(', ')}
จำนวนรายการสื่อสาร: ${report.communication_details_text.length} รายการ
สถานะการรับรอง: ${report.is_verified ? 'ผ่านการรับรองแล้ว' : 'รอการรับรอง'}`;
    navigator.clipboard.writeText(summary);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-[15px] max-w-4xl w-full shadow-2xl border border-[#e0e0e0] overflow-hidden my-auto max-h-[92vh] flex flex-col font-['Mitr',sans-serif]">
        {/* Modal Top Header - Gradient #1976d2 -> #42a5f5 */}
        <div className="bg-gradient-to-r from-[#1976d2] to-[#42a5f5] px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm bg-white/20 px-3 py-1 rounded-[6px] text-white font-bold tracking-wider">
              {report.id}
            </span>
            <span className="text-sm text-blue-50 font-normal">
              ปีงบประมาณ {report.fiscal_year} • {quarterInfo.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-[6px] flex items-center gap-1.5 transition"
              title="พิมพ์เอกสาร / บันทึก PDF"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-200" />
              <span>พิมพ์ / PDF</span>
            </button>
            <button
              type="button"
              onClick={handleCopySummary}
              className="text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-[6px] flex items-center gap-1.5 transition"
              title="คัดลอกสรุปรายงาน"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-cyan-200" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'คัดลอกแล้ว' : 'คัดลอกสรุป'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-[6px] hover:bg-white/20 text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 divide-y divide-[#e0e0e0]">
          {/* Status Alert Bar */}
          <div className="pb-4 flex flex-wrap items-center justify-between gap-3 bg-[#f8f9fa] p-4 rounded-[10px] border border-[#e0e0e0]">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-medium px-3 py-1 rounded-full border ${
                report.is_verified
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-amber-50 text-amber-700 border-amber-300'
              }`}>
                {report.is_verified ? '✓ ผ่านการตรวจสอบ/รับรองแล้ว' : '⏳ รอการตรวจสอบ (Submitted)'}
              </span>

              {report.verified_by && (
                <span className="text-xs text-slate-500">
                  รับรองโดย: <strong className="text-slate-700">{report.verified_by}</strong> ({formatThaiDate(report.verified_date)})
                </span>
              )}
            </div>

            <div className="text-xs text-slate-400">
              บันทึกเมื่อ: {formatThaiDate(report.created_date)}
            </div>
          </div>

          {/* Section 1: ข้อมูลผู้รายงาน */}
          <div className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-[#1976d2] font-semibold text-base">
              <User className="w-5 h-5" />
              <h4>ข้อมูลผู้รายงาน</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-[#f8f9fa] p-4 rounded-[10px] border border-[#e0e0e0]">
              <div>
                <span className="text-xs text-slate-400 block">ชื่อ-นามสกุล</span>
                <span className="font-medium text-slate-800">{report.recorder_name}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">ตำแหน่ง</span>
                <span className="text-slate-800 font-medium">{report.recorder_status}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">สายงาน / หน่วยงาน</span>
                <span className="font-semibold text-slate-800">
                  {report.recorder_affiliation ? `${report.recorder_affiliation} • ` : ''}{report.recorder_dept}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">สถานที่ปฏิบัติงาน</span>
                <span className="text-slate-700">{report.recorder_place || '-'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">เบอร์โทรศัพท์</span>
                <span className="text-slate-700 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {report.recorder_phone || '-'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">อีเมล</span>
                <span className="text-slate-700 flex items-center gap-1 font-mono text-xs">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {report.recorder_email || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: รอบการสื่อสาร & ประเด็น Enablers */}
          <div className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-[#1976d2] font-semibold text-base">
              <Calendar className="w-5 h-5" />
              <h4>รอบการสื่อสารและประเด็น Enablers</h4>
            </div>

            <div className="p-4 bg-[#f0f7ff] rounded-[10px] border border-[#90caf9]/50 space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
                <div>
                  <span className="text-slate-500">เดือนที่สื่อสาร: </span>
                  <strong className="text-[#1976d2] font-semibold">{formatFiscalMonthWithYear(report.communication_month, report.fiscal_year)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">ไตรมาสปีงบประมาณ: </span>
                  <span className="bg-[#1976d2] text-white px-2.5 py-0.5 rounded font-semibold text-xs">
                    {report.fiscal_quarter}
                  </span>
                  <span className="ml-1 text-slate-600">({quarterInfo.calendarPeriod})</span>
                </div>
                <div>
                  <span className="text-slate-500">ปีงบประมาณ: </span>
                  <strong className="text-[#1976d2]">{report.fiscal_year}</strong>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-500 block mb-1.5">ประเด็นสำคัญที่สื่อสาร:</span>
                <div className="flex flex-wrap gap-2">
                  {report.executive_topics.map((t, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-white text-[#1976d2] px-3 py-1 rounded-[6px] border border-[#90caf9] font-normal"
                    >
                      • {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: รายละเอียดการสื่อสาร */}
          <div className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-[#1976d2] font-semibold text-base">
              <FileCheck2 className="w-5 h-5" />
              <h4>รายละเอียดการสื่อสาร ({report.communication_details_text.length} รายการ)</h4>
            </div>

            <div className="space-y-3">
              {report.communication_details_text.map((item, index) => (
                <div
                  key={index}
                  className="p-4 rounded-[10px] border border-[#e0e0e0] bg-white space-y-2.5 shadow-2xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0f0f0] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white bg-[#1976d2] px-2 py-0.5 rounded">
                        #{index + 1}
                      </span>
                      <span className="text-xs text-slate-500">ผู้สื่อสาร:</span>
                      <strong className="text-slate-800 text-xs sm:text-sm">{item.communicator}</strong>
                    </div>
                    <span className="text-xs bg-[#f5f5f5] text-slate-700 px-3 py-0.5 rounded-full border border-[#e0e0e0]">
                      ช่องทาง: {item.channel}
                    </span>
                  </div>

                  {item.recipients && (
                    <div className="text-xs">
                      <span className="text-slate-500">กลุ่มเป้าหมาย/ผู้รับ: </span>
                      <span className="text-slate-800 font-medium">{item.recipients}</span>
                    </div>
                  )}

                  <div className="text-xs bg-[#f8f9fa] p-3 rounded-[8px] border border-[#e0e0e0]">
                    <span className="text-slate-500 block mb-1">สาระสำคัญของการสื่อสาร:</span>
                    <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{item.details}</p>
                  </div>

                  {item.attachmentDetails && (
                    <div className="text-xs text-slate-600 flex items-start gap-1.5 pt-1">
                      <span className="text-slate-400 shrink-0">สิ่งที่แนบมา:</span>
                      <span className="italic">{item.attachmentDetails}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: ปัญหา อุปสรรค และข้อเสนอแนะ */}
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-[#f8f9fa] rounded-[10px] border border-[#e0e0e0] space-y-1">
              <h5 className="font-semibold text-slate-700 text-xs">ปัญหาและอุปสรรค:</h5>
              <p className="text-xs text-slate-600 whitespace-pre-wrap">
                {report.problems || '- ไม่มีระบุ -'}
              </p>
            </div>
            <div className="p-4 bg-[#f8f9fa] rounded-[10px] border border-[#e0e0e0] space-y-1">
              <h5 className="font-semibold text-slate-700 text-xs">ข้อเสนอแนะ:</h5>
              <p className="text-xs text-slate-600 whitespace-pre-wrap">
                {report.suggestions || '- ไม่มีระบุ -'}
              </p>
            </div>
          </div>

          {/* Section 5: หลักฐาน / ภาพถ่าย / เอกสารประกอบ */}
          {report.evidence_links && report.evidence_links.length > 0 && (
            <div className="pt-4 space-y-2">
              <h5 className="font-semibold text-slate-700 text-xs">
                หลักฐาน / ภาพถ่าย / เอกสารประกอบ ({report.evidence_links.length} ไฟล์):
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {report.evidence_links.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    download={link.title || `evidence-${idx + 1}`}
                    className="p-3 rounded-[8px] border border-[#e0e0e0] hover:border-[#1976d2] bg-white hover:bg-[#e3f2fd]/40 flex items-center justify-between text-xs transition group"
                  >
                    <div className="truncate pr-2">
                      <span className="font-medium text-slate-800 block truncate">
                        {link.title || `หลักฐานที่ ${idx + 1}`}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono truncate block">
                        {link.url.startsWith('data:') ? 'ไฟล์แนบในระบบ' : link.url}
                      </span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-[#1976d2] shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-[#f8f9fa] border-t border-[#e0e0e0] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            className="bg-[#f44336] text-white rounded-[8px] px-3.5 py-2 text-xs font-medium hover:bg-red-600 transition flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>ลบรายงานนี้</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="bg-white text-[#1976d2] border border-[#1976d2] rounded-[8px] px-3.5 py-2 text-xs font-medium hover:bg-blue-50 transition flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์รายงาน / PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setShowVerifyDialog(true)}
              className="bg-gradient-to-r from-[#1976d2] to-[#42a5f5] text-white rounded-[8px] px-4 py-2 text-xs font-medium hover:opacity-95 transition flex items-center gap-1.5 shadow-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>ตรวจสอบ / รับรองรายงาน</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="bg-[#f5f5f5] text-slate-700 border border-[#e0e0e0] rounded-[8px] px-4 py-2 text-xs font-medium hover:bg-slate-200 transition"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>

        {/* Verify Sub-Dialog */}
        {showVerifyDialog && (
          <div className="fixed inset-0 z-60 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-[12px] max-w-md w-full p-6 shadow-2xl space-y-4 border border-[#e0e0e0]">
              <h4 className="font-semibold text-slate-800 text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#1976d2]" />
                <span>รับรองรายงาน Enablers {report.id}</span>
              </h4>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ชื่อผู้ตรวจสอบ / หน่วยงานรับรอง
                </label>
                <input
                  type="text"
                  value={verifierName}
                  onChange={e => setVerifierName(e.target.value)}
                  className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] px-3 py-2 text-xs outline-none focus:border-[#1976d2]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ข้อคิดเห็นการตรวจสอบ
                </label>
                <textarea
                  rows={2}
                  value={verificationNotes}
                  onChange={e => setVerificationNotes(e.target.value)}
                  placeholder="เช่น ข้อมูลครบถ้วน หลักฐานชัดเจน"
                  className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] px-3 py-2 text-xs outline-none focus:border-[#1976d2]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVerifyDialog(false)}
                  className="bg-[#f5f5f5] text-slate-700 border border-[#e0e0e0] rounded-[8px] px-3 py-1.5 text-xs hover:bg-slate-200"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleConfirmVerify('rejected')}
                  className="bg-amber-500 text-white rounded-[8px] px-3 py-1.5 text-xs hover:bg-amber-600"
                >
                  ส่งกลับแก้ไข
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleConfirmVerify('verified')}
                  className="bg-gradient-to-r from-[#1976d2] to-[#42a5f5] text-white rounded-[8px] px-4 py-1.5 text-xs font-medium hover:opacity-95"
                >
                  รับรองผ่าน (Verified)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Sub-Dialog */}
        {showDeleteDialog && (
          <div className="fixed inset-0 z-60 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-[12px] max-w-sm w-full p-5 shadow-2xl space-y-4 border border-[#e0e0e0]">
              <h4 className="font-semibold text-[#f44336] text-base flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-[#f44336]" />
                <span>ยืนยันการลบรายงาน</span>
              </h4>
              <p className="text-xs text-slate-600">
                คุณแน่ใจหรือไม่ว่าต้องการลบรายงานรหัส <strong className="font-mono text-slate-800">{report.id}</strong>?
                การดำเนินการนี้ไม่สามารถยกเลิกได้
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  รหัสผ่านยืนยันสิทธิ์คณะทำงาน (Admin Passcode)
                </label>
                <input
                  type="password"
                  value={deletePasscode}
                  onChange={e => setDeletePasscode(e.target.value)}
                  placeholder="กรอกรหัสผ่านเพื่อยืนยันสิทธิ์การลบ"
                  className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] px-3 py-2 text-xs outline-none focus:border-[#f44336]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setDeletePasscode('');
                  }}
                  className="bg-[#f5f5f5] text-slate-700 border border-[#e0e0e0] rounded-[8px] px-3 py-1.5 text-xs hover:bg-slate-200"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleConfirmDelete}
                  className="bg-[#f44336] text-white rounded-[8px] px-3 py-1.5 text-xs font-medium hover:bg-red-600 disabled:opacity-50"
                >
                  ลบรายงาน
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Print / PDF Document Modal (Official A4 Landscape) */}
        {showPrintModal && (
          <PdfViewerModal
            report={report}
            onClose={() => setShowPrintModal(false)}
          />
        )}
      </div>
    </div>
  );
};
