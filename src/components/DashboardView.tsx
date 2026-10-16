import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Building2,
  CheckCircle2,
  XCircle,
  Search,
  RotateCcw,
  AlertCircle,
  X,
  FileCheck
} from 'lucide-react';
import { EnablersReport, FiscalQuarter } from '../types/enablers';

interface DashboardViewProps {
  reports: EnablersReport[];
  onFilterQuarter?: (q: FiscalQuarter) => void;
  onSelectReport?: (report: EnablersReport) => void;
}

// โครงสร้างหน่วยงาน Master Data (13 หน่วยงาน ไม่ซ้ำกัน)
export interface MasterDeptItem {
  affiliation: string;
  department: string;
}

export const MWA_13_MASTER_DEPARTMENTS: MasterDeptItem[] = [
  // 1-3: สายงานผู้ว่าการ
  { affiliation: 'สายงานผู้ว่าการ', department: 'สำนักตรวจสอบ' },
  { affiliation: 'สายงานผู้ว่าการ', department: 'ฝ่ายธรรมาภิบาล' },
  { affiliation: 'สายงานผู้ว่าการ', department: 'ฝ่ายบริหารความรับผิดชอบต่อสังคม' },
  // 4-7: สายงานบริหาร
  { affiliation: 'สายงานบริหาร', department: 'ฝ่ายบริหารทรัพยากรบุคคล' },
  { affiliation: 'สายงานบริหาร', department: 'ฝ่ายพัฒนาทรัพยากรบุคคล' },
  { affiliation: 'สายงานบริหาร', department: 'ฝ่ายสวัสดิการและกิจการสัมพันธ์' },
  { affiliation: 'สายงานบริหาร', department: 'กองความปลอดภัย สวัสดิภาพและอาชีวอนามัย' },
  // 8: สายงานบริการด้านตะวันออก
  { affiliation: 'สายงานบริการด้านตะวันออก', department: 'ฝ่ายการตลาดและลูกค้าสัมพันธ์' },
  // 9-10: สายงานแผนและพัฒนา (ฝ่ายนโยบายและยุทธศาสตร์ นับเพียง 1 ครั้ง ไม่ซ้ำ)
  { affiliation: 'สายงานแผนและพัฒนา', department: 'ฝ่ายนโยบายและยุทธศาสตร์' },
  { affiliation: 'สายงานแผนและพัฒนา', department: 'ฝ่ายบริหารความเสี่ยง' },
  // 11-13: สายงานเทคโนโลยีดิจิทัล
  { affiliation: 'สายงานเทคโนโลยีดิจิทัล', department: 'ฝ่ายพัฒนาระบบงานดิจิทัล' },
  { affiliation: 'สายงานเทคโนโลยีดิจิทัล', department: 'ฝ่ายโครงสร้างพื้นฐานเทคโนโลยีดิจิทัล' },
  { affiliation: 'สายงานเทคโนโลยีดิจิทัล', department: 'ฝ่ายยุทธศาสตร์และนวัตกรรมดิจิทัล' },
];

export const MWA_5_AFFILIATIONS = [
  'สายงานผู้ว่าการ',
  'สายงานบริหาร',
  'สายงานบริการด้านตะวันออก',
  'สายงานแผนและพัฒนา',
  'สายงานเทคโนโลยีดิจิทัล',
];

