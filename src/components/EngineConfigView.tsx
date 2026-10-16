import React, { useState } from 'react';
import {
  ShieldAlert,
  Server,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Code,
  Link,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  getEnablersGasApiUrl,
  setEnablersGasApiUrl,
  isGasEndpointConfigured
} from '../config/enablersConfig';
import enablersApiService from '../services/enablersApiService';
import { FISCAL_YEAR_TARGET } from '../utils/fiscalYear';

export const EngineConfigView: React.FC = () => {
  const [gasUrlInput, setGasUrlInput] = useState(getEnablersGasApiUrl());
  const [isSaved, setIsSaved] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    isMock: boolean;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setEnablersGasApiUrl(gasUrlInput);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await enablersApiService.testConnection(gasUrlInput);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'ไม่สามารถทดสอบการเชื่อมต่อได้',
        isMock: false
      });
    } finally {
      setIsTesting(false);
    }
  };

  const copyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const sampleGasCode = `/**
 * Google Apps Script (GAS) สำหรับ MWA Enablers Report 2570
 * 
 * ข้อตกลงสำคัญ:
 * 1. ใช้สำหรับโปรเจกต์ Enablers Report 2570 เท่านั้น
 * 2. ห้ามใช้ร่วมกับ Google Sheet หรือโค้ดของ Improvement Report
 */

const SHEET_NAME_REPORTS = "Enablers_Reports_2570";

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    let response = { success: false };

    if (action === "create") {
      response = handleCreateReport(postData.payload);
    } else if (action === "getData") {
      response = handleGetData(postData.filters);
    } else if (action === "getById") {
      response = handleGetById(postData.id);
    } else if (action === "delete") {
      response = handleDelete(postData.id);
    } else if (action === "verify") {
      response = handleVerify(postData.id, postData.verification);
    } else if (action === "ping") {
      response = { success: true, message: "Enablers 2570 GAS Online", timestamp: new Date() };
    }

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Strict Isolation Notice Box */}
      <div className="bg-gradient-to-r from-blue-900 to-[#003B71] text-white p-6 rounded-2xl shadow-sm border border-blue-400/30 space-y-3">
        <div className="flex items-center gap-2 text-cyan-300 font-semibold text-xs tracking-wider uppercase">
          <ShieldAlert className="w-4 h-4" />
          <span>กฎเหล็กการแยกโปรเจกต์ (Strict Project Isolation)</span>
        </div>
        <h2 className="text-xl font-bold text-white">
          MWA Enablers Report 2570 Engine Layer
        </h2>
        <p className="text-xs text-blue-100 leading-relaxed">
          โปรเจกต์นี้แยกขาดออกจาก <strong>MWA Improvement Report</strong> 100% 
          ห้ามเรียกใช้ Google Sheet, Google Drive, Database, Supabase หรือ API endpoint ของ Improvement Report เดิมโดยเด็ดขาด 
          โครงสร้างนี้พร้อมสำหรับการเชื่อมต่อกับ Google Apps Script ชุดใหม่ที่สร้างขึ้นสำหรับ Enablers 2570 โดยเฉพาะ
        </p>
      </div>

      {/* GAS URL Configuration Box */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-[#003B71]" />
            <h3 className="font-bold text-slate-800 text-base">
              การกำหนดค่า Google Apps Script Web App Endpoint
            </h3>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            isGasEndpointConfigured(gasUrlInput)
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
              : 'bg-amber-50 text-amber-700 border border-amber-300'
          }`}>
            {isGasEndpointConfigured(gasUrlInput) ? 'กำหนด URL แล้ว' : 'ใช้ Enablers Standalone Engine'}
          </span>
        </div>

        <form onSubmit={handleSaveUrl} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ตัวแปรการตั้งค่า: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-700 font-mono text-xs">ENABLERS_GAS_API_URL</code>
            </label>
            <div className="relative">
              <Link className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="https://script.google.com/macros/s/AKfycb.../exec (ปล่อยว่างเพื่อใช้ Standalone Mode)"
                value={gasUrlInput}
                onChange={e => setGasUrlInput(e.target.value)}
                className="w-full text-xs font-mono rounded-lg border border-slate-300 pl-9 pr-3.5 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              * เมื่อสร้าง Google Apps Script สำหรับ Enablers 2570 เสร็จแล้ว ให้นำ URL ที่ได้จาก Deploy as Web App มาใส่ในช่องนี้ หรือใส่ในไฟล์ <code className="font-mono text-slate-700">.env</code>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="text-xs px-4 py-2 bg-[#003B71] text-white rounded-lg hover:bg-[#002b52] font-semibold transition shadow-xs"
              >
                บันทึกการตั้งค่า URL
              </button>

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="text-xs px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5"
              >
                {isTesting ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อ (Test Connection)'}
              </button>
            </div>

            {isSaved && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> บันทึกการตั้งค่าแล้ว
              </span>
            )}
          </div>
        </form>

        {/* Test Result Display */}
        {testResult && (
          <div className={`p-4 rounded-xl text-xs border ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}>
            <div className="flex items-start gap-2.5">
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-bold block">
                  {testResult.success ? 'สถานะการเชื่อมต่อ: พร้อมใช้งาน' : 'สถานะการเชื่อมต่อ: มีข้อผิดพลาด'}
                </span>
                <p className="mt-0.5">{testResult.message}</p>
                {testResult.isMock && (
                  <p className="mt-1 text-[11px] text-slate-600">
                    💡 โหมด Standalone จำลองฐานข้อมูลในเครื่องเพื่อให้ทดสอบหน้าแบบฟอร์ม ตารางรายงาน และการรับรองได้ทันที
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* API Payload Specifications */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-[#003B71]" />
            <h3 className="font-bold text-slate-800 text-base">
              สเปคการสื่อสาร API (Contract for Enablers 2570 GAS)
            </h3>
          </div>
          <span className="text-xs text-slate-500">Method: POST (JSON)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-[#003B71] block">1. Action: create</span>
            <p className="text-slate-600 text-[11px]">
              ส่งบันทึกรายงาน Enablers ฉบับใหม่ พร้อมสร้าง ID รูปแบบ <code className="font-mono text-blue-700">ENB-2570-xxxxxxxx</code>
            </p>
            <pre className="bg-slate-900 text-slate-100 p-2.5 rounded-lg text-[11px] font-mono overflow-x-auto">
{`{
  "action": "create",
  "payload": {
    "id": "ENB-2570-xxxxxxxx",
    "recorder_name": "...",
    "recorder_dept": "...",
    "fiscal_quarter": "Q1",
    "communication_details_text": [...],
    "evidence_links": [...]
  }
}`}
            </pre>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-[#003B71] block">2. Action: getData</span>
            <p className="text-slate-600 text-[11px]">
              ค้นหาและดึงรายการรายงานตามไตรมาสปีงบประมาณ 2570 หรือฝ่ายสังกัด
            </p>
            <pre className="bg-slate-900 text-slate-100 p-2.5 rounded-lg text-[11px] font-mono overflow-x-auto">
{`{
  "action": "getData",
  "filters": {
    "fiscal_quarter": "Q1",
    "recorder_dept": "...",
    "status": "all"
  }
}`}
            </pre>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-[#003B71] block">3. Action: verify</span>
            <p className="text-slate-600 text-[11px]">
              ปรับสถานะการรับรองความถูกต้องของรายงานโดยผู้ตรวจ
            </p>
            <pre className="bg-slate-900 text-slate-100 p-2.5 rounded-lg text-[11px] font-mono overflow-x-auto">
{`{
  "action": "verify",
  "id": "ENB-2570-xxxxxxxx",
  "verification": {
    "status": "verified",
    "verified_by": "...",
    "verification_notes": "..."
  }
}`}
            </pre>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-[#003B71] block">4. Action: delete & getById</span>
            <p className="text-slate-600 text-[11px]">
              ลบรายงาน หรือดึงรายละเอียดรายงานฉบับเดี่ยว
            </p>
            <pre className="bg-slate-900 text-slate-100 p-2.5 rounded-lg text-[11px] font-mono overflow-x-auto">
{`{
  "action": "delete",
  "id": "ENB-2570-xxxxxxxx"
}

{
  "action": "getById",
  "id": "ENB-2570-xxxxxxxx"
}`}
            </pre>
          </div>
        </div>
      </div>

      {/* GAS Template Code Preview */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-800 text-base">
              โครงสร้าง Google Apps Script Template สำหรับ Enablers 2570
            </h3>
            <p className="text-xs text-slate-500">
              นำโค้ดนี้ไปใส่ใน Google Apps Script โปรเจกต์ใหม่ของ Enablers Report 2570 เมื่อพร้อมเชื่อมต่อ
            </p>
          </div>

          <button
            onClick={() => copyCode(sampleGasCode, 'gasCode')}
            className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5"
          >
            {copiedSection === 'gasCode' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSection === 'gasCode' ? 'คัดลอกแล้ว' : 'คัดลอกโค้ด GAS'}</span>
          </button>
        </div>

        <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-72">
          {sampleGasCode}
        </pre>
      </div>
    </div>
  );
};
