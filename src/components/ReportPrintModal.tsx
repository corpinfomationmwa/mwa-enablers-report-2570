import React from 'react';
import { X, Printer, Download, FileText, CheckCircle2 } from 'lucide-react';
import { EnablersReport } from '../types/enablers';
import { formatThaiDate, formatFiscalMonthWithYear, FISCAL_QUARTERS_INFO } from '../utils/fiscalYear';
import { formatSignOffPosition } from '../utils/mwaPrintConverter';
import { EvidenceFilePreview } from './EvidenceFilePreview';

interface ReportPrintModalProps {
  report: EnablersReport | null;
  mode: 'pdf' | 'print';
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export const ReportPrintModal: React.FC<ReportPrintModalProps> = ({
  report,
  mode,
  onClose
}) => {
  if (!report) return null;

  const quarterInfo = FISCAL_QUARTERS_INFO[report.fiscal_quarter];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-[15px] max-w-4xl w-full shadow-2xl border border-[#e0e0e0] overflow-hidden my-auto max-h-[94vh] flex flex-col font-['Mitr',sans-serif]">
        {/* Top Action Bar (Screen Only) */}
        <div className="bg-gradient-to-r from-[#1976d2] to-[#42a5f5] px-6 py-4 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-cyan-200" />
            <h3 className="font-medium text-base">
              {mode === 'pdf' ? 'เอกสารรายงาน Enablers (PDF View)' : 'พิมพ์เอกสารรายงาน Enablers'}
            </h3>
            <span className="font-mono text-xs bg-white/20 px-2.5 py-0.5 rounded text-white font-bold">
              {report.id}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-white text-[#1976d2] hover:bg-blue-50 px-3.5 py-1.5 rounded-[6px] text-xs font-medium flex items-center gap-1.5 transition shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>สั่งพิมพ์ / บันทึก PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-[6px] hover:bg-white/20 text-white transition"
              title="ปิด"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div id="printable-report" className="p-8 sm:p-10 overflow-y-auto text-slate-800 space-y-6 text-sm bg-white print:overflow-visible">
          {/* Header of Official MWA Report */}
          <div className="border-b-2 border-[#1976d2] pb-5 text-center space-y-1">
            <div className="inline-block px-3 py-1 bg-blue-50 text-[#1976d2] text-xs font-semibold rounded-full border border-blue-200 mb-1">
              การประปานครหลวง (กปน.) • Metropolitan Waterworks Authority
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-wide">
              รายงานผลการขับเคลื่อนและสื่อสารประเด็น Enablers
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              ประจำปีงบประมาณ {report.fiscal_year} • {quarterInfo.name} ({quarterInfo.calendarPeriod})
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-slate-500 pt-2 font-mono">
              <span>รหัสรายงาน: <strong className="text-[#1976d2]">{report.id}</strong></span>
              <span>•</span>
              <span>วันที่บันทึก: {formatThaiDate(report.created_date)}</span>
            </div>
          </div>

          {/* Section 1: ข้อมูลผู้รายงาน */}
          <div className="border border-slate-200 rounded-[8px] p-4 bg-slate-50/60 space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#1976d2] border-b border-slate-200 pb-1">
              1. ข้อมูลผู้รายงาน
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs pt-1">
              <div>
                <span className="text-slate-500 block">ชื่อ-นามสกุล ผู้รายงาน:</span>
                <span className="font-semibold text-slate-900">{report.recorder_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">ตำแหน่ง:</span>
                <span className="font-semibold text-slate-900">{report.recorder_status}</span>
              </div>
              <div>
                <span className="text-slate-500 block">สายงาน:</span>
                <span className="font-semibold text-slate-900">{report.recorder_affiliation || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">หน่วยงาน (ฝ่าย/สำนัก):</span>
                <span className="font-semibold text-slate-900">{report.recorder_dept}</span>
              </div>
              <div>
                <span className="text-slate-500 block">สถานที่ปฏิบัติงาน:</span>
                <span className="text-slate-800">{report.recorder_place || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">เบอร์ติดต่อ / อีเมล:</span>
                <span className="text-slate-800">{report.recorder_phone || '-'} | {report.recorder_email || '-'}</span>
              </div>
            </div>
          </div>

          {/* Section 2: รอบเดือนและประเด็น Enablers */}
          <div className="border border-slate-200 rounded-[8px] p-4 bg-slate-50/60 space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#1976d2] border-b border-slate-200 pb-1">
              2. รอบเดือนและประเด็นการสื่อสาร Enablers 8 ด้าน
            </h2>
            <div className="text-xs space-y-2 pt-1">
              <div className="flex gap-4">
                <span>เดือนที่สื่อสาร: <strong className="text-slate-900">{formatFiscalMonthWithYear(report.communication_month, report.fiscal_year)}</strong></span>
                <span>ไตรมาส: <strong className="text-[#1976d2]">{report.fiscal_quarter}</strong></span>
                <span>ปีงบประมาณ: <strong className="text-slate-900">{report.fiscal_year}</strong></span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">ประเด็นการสื่อสาร Enablers ที่เกี่ยวข้อง:</span>
                <div className="flex flex-wrap gap-1.5">
                  {report.executive_topics.map((t, idx) => (
                    <span key={idx} className="bg-white border border-blue-200 text-[#1976d2] px-2 py-0.5 rounded text-[11px] font-medium">
                      • {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: รายละเอียดการสื่อสารและหลักฐาน */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#1976d2]">
              3. รายละเอียดการสื่อสารและเอกสารหลักฐาน ({report.communication_details_text.length} ประเด็น)
            </h2>
            <div className="space-y-3">
              {report.communication_details_text.map((item, idx) => (
                <div key={item.id || idx} className="border border-slate-200 rounded-[8px] p-4 bg-white space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-xs">
                    <span className="font-bold text-[#1976d2]">ประเด็นที่ #{idx + 1}</span>
                    <span className="text-slate-600">ผู้สื่อสาร: <strong>{item.communicator}</strong> | ช่องทาง: <strong>{item.channel}</strong></span>
                  </div>
                  {item.recipients && (
                    <p className="text-xs text-slate-600">
                      <strong>กลุ่มเป้าหมาย:</strong> {item.recipients}
                    </p>
                  )}
                  <div className="text-xs bg-slate-50 p-2.5 rounded border border-slate-100">
                    <strong className="text-slate-700 block mb-1">สาระสำคัญ:</strong>
                    <p className="text-slate-800 whitespace-pre-wrap">{item.details}</p>
                  </div>
                  {item.attachmentDetails && (
                    <p className="text-[11px] text-slate-500">
                      <strong>สิ่งที่แนบมาด้วย:</strong> {item.attachmentDetails}
                    </p>
                  )}
                  {item.evidenceFiles && item.evidenceFiles.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-100">
                      <span className="text-[11px] text-slate-500 font-semibold block mb-1">
                        ไฟล์หลักฐานแนบ ({item.evidenceFiles.length} ไฟล์):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:grid-cols-2">
                        {item.evidenceFiles.map((f, fIdx) => (
                          <EvidenceFilePreview key={f.id || fIdx} file={f} index={fIdx} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: ปัญหา อุปสรรค และข้อเสนอแนะ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="border border-slate-200 rounded-[8px] p-3.5 bg-slate-50/60 space-y-1">
              <strong className="text-slate-700 block">ปัญหาและอุปสรรคในการสื่อสาร/ขับเคลื่อน:</strong>
              <p className="text-slate-800 whitespace-pre-wrap">{report.problems || '- ไม่มีระบุ -'}</p>
            </div>
            <div className="border border-slate-200 rounded-[8px] p-3.5 bg-slate-50/60 space-y-1">
              <strong className="text-slate-700 block">ข้อเสนอแนะในการปรับปรุงและพัฒนา:</strong>
              <p className="text-slate-800 whitespace-pre-wrap">{report.suggestions || '- ไม่มีระบุ -'}</p>
            </div>
          </div>

          {/* Signoff / Verification Section */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="space-y-4">
              <p className="font-semibold text-slate-800">{report.recorder_name}</p>
            </div>
            <div className="space-y-4">
              <p className="text-slate-500">ลงชื่อผู้ตรวจสอบ / รับรอง</p>
              <div className="pt-6 border-b border-slate-400 w-48 mx-auto" />
              <p className="font-semibold text-slate-800">({report.verified_by || '................................................'})</p>
              <p className="text-slate-500">คณะทำงานขับเคลื่อน Enablers กปน.</p>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer (Screen Only) */}
        <div className="p-4 bg-[#f8f9fa] border-t border-[#e0e0e0] flex items-center justify-between shrink-0 print:hidden">
          <span className="text-xs text-slate-500">
            เอกสารรายงาน Enablers 2570 • การประปานครหลวง
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-gradient-to-r from-[#1976d2] to-[#42a5f5] text-white rounded-[8px] px-4 py-2 text-xs font-medium hover:opacity-95 transition flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์เอกสาร</span>
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
      </div>
    </div>
  );
};