// 12 เดือนในรอบปีงบประมาณ 2570 เรียงตามลำดับดำเนินงานจริง
const FISCAL_MONTHS_LIST_2570 = [
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

// Mapping ไตรมาส -> รายการเดือน
const QUARTER_MONTHS_MAP: Record<string, string[]> = {
  Q1: ['ตุลาคม 2569', 'พฤศจิกายน 2569', 'ธันวาคม 2569'],
  Q2: ['มกราคม 2570', 'กุมภาพันธ์ 2570', 'มีนาคม 2570'],
  Q3: ['เมษายน 2570', 'พฤษภาคม 2570', 'มิถุนายน 2570'],
  Q4: ['กรกฎาคม 2570', 'สิงหาคม 2570', 'กันยายน 2570'],
};

// แปลงค่าเดือนของรายงานให้อยู่ในรูป Month Year เสมอ
function normalizeReportMonth(monthStr?: string): string {
  if (!monthStr) return '';
  const trimmed = monthStr.trim();
  if (trimmed.includes('2569') || trimmed.includes('2570')) {
    return trimmed;
  }
  if (['ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'].includes(trimmed)) {
    return `${trimmed} 2569`;
  }
  return `${trimmed} 2570`;
}

// เปรียบเทียบชื่อหน่วยงาน
function matchDept(reportDept?: string, masterDept?: string): boolean {
  if (!reportDept || !masterDept) return false;
  const cleanReport = reportDept.replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
  const cleanMaster = masterDept.replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
  return (
    cleanReport === cleanMaster ||
    cleanReport.includes(cleanMaster) ||
    cleanMaster.includes(cleanReport)
  );
}

// เปรียบเทียบสายงานด้วย เพื่อไม่ให้รายงานจากสายงานอื่นถูกนับให้หน่วยงานผิดแห่ง
function matchAffiliation(reportAffiliation?: string, masterAffiliation?: string): boolean {
  if (!reportAffiliation || !masterAffiliation) return false;
  const cleanReport = reportAffiliation.replace(/\s+/g, ' ').trim().toLowerCase();
  const cleanMaster = masterAffiliation.replace(/\s+/g, ' ').trim().toLowerCase();
  return cleanReport === cleanMaster;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ reports }) => {
  // 1. โหมด: 'monthly' (รายเดือน) | 'quarterly' (รายไตรมาส)
  const [mode, setMode] = useState<'monthly' | 'quarterly'>('monthly');

  // 2. ตัวเลือกเวลา
  const [selectedMonth, setSelectedMonth] = useState<string>('ตุลาคม 2569');
  const [selectedQuarter, setSelectedQuarter] = useState<'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');

  // 3. ตัวกรองสายงาน และ หน่วยงาน (Cascading)
  const [selectedAffiliation, setSelectedAffiliation] = useState<string>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 4. ค่าตัวกรองที่กดใช้งานจริงผ่านปุ่ม "ค้นหา" และ "รีเซ็ต"
  const [appliedFilters, setAppliedFilters] = useState({
    mode: 'monthly' as 'monthly' | 'quarterly',
    month: 'ตุลาคม 2569',
    quarter: 'Q1' as 'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4',
    affiliation: 'all',
    dept: 'all',
    search: '',
  });

  // 5. State สำหรับ Drill-down คลิกหน่วยงานที่ยังไม่ได้ส่ง
  const [unsubmittedDetail, setUnsubmittedDetail] = useState<{
    affiliation: string;
    department: string;
    periodLabel: string;
  } | null>(null);

  // รายการหน่วยงานที่เลือกได้ตามสายงาน (Cascading)
  const availableDepts = useMemo(() => {
    if (selectedAffiliation !== 'all') {
      return MWA_13_MASTER_DEPARTMENTS.filter(
        d => d.affiliation === selectedAffiliation
      ).map(d => d.department);
    }
    return MWA_13_MASTER_DEPARTMENTS.map(d => d.department);
  }, [selectedAffiliation]);

  const handleAffiliationChange = (val: string) => {
    setSelectedAffiliation(val);
    setSelectedDept('all');
  };

  // Handler ปุ่ม ค้นหา
  const handleSearch = () => {
    setAppliedFilters({
      mode,
      month: selectedMonth,
      quarter: selectedQuarter,
      affiliation: selectedAffiliation,
      dept: selectedDept,
      search: searchQuery.trim(),
    });
  };

  // Handler ปุ่ม รีเซ็ต
  const handleReset = () => {
    setMode('monthly');
    setSelectedMonth('ตุลาคม 2569');
    setSelectedQuarter('Q1');
    setSelectedAffiliation('all');
    setSelectedDept('all');
    setSearchQuery('');

    setAppliedFilters({
      mode: 'monthly',
      month: 'ตุลาคม 2569',
      quarter: 'Q1',
      affiliation: 'all',
      dept: 'all',
      search: '',
    });
  };

  // รายการเดือนเป้าหมายตามช่วงเวลาที่กรอง
  const targetMonthsInPeriod = useMemo(() => {
    if (appliedFilters.mode === 'monthly') {
      return [appliedFilters.month];
    }
    if (appliedFilters.quarter === 'all') {
      return FISCAL_MONTHS_LIST_2570;
    }
    return QUARTER_MONTHS_MAP[appliedFilters.quarter] || [];
  }, [appliedFilters.mode, appliedFilters.month, appliedFilters.quarter]);

  // กรองรายการหน่วยงานตามตัวกรอง สายงาน, หน่วยงาน, และ คำค้นหา
  const filteredMasterDepts = useMemo(() => {
    return MWA_13_MASTER_DEPARTMENTS.filter(d => {
      // 1. กรองสายงาน
      if (appliedFilters.affiliation !== 'all' && d.affiliation !== appliedFilters.affiliation) {
        return false;
      }
      // 2. กรองหน่วยงาน
      if (appliedFilters.dept !== 'all' && d.department !== appliedFilters.dept) {
        return false;
      }
      // 3. กรองคำค้นหา
      if (appliedFilters.search) {
        const q = appliedFilters.search.toLowerCase();
        const matchQ =
          d.department.toLowerCase().includes(q) ||
          d.affiliation.toLowerCase().includes(q);
        if (!matchQ) return false;
      }
      return true;
    });
  }, [appliedFilters.affiliation, appliedFilters.dept, appliedFilters.search]);

  // ตรวจสอบว่าแต่ละหน่วยงานมี report ในช่วงเวลานี้หรือไม่
  const checkDeptSubmission = (deptName: string, affName: string) => {
    const matching = reports.filter(r => {
      // 1. ต้องตรงทั้งสายงานและหน่วยงาน ป้องกันการนับข้ามสายงาน
      if (!matchDept(r.recorder_dept, deptName)) return false;
      if (!matchAffiliation(r.recorder_affiliation, affName)) return false;

      // 2. ตรงช่วงเวลา
      if (appliedFilters.mode === 'monthly') {
        const norm = normalizeReportMonth(r.communication_month);
        return norm === appliedFilters.month;
      } else {
        // รายไตรมาส
        if (appliedFilters.quarter !== 'all') {
          if (r.fiscal_quarter && r.fiscal_quarter === appliedFilters.quarter) {
            return true;
          }
        }
        const norm = normalizeReportMonth(r.communication_month);
        return targetMonthsInPeriod.includes(norm);
      }
    });

    return matching.length > 0;
  };

  // คำนวณสรุปผลตาม 13 หน่วยงาน
  const evaluation = useMemo(() => {
    const submittedList: MasterDeptItem[] = [];
    const missingList: MasterDeptItem[] = [];

    filteredMasterDepts.forEach(d => {
      const hasReport = checkDeptSubmission(d.department, d.affiliation);
      if (hasReport) {
        submittedList.push(d);
      } else {
        missingList.push(d);
      }
    });

    const totalDeptsCount = filteredMasterDepts.length;
    const submittedCount = submittedList.length;
    const missingCount = totalDeptsCount - submittedCount;

    return {
      totalDeptsCount,
      submittedCount,
      missingCount,
      submittedList,
      missingList,
    };
  }, [filteredMasterDepts, reports, appliedFilters, targetMonthsInPeriod]);

  // ข้อความกำกับช่วงเวลาปัจจุบัน
  const currentPeriodLabel =
    appliedFilters.mode === 'monthly'
      ? `ประจำเดือน ${appliedFilters.month}`
      : appliedFilters.quarter === 'all'
      ? 'ทุกไตรมาส (ปีงบประมาณ 2570)'
      : `ไตรมาสที่ ${appliedFilters.quarter.replace('Q', '')} (${
          QUARTER_MONTHS_MAP[appliedFilters.quarter]?.join(', ') || ''
        })`;

  return (
    <div className="w-full space-y-6 font-['Mitr',sans-serif]">
      {/* ========================================================
          1. HEADER CONTROLS: [ รายเดือน | รายไตรมาส ] + FILTERS
         ======================================================== */}
      <div className="bg-white rounded-[15px] p-6 shadow-[0_4px_15px_rgba(0,0,0,0.05)] border border-[#e0e0e0] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f0f0f0] pb-4">
          <div>
            <h2 className="text-xl font-bold text-[#1976d2] flex items-center gap-2">
              <Calendar className="w-6 h-6 text-[#1976d2]" />
              <span>สรุปแดชบอร์ดติดตามการส่งรายงาน</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              สรุปสถานะหน่วยงานที่ส่งแล้วและยังไม่ได้ส่งรายงาน ({currentPeriodLabel})
            </p>
          </div>

          {/* Toggle Button: [ รายเดือน ] [ รายไตรมาส ] */}
          <div className="inline-flex bg-slate-100 p-1 rounded-[10px] border border-slate-200 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                setMode('monthly');
                setAppliedFilters(prev => ({ ...prev, mode: 'monthly' }));
              }}
              className={`px-4 py-2 rounded-[8px] text-xs sm:text-sm font-medium transition cursor-pointer ${
                mode === 'monthly'
                  ? 'bg-gradient-to-r from-[#1976d2] to-[#42a5f5] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายเดือน
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('quarterly');
                setAppliedFilters(prev => ({ ...prev, mode: 'quarterly' }));
              }}
              className={`px-4 py-2 rounded-[8px] text-xs sm:text-sm font-medium transition cursor-pointer ${
                mode === 'quarterly'
                  ? 'bg-gradient-to-r from-[#1976d2] to-[#42a5f5] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รายไตรมาส
            </button>
          </div>
        </div>

        {/* ตัวกรอง: ช่วงเวลา / สายงาน / หน่วยงาน / ค้นหา */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* ตัวเลือกช่วงเวลา */}
          {mode === 'monthly' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                เลือกเดือน (ปีงบประมาณ 2570)
              </label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full h-[42px] bg-slate-50 border border-[#e0e0e0] focus:border-[#1976d2] focus:bg-white rounded-[8px] px-3 text-xs sm:text-sm text-slate-800 outline-none transition"
              >
                {FISCAL_MONTHS_LIST_2570.map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                เลือกไตรมาส
              </label>
              <select
                value={selectedQuarter}
                onChange={e => setSelectedQuarter(e.target.value as any)}
                className="w-full h-[42px] bg-slate-50 border border-[#e0e0e0] focus:border-[#1976d2] focus:bg-white rounded-[8px] px-3 text-xs sm:text-sm text-slate-800 outline-none transition"
              >
                <option value="all">ทั้งหมด (Q1 - Q4)</option>
                <option value="Q1">Q1 (ต.ค. 2569 - ธ.ค. 2569)</option>
                <option value="Q2">Q2 (ม.ค. 2570 - มี.ค. 2570)</option>
                <option value="Q3">Q3 (เม.ย. 2570 - มิ.ย. 2570)</option>
                <option value="Q4">Q4 (ก.ค. 2570 - ก.ย. 2570)</option>
              </select>
            </div>
          )}

          {/* สายงาน */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              สายงาน
            </label>
            <select
              value={selectedAffiliation}
              onChange={e => handleAffiliationChange(e.target.value)}
              className="w-full h-[42px] bg-slate-50 border border-[#e0e0e0] focus:border-[#1976d2] focus:bg-white rounded-[8px] px-3 text-xs sm:text-sm text-slate-800 outline-none transition"
            >
              <option value="all">ทุกสายงาน (5 สายงาน)</option>
              {MWA_5_AFFILIATIONS.map(aff => (
                <option key={aff} value={aff}>
                  {aff}
                </option>
              ))}
            </select>
          </div>

          {/* หน่วยงาน (Cascading ตามสายงาน) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              หน่วยงาน (ฝ่าย/สำนัก)
            </label>
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="w-full h-[42px] bg-slate-50 border border-[#e0e0e0] focus:border-[#1976d2] focus:bg-white rounded-[8px] px-3 text-xs sm:text-sm text-slate-800 outline-none transition"
            >
              <option value="all">ทุกหน่วยงาน</option>
              {availableDepts.map(d => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* ช่องค้นหา */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ค้นหาหน่วยงาน
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="พิมพ์ชื่อหน่วยงานหรือสายงาน..."
                className="w-full h-[42px] bg-slate-50 border border-[#e0e0e0] focus:border-[#1976d2] focus:bg-white rounded-[8px] pl-9 pr-3 text-xs sm:text-sm text-slate-800 outline-none transition"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>
        </div>

        {/* ปุ่มค้นหา และ ปุ่มรีเซ็ต */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleSearch}
            className="h-[40px] bg-gradient-to-r from-[#1976d2] to-[#42a5f5] hover:from-[#1565c0] hover:to-[#1976d2] text-white rounded-[8px] px-6 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>ค้นหา</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="h-[40px] bg-white hover:bg-slate-100 text-slate-700 border border-[#e0e0e0] rounded-[8px] px-5 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>รีเซ็ต</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          2. SUMMARY CARDS: 3 CARDS ONLY
             [ หน่วยงานทั้งหมด ] [ ส่งแล้ว ] [ ยังไม่ได้ส่ง ]
         ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: หน่วยงานทั้งหมด */}
        <div className="bg-white rounded-[12px] p-6 shadow-[0_4px_15px_rgba(0,0,0,0.05)] border-t-[4px] border-[#1976d2] flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-slate-600 block">
              หน่วยงานทั้งหมด
            </span>
            <span className="text-4xl font-bold text-[#1976d2] block mt-1">
              {evaluation.totalDeptsCount}
            </span>
            <span className="text-xs text-slate-400 block mt-1">
              หน่วยงานที่ต้องรายงาน (13 หน่วยงานหลัก)
            </span>
          </div>
          <div className="w-14 h-14 rounded-[12px] bg-[#e3f2fd] text-[#1976d2] flex items-center justify-center">
            <Building2 className="w-7 h-7" />
          </div>
        </div>

        {/* Card 2: ส่งแล้ว */}
        <div className="bg-white rounded-[12px] p-6 shadow-[0_4px_15px_rgba(0,0,0,0.05)] border-t-[4px] border-emerald-500 flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-slate-600 block">
              ส่งแล้ว
            </span>
            <span className="text-4xl font-bold text-emerald-600 block mt-1">
              {evaluation.submittedCount}
            </span>
            <span className="text-xs text-emerald-600/80 block mt-1">
              หน่วยงานที่มีรายงานในช่วงเวลาที่เลือก
            </span>
          </div>
          <div className="w-14 h-14 rounded-[12px] bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7" />
          </div>
        </div>

        {/* Card 3: ยังไม่ได้ส่ง */}
        <div className="bg-white rounded-[12px] p-6 shadow-[0_4px_15px_rgba(0,0,0,0.05)] border-t-[4px] border-rose-500 flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-slate-600 block">
              ยังไม่ได้ส่ง
            </span>
            <span className="text-4xl font-bold text-rose-500 block mt-1">
              {evaluation.missingCount}
            </span>
            <span className="text-xs text-rose-500/80 block mt-1">
              หน่วยงานที่ยังไม่มีรายงาน
            </span>
          </div>
          <div className="w-14 h-14 rounded-[12px] bg-rose-50 text-rose-500 flex items-center justify-center">
            <XCircle className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* ========================================================
          3. MAIN RESULT: แสดงหน่วยงานทั้งหมดพร้อมสถานะ
         ======================================================== */}
      <div className="bg-white rounded-[15px] shadow-[0_4px_15px_rgba(0,0,0,0.05)] border border-[#e0e0e0] overflow-hidden">
        <div className="bg-gradient-to-r from-[#1976d2] to-[#42a5f5] text-white p-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-blue-100" />
            <h3 className="text-base sm:text-lg font-bold tracking-tight">
              สถานะการส่งรายงานของทุกหน่วยงาน ({currentPeriodLabel})
            </h3>
          </div>
          <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-[6px] font-medium">
            ทั้งหมด: {evaluation.totalDeptsCount} หน่วยงาน
          </span>
        </div>

        {filteredMasterDepts.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">ไม่พบหน่วยงานตามตัวกรองที่เลือก</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                  <th className="py-3 px-5 w-16 text-center">ลำดับ</th>
                  <th className="py-3 px-5 min-w-[200px]">สายงาน</th>
                  <th className="py-3 px-5 min-w-[260px]">หน่วยงาน (ฝ่าย/สำนัก)</th>
                  <th className="py-3 px-5 text-center w-40">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMasterDepts.map((item, idx) => {
                  const isSubmitted = checkDeptSubmission(item.department, item.affiliation);
                  return (
                    <tr
                      key={`${item.affiliation}-${item.department}`}
                      onClick={!isSubmitted ? () => setUnsubmittedDetail({
                        affiliation: item.affiliation,
                        department: item.department,
                        periodLabel: currentPeriodLabel,
                      }) : undefined}
                      className={isSubmitted ? 'hover:bg-emerald-50/40 transition' : 'hover:bg-rose-50/40 transition cursor-pointer'}
                    >
                      <td className="py-3.5 px-5 text-center text-slate-500 font-bold">{idx + 1}</td>
                      <td className="py-3.5 px-5 font-medium text-slate-800">{item.affiliation}</td>
                      <td className="py-3.5 px-5 text-slate-900 font-semibold">{item.department}</td>
                      <td className="py-3.5 px-5 text-center">
                        {isSubmitted ? (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-[6px] text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>ส่งแล้ว</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 border border-rose-200 px-3 py-1 rounded-[6px] text-xs font-semibold">
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                            <span>ยังไม่ได้ส่ง</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================
          4. DRILL DOWN DIALOG: คลิกหน่วยงานที่ยังไม่ได้ส่ง
         ======================================================== */}
       {unsubmittedDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[15px] max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 text-center font-['Mitr',sans-serif]">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                สถานะการส่งรายงาน
              </h3>
              <p className="text-xs text-rose-600 font-medium">
                หน่วยงานนี้ยังไม่มีรายงานในช่วงเวลาที่เลือก
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-3 text-left text-xs space-y-1.5">
              <div>
                <span className="text-slate-500">สายงาน:</span>{' '}
                <strong className="text-slate-800">{unsubmittedDetail.affiliation}</strong>
              </div>
              <div>
                <span className="text-slate-500">หน่วยงาน:</span>{' '}
                <strong className="text-slate-800">{unsubmittedDetail.department}</strong>
              </div>
              <div>
                <span className="text-slate-500">ช่วงเวลา:</span>{' '}
                <span className="text-[#1976d2] font-semibold">{unsubmittedDetail.periodLabel}</span>
              </div>
              <div>
                <span className="text-slate-500">สถานะ:</span>{' '}
                <span className="text-rose-600 font-bold">❌ ยังไม่ได้ส่ง</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setUnsubmittedDetail(null)}
              className="w-full bg-[#1976d2] hover:bg-[#1565c0] text-white py-2.5 rounded-[8px] text-xs font-medium transition cursor-pointer"
            >
              รับทราบ / ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
