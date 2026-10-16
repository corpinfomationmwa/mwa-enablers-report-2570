/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * MWA Enablers Report 2570
 * การประปานครหลวง (กปน.)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { ReportForm } from './components/ReportForm';
import { ReportList } from './components/ReportList';
import { ReportDetailModal } from './components/ReportDetailModal';
import { DashboardView } from './components/DashboardView';
import { EnablersReport, FiscalQuarter, VerifyReportPayload } from './types/enablers';
import enablersApiService from './services/enablersApiService';
import { FISCAL_YEAR_TARGET } from './utils/fiscalYear';

export default function App() {
  const [activeTab, setActiveTab] = useState<'form' | 'list' | 'dashboard'>('form');
  const [reports, setReports] = useState<EnablersReport[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedReport, setSelectedReport] = useState<EnablersReport | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // โหลดรายการข้อมูลรายงาน
  const loadReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await enablersApiService.getData();
      if (res.success && res.data) {
        setReports(res.data);
      } else if (!res.success && res.error) {
        console.warn('Supabase getData info:', res.error);
      }
    } catch (err: any) {
      console.warn('Failed to load reports:', err?.message || err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Handler เมื่อบันทึกรายงานใหม่สำเร็จ
  const handleFormSuccess = (newReport: EnablersReport) => {
    setReports(prev => [newReport, ...prev]);
    showToast(`บันทึกรายงานรหัส ${newReport.id} เรียบร้อยแล้ว`);
  };

  // Handler เมื่อรับรองรายงาน (Verify)
  const handleVerifyReport = async (id: string, payload: VerifyReportPayload) => {
    const res = await enablersApiService.verify(id, payload);
    if (res.success && res.data) {
      setReports(prev => prev.map(r => (r.id === id ? res.data! : r)));
      if (selectedReport && selectedReport.id === id) {
        setSelectedReport(res.data);
      }
      showToast(res.message || `ปรับสถานะรายงาน ${id} เรียบร้อยแล้ว`);
    } else {
      showToast(res.error || `ไม่สามารถปรับสถานะรายงาน ${id} ได้`);
    }
  };

  // Handler เมื่อลบรายงาน (Delete)
  const handleDeleteReport = async (id: string, adminPasscode?: string) => {
    const res = await enablersApiService.delete(id, adminPasscode);
    if (res.success) {
      setReports(prev => prev.filter(r => r.id !== id));
      if (selectedReport && selectedReport.id === id) {
        setSelectedReport(null);
      }
      showToast(res.message || `ลบรายงาน ${id} เรียบร้อยแล้ว`);
    } else {
      showToast(res.error || `ไม่สามารถลบรายงาน ${id} ได้`);
    }
  };

  // Quick navigation to quarter filter
  const handleQuarterClickFromDashboard = (_q: FiscalQuarter) => {
    setActiveTab('list');
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#e3f2fd_0%,#ffffff_100%)] text-slate-800 font-['Mitr',sans-serif] flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1976d2] text-white text-sm px-5 py-3 rounded-[8px] shadow-[0_6px_20px_rgba(25,118,210,0.35)] flex items-center gap-2 animate-bounce">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container - Centered, max-width 1200px, padding 20px */}
      <div className="w-full max-w-[1200px] mx-auto p-[20px] flex-1 flex flex-col">
        {/* Header and 3 Tabs */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          reportCount={reports.length}
        />

        {/* Tab Content Area */}
        <main className="mt-6 flex-1">
          {activeTab === 'form' && (
            <ReportForm
              onSuccess={handleFormSuccess}
            />
          )}

          {activeTab === 'list' && (
            <ReportList
              reports={reports}
              isLoading={isLoading}
              onRefresh={loadReports}
              onSelectReport={report => setSelectedReport(report)}
              onOpenNewForm={() => setActiveTab('form')}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              reports={reports}
              onFilterQuarter={handleQuarterClickFromDashboard}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="mt-12 mb-4 text-center text-xs text-slate-500 space-y-1">
          <p>
            ระบบรายงานแผนสื่อสารภายในและภายนอกองค์กร ประจำปีงบประมาณ {FISCAL_YEAR_TARGET}
          </p>
          <p className="text-[11px] text-slate-400">
            การประปานครหลวง (กปน.) • Enablers Report 2570
          </p>
        </footer>
      </div>

      {/* Detail / Verification Modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onVerify={handleVerifyReport}
          onDelete={handleDeleteReport}
        />
      )}
    </div>
  );
}
