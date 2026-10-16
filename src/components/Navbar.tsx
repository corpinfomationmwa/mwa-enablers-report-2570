import React from 'react';
import { FileText, ListFilter, BarChart3 } from 'lucide-react';

interface NavbarProps {
  activeTab: 'form' | 'list' | 'dashboard';
  setActiveTab: (tab: 'form' | 'list' | 'dashboard') => void;
  reportCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  reportCount,
}) => {
  return (
    <div className="space-y-6">
      {/* Header Banner - Classic Enablers Design */}
      <div className="bg-gradient-to-r from-[#1976d2] to-[#42a5f5] text-white text-center rounded-[15px] p-[25px] sm:p-[30px] shadow-[0_8px_25px_rgba(25,118,210,0.22)] transition-all">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-wide">
          ระบบรายงานแผนสื่อสารภายในและภายนอกองค์กร
        </h1>
        <p className="text-sm sm:text-base text-blue-50 mt-2 font-normal max-w-3xl mx-auto leading-relaxed">
          สำหรับผู้บริหาร และหน่วยงานที่เกี่ยวข้องกับประเด็นการสื่อสารตามเกณฑ์ Enablers ประจำปีงบประมาณ 2570
        </p>
      </div>

      {/* 3 Tabs Container - Card สีขาว จัดกึ่งกลาง ความกว้างสมดุลกัน */}
      <div className="bg-white rounded-[12px] p-2 shadow-[0_4px_15px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row gap-2 max-w-4xl mx-auto w-full justify-center">
        <button
          type="button"
          onClick={() => setActiveTab('form')}
          className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-[8px] text-sm sm:text-base font-medium transition-all ${
            activeTab === 'form'
              ? 'bg-gradient-to-r from-[#1976d2] to-[#42a5f5] text-white shadow-[0_4px_12px_rgba(25,118,210,0.3)]'
              : 'bg-transparent text-slate-600 hover:bg-[#e3f2fd]/50 hover:text-[#1976d2]'
          }`}
        >
          <FileText className="w-5 h-5 shrink-0" />
          <span>บันทึกข้อมูล</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-[8px] text-sm sm:text-base font-medium transition-all ${
            activeTab === 'list'
              ? 'bg-gradient-to-r from-[#1976d2] to-[#42a5f5] text-white shadow-[0_4px_12px_rgba(25,118,210,0.3)]'
              : 'bg-transparent text-slate-600 hover:bg-[#e3f2fd]/50 hover:text-[#1976d2]'
          }`}
        >
          <ListFilter className="w-5 h-5 shrink-0" />
          <span>ข้อมูลการสื่อสาร Enablers</span>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-normal ${
              activeTab === 'list'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {reportCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-[8px] text-sm sm:text-base font-medium transition-all ${
            activeTab === 'dashboard'
              ? 'bg-gradient-to-r from-[#1976d2] to-[#42a5f5] text-white shadow-[0_4px_12px_rgba(25,118,210,0.3)]'
              : 'bg-transparent text-slate-600 hover:bg-[#e3f2fd]/50 hover:text-[#1976d2]'
          }`}
        >
          <BarChart3 className="w-5 h-5 shrink-0" />
          <span>สรุปแดชบอร์ด</span>
        </button>
      </div>
    </div>
  );
};
