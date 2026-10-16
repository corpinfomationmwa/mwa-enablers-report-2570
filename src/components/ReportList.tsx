import React, { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  Eye,
  Calendar,
  Building,
  RotateCcw,
  Briefcase
} from 'lucide-react';
import { EnablersReport } from '../types/enablers';
import {
  MWA_AFFILIATIONS,
  MWA_AFFILIATION_DEPARTMENT_MAP,
  MWA_DEPARTMENTS
} from '../config/enablersConfig';
import { PdfViewerModal } from './PdfViewerModal';

interface ReportListProps {
  reports: EnablersReport[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectReport: (report: EnablersReport) => void;
  onOpenNewForm: () => void;
}

const PAGE_SIZE = 20;

// รายการเดือนเรียง EXACT 13 รายการ (ตุลาคม 2569 ถึง กันยายน 2570)
const MWA_MONTH_FILTER_OPTIONS: string[] = [
  'ทุกเดือน',
  'ตุลาคม 2569',
  'พฤศจิกายน 2569',
  'ธันวาคม 2569',
  'มกราคม 2570',
  'กุมภาพันธ์ 2570',
  'มีนาคม 2570',
  'เมษายน 2570',
  'พฤษภาคม 2570',
  'มิถุนายน 2570',
  'กรกฎาคม 2570',
  'สิงหาคม 2570',
  'กันยายน 2570',
];

// Helper จัดรูปแบบเดือนในตาราง
function formatMonthDisplay(m: string): string {
  if (!m) return '-';
  if (m.includes('2569') || m.includes('2570')) return m;
  if (['ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'].includes(m)) {
    return `${m} 2569`;
  }
  return `${m} 2570`;
}

export const ReportList: React.FC<ReportListProps> = ({
  reports,
  isLoading: _isLoading,
  onRefresh: _onRefresh,
  onSelectReport: _onSelectReport,
  onOpenNewForm: _onOpenNewForm
}) => {
  // 1. เดือน (เปลี่ยนจากไตรมาสเป็นเดือน เรียง EXACT 13 รายการ)
  const [selectedMonth, setSelectedMonth] = useState<string>('ทุกเดือน');
  // 2. สายงาน
  const [selectedAffiliation, setSelectedAffiliation] = useState<string>('all');
  // 3. หน่วยงาน (Cascading ตามสายงาน)
  const [selectedDept, setSelectedDept] = useState<string>('all');
  // 4. ช่องค้นหา
  const [searchQuery, setSearchQuery] = useState<string>('');
  // แบ่งหน้ารายการ: 20 รายการต่อหน้า
  const [currentPage, setCurrentPage] = useState<number>(1);

  // ค่าตัวกรองที่กดใช้งานจริงผ่านปุ่ม "ค้นหา" และ "รีเซ็ต"
  const [appliedFilters, setAppliedFilters] = useState({
    month: 'ทุกเดือน',
    affiliation: 'all',
    dept: 'all',
    query: ''
  });

  // State สำหรับเปิด PDF Viewer เมื่อคลิกไอคอน "เปิดดู"
  const [selectedPdfReport, setSelectedPdfReport] = useState<EnablersReport | null>(null);

  // รายการหน่วยงานตามสายงานที่เลือก (Cascading)
  const availableDepts = selectedAffiliation !== 'all'
    ? (MWA_AFFILIATION_DEPARTMENT_MAP[selectedAffiliation] || [])
    : MWA_DEPARTMENTS;

  // Handler เมื่อเปลี่ยนสายงาน
  const handleAffiliationChange = (val: string) => {
    setSelectedAffiliation(val);
    setSelectedDept('all');
  };

  // Handler ปุ่ม 1: "ค้นหา"
  const handleSearch = () => {
    setCurrentPage(1);
    setAppliedFilters({
      month: selectedMonth,
      affiliation: selectedAffiliation,
      dept: selectedDept,
      query: searchQuery
    });
  };

  // Handler ปุ่ม 2: "รีเซ็ต"
  const handleReset = () => {
    setCurrentPage(1);
    setSelectedMonth('ทุกเดือน');
    setSelectedAffiliation('all');
    setSelectedDept('all');
    setSearchQuery('');
    setAppliedFilters({
      month: 'ทุกเดือน',
      affiliation: 'all',
      dept: 'all',
      query: ''
    });
  };

  // กรองข้อมูลตามเงื่อนไขที่กดค้นหาจริง
  const filteredReports = reports.filter(item => {
    // 1. กรองตามเดือน
    if (appliedFilters.month !== 'ทุกเดือน') {
      const targetMonthCore = appliedFilters.month.split(' ')[0];
      const matchMonth =
        item.communication_month === appliedFilters.month ||
        item.communication_month.includes(targetMonthCore);
      if (!matchMonth) return false;
    }

    // 2. กรองตามสายงาน
    if (
      appliedFilters.affiliation !== 'all' &&
      item.recorder_affiliation &&
      item.recorder_affiliation !== appliedFilters.affiliation
    ) {
      return false;
    }

    // 3. กรองตามหน่วยงาน
    if (appliedFilters.dept !== 'all' && item.recorder_dept !== appliedFilters.dept) {
      return false;
    }

    // 4. กรองตามข้อความค้นหา
    if (appliedFilters.query.trim() !== '') {
      const q = appliedFilters.query.toLowerCase().trim();
      const matchId = item.id.toLowerCase().includes(q);
      const matchName = item.recorder_name.toLowerCase().includes(q);
      const matchStatus = item.recorder_status ? item.recorder_status.toLowerCase().includes(q) : false;
      const matchDept = item.recorder_dept.toLowerCase().includes(q);
      const matchAffiliation = item.recorder_affiliation
        ? item.recorder_affiliation.toLowerCase().includes(q)
        : false;
      const matchTopics = item.executive_topics.some(t => t.toLowerCase().includes(q));
      const matchDetails = item.communication_details_text.some(d =>
        d.details.toLowerCase().includes(q) || d.communicator.toLowerCase().includes(q)
      );
      if (
        !matchId &&
        !matchName &&
        !matchStatus &&
        !matchDept &&
        !matchAffiliation &&
        !matchTopics &&
        !matchDetails
      ) {
        return false;
      }
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedReports = filteredReports.slice(pageStartIndex, pageStartIndex + PAGE_SIZE);

  // หากข้อมูลลดลงหลังโหลดใหม่ ให้กลับไปหน้าที่มีอยู่จริง
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <div className="w-full space-y-6">
      {/* Top Header Card (ไม่มีปุ่ม รีเฟรช / Export CSV / บันทึกข้อมูลใหม่) */}
      <div className="bg-white rounded-[15px] p-5 shadow-[0_4px_15px_rgba(0,0,0,0.05)] border border-[#e0e0e0]">
        <h2 className="text-xl font-semibold text-[#1976d2] flex items-center gap-2">
          <span>ข้อมูลการสื่อสาร Enablers ประจำปี 2570</span>
          <span className="text-xs bg-[#e3f2fd] text-[#1976d2] font-medium px-2.5 py-0.5 rounded-full">
            {filteredReports.length} รายการ
          </span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          ค้นหา ตรวจสอบ และติดตามรายงานการสื่อสารของผู้บริหารตามรอบเดือนการสื่อสาร
        </p>
      </div>

      {/* ========================================================
          FILTER CONTAINER: เดือน | สายงาน | หน่วยงาน | ค้นหา | ปุ่มค้นหา | ปุ่มรีเซ็ต
         ======================================================== */}
      <div className="bg-[#f8f9fa] border border-[#e0e0e0] rounded-[12px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
        {/* Dropdown Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. ตัวกรองเดือน (เรียง EXACT: ทุกเดือน, ต.ค. 2569 ถึง ก.ย. 2570) */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#1976d2]" />
              <span>เดือน</span>
            </label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] py-[9px] px-[12px] text-xs text-slate-800 focus:border-[#1976d2] outline-none"
            >
              {MWA_MONTH_FILTER_OPTIONS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* 2. ตัวกรองสายงาน */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5 text-[#1976d2]" />
              <span>สายงาน</span>
            </label>
            <select
              value={selectedAffiliation}
              onChange={e => handleAffiliationChange(e.target.value)}
              className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] py-[9px] px-[12px] text-xs text-slate-800 focus:border-[#1976d2] outline-none"
            >
              <option value="all">ทุกสายงาน</option>
              {MWA_AFFILIATIONS.map(aff => (
                <option key={aff} value={aff}>{aff}</option>
              ))}
            </select>
          </div>

          {/* 3. ตัวกรองหน่วยงาน (Cascading แสดงเฉพาะหน่วยงานของสายงานที่เลือก) */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-[#1976d2]" />
              <span>หน่วยงาน</span>
            </label>
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] py-[9px] px-[12px] text-xs text-slate-800 focus:border-[#1976d2] outline-none"
            >
              <option value="all">ทุกหน่วยงาน</option>
              {availableDepts.map((d, i) => (
                <option key={`${d}-${i}`} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 4. ช่องค้นหาข้อความ + ปุ่ม "ค้นหา" & "รีเซ็ต" */}
        <div className="flex flex-col sm:flex-row items-end gap-3 pt-1">
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-[#1976d2]" />
              <span>ช่องค้นหา</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="ค้นหาชื่อ-นามสกุล, ตำแหน่ง, สายงาน, หน่วยงาน, ประเด็น..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="w-full bg-white border-2 border-[#e0e0e0] rounded-[8px] h-[42px] pl-[14px] pr-[32px] text-xs sm:text-sm text-slate-800 focus:border-[#1976d2] outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons: ปุ่ม 1 "ค้นหา" + ปุ่ม 2 "รีเซ็ต" */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
            {/* ปุ่ม 1: ค้นหา */}
            <button
              type="button"
              onClick={handleSearch}
              className="flex-1 sm:flex-none h-[42px] bg-[#1976d2] hover:bg-[#1565c0] text-white rounded-[8px] px-[22px] text-sm font-medium flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>ค้นหา</span>
            </button>

            {/* ปุ่ม 2: รีเซ็ต */}
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 sm:flex-none h-[42px] bg-white hover:bg-slate-100 text-slate-700 border border-[#e0e0e0] rounded-[8px] px-[22px] text-sm font-medium flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
              <span>รีเซ็ต</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          ตาราง — รูปแบบของเก่า EXACT:
          | ชื่อ-นามสกุล | ตำแหน่ง | สายงาน | หน่วยงาน | เดือน | ประเด็น Enablers | การดำเนินการ |
         ======================================================== */}
      <div className="bg-white rounded-[12px] shadow-[0_4px_15px_rgba(0,0,0,0.05)] border border-[#e0e0e0] overflow-hidden">
        {filteredReports.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Filter className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-medium text-slate-600">ไม่พบข้อมูลตามเงื่อนไขที่ค้นหา</p>
            <p className="text-xs text-slate-400">
              ลองเปลี่ยนตัวกรองเดือน หรือกด "รีเซ็ต" เพื่อดูข้อมูลทั้งหมด
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-[#1976d2] to-[#42a5f5] text-white font-medium">
                  <th className="py-3.5 px-4 text-white whitespace-nowrap">ชื่อ-นามสกุล</th>
                  <th className="py-3.5 px-4 text-white whitespace-nowrap">ตำแหน่ง</th>
                  <th className="py-3.5 px-4 text-white whitespace-nowrap">สายงาน</th>
                  <th className="py-3.5 px-4 text-white whitespace-nowrap">หน่วยงาน</th>
                  <th className="py-3.5 px-4 text-white whitespace-nowrap text-center">เดือน</th>
                  <th className="py-3.5 px-4 text-white min-w-[260px]">ประเด็น Enablers</th>
                  <th className="py-3.5 px-4 text-white text-center whitespace-nowrap">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {paginatedReports.map(report => (
                  <tr
                    key={report.id}
                    className="hover:bg-[#e3f2fd] transition-colors"
                  >
                    {/* 1. ชื่อ-นามสกุล */}
                    <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {report.recorder_name}
                    </td>

                    {/* 2. ตำแหน่ง */}
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      {report.recorder_status || '-'}
                    </td>

                    {/* 3. สายงาน */}
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      {report.recorder_affiliation || '-'}
                    </td>

                    {/* 4. หน่วยงาน */}
                    <td className="py-3.5 px-4 text-slate-800 whitespace-nowrap">
                      {report.recorder_dept}
                    </td>

                    {/* 5. เดือน */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-center text-[#1976d2] font-medium">
                      {formatMonthDisplay(report.communication_month)}
                    </td>

                    {/* 6. ประเด็น Enablers (ชื่อเต็ม EXACT) */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        {report.executive_topics.map((topic, i) => (
                          <div key={i} className="text-xs text-slate-700 leading-snug">
                            • {topic}
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* 7. การดำเนินการ (ไอคอนเปิดดู -> PDF Viewer) */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedPdfReport(report)}
                        className="bg-white border border-[#e0e0e0] hover:border-[#1976d2] hover:bg-[#e3f2fd]/60 hover:text-[#1976d2] text-slate-700 rounded-[6px] px-3 py-1.5 text-xs font-medium transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="เปิดดูเอกสาร PDF"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#1976d2]" />
                        <span>เปิดดู</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filteredReports.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-[12px] border border-[#e0e0e0] bg-white px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <p className="text-xs text-slate-600" aria-live="polite">
            แสดง {pageStartIndex + 1}–{Math.min(pageStartIndex + PAGE_SIZE, filteredReports.length)} จาก {filteredReports.length} รายการ
          </p>
          <div className="flex items-center gap-1.5" aria-label="เปลี่ยนหน้ารายการ">
            <button
              type="button"
              onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-[#e0e0e0] px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >ก่อนหน้า</button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(page => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                aria-current={currentPage === page ? 'page' : undefined}
                className={`min-w-9 rounded-md border px-3 py-2 text-xs font-medium transition ${currentPage === page ? 'border-[#1976d2] bg-[#1976d2] text-white' : 'border-[#e0e0e0] text-slate-700 hover:bg-slate-50'}`}
              >{page}</button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              className="rounded-md border border-[#e0e0e0] px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >ถัดไป</button>
          </div>
        </div>
      )}

      {/* ========================================================
          PDF VIEWER MODAL (A4 Landscape แบบ Reference)
         ======================================================== */}
      {selectedPdfReport && (
        <PdfViewerModal
          report={selectedPdfReport}
          onClose={() => setSelectedPdfReport(null)}
        />
      )}
    </div>
  );
};
