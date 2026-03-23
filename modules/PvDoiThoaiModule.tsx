
import React, { useState, useEffect, useRef } from 'react';
import * as service from '../services/pvDoiThoaiService';
import { ScriptParts } from '../types';
import ScriptSection from '../components/ScriptSection';
import ImageCard from '../components/ImageCard';

declare var JSZip: any;

const VOICE_OPTIONS = ["Giọng Bắc 20-40 tuổi", "Giọng Nam 20-40 tuổi", "Giọng Bắc 50-60 tuổi", "Giọng Nam 50-60 tuổi", "Giọng Bắc 60-80 tuổi", "Giọng Nam 60-80 tuổi"];
const ADDRESSING_OPTIONS = ["em - anh chị", "tui - mấy bà", "mình - mọi người", "con - cô chú", "con - ba mẹ", "cháu - ông bà", "tao - mày"];
const SCENE_COUNT_OPTIONS = Array.from({ length: 13 }, (_, i) => ({ count: i + 3, label: `${i + 3} cảnh - ${(i + 3) * 8}s` }));

const PvDoiThoaiModule: React.FC = () => {
  const storageKey = "pv_doithoai_v2_stable";
  const [state, setState] = useState<any>({
    charA: { facePreview: null, outfitPreview: null, gender: 'Nữ', voice: VOICE_OPTIONS[0], addressing: 'em - anh chị' },
    charB: { facePreview: null, outfitPreview: null, gender: 'Nam', voice: VOICE_OPTIONS[1], addressing: 'anh - em' },
    backgroundPreview: null,
    sceneCount: 5, backgroundNote: '', imageStyle: 'Realistic', userContent: '',
    isGenerating: false, script: null, images: {}, videoPrompts: {}, sceneChars: {}
  });

  const faceAInput = useRef<HTMLInputElement>(null);
  const faceBInput = useRef<HTMLInputElement>(null);
  const outfitAInput = useRef<HTMLInputElement>(null);
  const outfitBInput = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const localJsonRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        setState((prev: any) => ({ ...prev, ...p, isGenerating: false }));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  const processImportData = async (importedData: any) => {
    try {
      if (!Array.isArray(importedData) || importedData.length === 0) {
        throw new Error("Dữ liệu JSON không hợp lệ.");
      }
      
      window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { detail: { percent: 10, complete: false } }));

      const firstItem = importedData[0];
      const inputs = firstItem.inputs || {};
      const settings = inputs.settings || {};

      const newState = {
        ...state,
        userContent: inputs.userContent || '',
        backgroundNote: inputs.backgroundNote || '',
        sceneCount: importedData.length,
        imageStyle: settings.imageStyle || 'Realistic',
        charA: inputs.charA || state.charA,
        charB: inputs.charB || state.charB,
        backgroundPreview: inputs.backgroundPreview || null,
        script: {}, images: {}, videoPrompts: {}, sceneChars: {}
      };

      for (let i = 0; i < importedData.length; i++) {
        const item = importedData[i];
        const key = `v${i + 1}`;
        const itemInputs = item.inputs || {};
        const itemSettings = itemInputs.settings || {};

        newState.script[key] = item.script || '';
        newState.sceneChars[key] = itemInputs.sceneChar || (i % 2 === 0 ? 'A' : 'B');
        newState.images[key] = {
          url: item.outputImage || '',
          loading: false,
          pose: itemSettings.pose || '',
          angle: itemSettings.angle || '',
          customPrompt: itemSettings.customPrompt || ''
        };
        newState.videoPrompts[key] = { 
          text: item.videoPrompt || '', 
          loading: false, 
          visible: !!item.videoPrompt 
        };

        const percent = Math.round(((i + 1) / importedData.length) * 100);
        window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { detail: { percent, complete: i === importedData.length - 1 } }));
        await new Promise(r => setTimeout(r, 20));
      }
      setState(newState);
    } catch (e) {
      alert("Lỗi khi nạp dự án!");
    }
  };

  const handleLocalExportJson = () => {
    const keys = state.script ? Object.keys(state.script) : [];
    const exportData = keys.map((key, index) => ({
      stt: index + 1,
      inputs: {
        userContent: state.userContent,
        backgroundNote: state.backgroundNote,
        charA: state.charA,
        charB: state.charB,
        backgroundPreview: state.backgroundPreview,
        sceneChar: state.sceneChars[key],
        settings: {
          imageStyle: state.imageStyle,
          pose: state.images[key]?.pose || '',
          angle: state.images[key]?.angle || '',
          customPrompt: state.images[key]?.customPrompt || ''
        }
      },
      script: state.script[key],
      outputImage: state.images[key]?.url || '',
      videoPrompt: state.videoPrompts[key]?.text || ''
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PV_DoiThoai_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const handleGlobalExport = () => {
      const keys = state.script ? Object.keys(state.script) : [];
      const exportData = keys.map((key, index) => ({
        stt: index + 1,
        inputs: {
          userContent: state.userContent,
          backgroundNote: state.backgroundNote,
          charA: state.charA,
          charB: state.charB,
          backgroundPreview: state.backgroundPreview,
          sceneChar: state.sceneChars[key],
          settings: {
            imageStyle: state.imageStyle,
            pose: state.images[key]?.pose || '',
            angle: state.images[key]?.angle || '',
            customPrompt: state.images[key]?.customPrompt || ''
          }
        },
        script: state.script[key],
        outputImage: state.images[key]?.url || '',
        videoPrompt: state.videoPrompts[key]?.text || ''
      }));
      window.dispatchEvent(new CustomEvent('EXPORT_DATA_READY', { detail: { data: exportData, moduleName: 'PV_DoiThoai_Project' } }));
    };
    const handleGlobalImport = (e: any) => processImportData(e.detail);
    window.addEventListener('REQUEST_EXPORT_DATA', handleGlobalExport);
    window.addEventListener('REQUEST_IMPORT_DATA', handleGlobalImport);
    return () => {
      window.removeEventListener('REQUEST_EXPORT_DATA', handleGlobalExport);
      window.removeEventListener('REQUEST_IMPORT_DATA', handleGlobalImport);
    };
  }, [state]);

  const handleGenerateScript = async () => {
    if (!state.userContent.trim()) return alert("Vui lòng nhập ý tưởng kịch bản.");
    setState(p => ({ ...p, isGenerating: true }));
    try {
      const script = await service.generatePvDoiThoaiScript(state.sceneCount, state.charA, state.charB, state.userContent, state.backgroundNote);
      const sceneChars: any = {};
      const initialImages: any = {};
      const initialPrompts: any = {};
      Object.keys(script).forEach((k, i) => {
          sceneChars[k] = (i % 2 === 0) ? 'A' : 'B';
          initialImages[k] = { url: '', loading: false, pose: '', angle: '', customPrompt: '' };
          initialPrompts[k] = { text: '', loading: false, visible: false };
      });
      setState(p => ({ ...p, script, sceneChars, images: initialImages, videoPrompts: initialPrompts, isGenerating: false }));
    } catch (e) { setState(p => ({ ...p, isGenerating: false })); }
  };

  const handleGenImage = async (key: string) => {
    setState(p => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], loading: true } } }));
    try {
      const getB64Part = (url: string | null) => (url && url.startsWith('data:')) ? { mimeType: 'image/png', data: url.split(',')[1] } : null;
      const faceAPart = getB64Part(state.charA.facePreview);
      const faceBPart = getB64Part(state.charB.facePreview);
      const outfitAPart = getB64Part(state.charA.outfitPreview);
      const outfitBPart = getB64Part(state.charB.outfitPreview);
      const bgPart = getB64Part(state.backgroundPreview);
      
      const currentImg = state.images[key];
      const url = await service.generatePvDoiThoaiImage(
        faceAPart, faceBPart, outfitAPart, outfitBPart, state.script[key], 
        state.imageStyle, state.sceneChars[key], state.charA.gender, state.charB.gender, 
        currentImg.pose || '', currentImg.angle || '', currentImg.customPrompt || '', bgPart, state.backgroundNote
      );
      setState(p => ({ ...p, images: { ...p.images, [key]: { ...currentImg, url, loading: false } } }));
    } catch (e) { setState(p => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], loading: false, error: 'Lỗi' } } })); }
  };

  const handleGenVideoPrompt = async (key: string) => {
    setState(p => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { ...p.videoPrompts[key], loading: true, visible: true } } }));
    try {
      const charTag = state.sceneChars[key];
      const gender = charTag === 'B' ? state.charB.gender : state.charA.gender;
      const voice = charTag === 'B' ? state.charB.voice : state.charA.voice;
      const prompt = await service.generatePvDoiThoaiVeoPrompt(state.script[key], gender, voice, state.imageStyle, state.backgroundNote, state.images[key].url);
      setState(p => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { text: prompt, loading: false, visible: true } } }));
    } catch (e) { setState(p => ({ ...p, videoPrompts: { ...p.videoPrompts, [key]: { ...p.videoPrompts[key], loading: false } } })); }
  };

  const handleBulkAction = async (type: 'image' | 'prompt') => {
    if (!state.script) return;
    for (const key of Object.keys(state.script)) {
      if (type === 'image') await handleGenImage(key); else await handleGenVideoPrompt(key);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm mb-10">
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-8 border-b pb-4">PV Đối Thoại (Phóng Vấn)</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-4 bg-orange-50/30 p-6 rounded-2xl border border-orange-100">
            <h3 className="text-xs font-black text-orange-600 uppercase tracking-widest px-1">Nhân vật A (Người hỏi/Host)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div onClick={() => faceAInput.current?.click()} className="aspect-square border-2 border-dashed border-orange-200 rounded-xl flex items-center justify-center bg-white cursor-pointer overflow-hidden relative group">
                {state.charA.facePreview ? <img src={state.charA.facePreview} className="h-full object-cover w-full" /> : <span className="text-[9px] font-bold text-slate-400 text-center uppercase">Mặt A</span>}
                <input type="file" ref={faceAInput} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setState(p => ({ ...p, charA: { ...p.charA, facePreview: ev.target?.result as string } })); r.readAsDataURL(f); } }} />
              </div>
              <div onClick={() => outfitAInput.current?.click()} className="aspect-square border-2 border-dashed border-orange-200 rounded-xl flex items-center justify-center bg-white cursor-pointer overflow-hidden relative group">
                {state.charA.outfitPreview ? <img src={state.charA.outfitPreview} className="h-full object-cover w-full" /> : <span className="text-[9px] font-bold text-slate-400 text-center uppercase">Đồ A</span>}
                <input type="file" ref={outfitAInput} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setState(p => ({ ...p, charA: { ...p.charA, outfitPreview: ev.target?.result as string } })); r.readAsDataURL(f); } }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={state.charA.gender} onChange={e => setState(p => ({ ...p, charA: { ...p.charA, gender: e.target.value } }))} className="w-full p-3 bg-white border border-orange-100 rounded-xl font-bold text-xs"><option value="Nữ">Nữ</option><option value="Nam">Nam</option></select>
              <select value={state.charA.voice} onChange={e => setState(p => ({ ...p, charA: { ...p.charA, voice: e.target.value } }))} className="w-full p-3 bg-white border border-orange-100 rounded-xl font-bold text-[10px]">{VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}</select>
            </div>
            <input list="pv-addr-a" value={state.charA.addressing} onChange={e => setState(p => ({ ...p, charA: { ...p.charA, addressing: e.target.value } }))} className="w-full p-3 bg-white border border-orange-100 rounded-xl font-bold text-xs" placeholder="Xưng hô A" />
            <datalist id="pv-addr-a">{ADDRESSING_OPTIONS.map(o => <option key={o} value={o} />)}</datalist>
          </div>

          <div className="space-y-4 bg-blue-50/30 p-6 rounded-2xl border border-blue-100">
            <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest px-1">Nhân vật B (Khách mời)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div onClick={() => faceBInput.current?.click()} className="aspect-square border-2 border-dashed border-blue-200 rounded-xl flex items-center justify-center bg-white cursor-pointer overflow-hidden relative group">
                {state.charB.facePreview ? <img src={state.charB.facePreview} className="h-full object-cover w-full" /> : <span className="text-[9px] font-bold text-slate-400 text-center uppercase">Mặt B</span>}
                <input type="file" ref={faceBInput} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setState(p => ({ ...p, charB: { ...p.charB, facePreview: ev.target?.result as string } })); r.readAsDataURL(f); } }} />
              </div>
              <div onClick={() => outfitBInput.current?.click()} className="aspect-square border-2 border-dashed border-blue-200 rounded-xl flex items-center justify-center bg-white cursor-pointer overflow-hidden relative group">
                {state.charB.outfitPreview ? <img src={state.charB.outfitPreview} className="h-full object-cover w-full" /> : <span className="text-[9px] font-bold text-slate-400 text-center uppercase">Đồ B</span>}
                <input type="file" ref={outfitBInput} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setState(p => ({ ...p, charB: { ...p.charB, outfitPreview: ev.target?.result as string } })); r.readAsDataURL(f); } }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={state.charB.gender} onChange={e => setState(p => ({ ...p, charB: { ...p.charB, gender: e.target.value } }))} className="w-full p-3 bg-white border border-blue-100 rounded-xl font-bold text-xs"><option value="Nữ">Nữ</option><option value="Nam">Nam</option></select>
              <select value={state.charB.voice} onChange={e => setState(p => ({ ...p, charB: { ...p.charB, voice: e.target.value } }))} className="w-full p-3 bg-white border border-blue-100 rounded-xl font-bold text-[10px]">{VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}</select>
            </div>
            <input list="pv-addr-b" value={state.charB.addressing} onChange={e => setState(p => ({ ...p, charB: { ...p.charB, addressing: e.target.value } }))} className="w-full p-3 bg-white border border-blue-100 rounded-xl font-bold text-xs" placeholder="Xưng hô B" />
            <datalist id="pv-addr-b">{ADDRESSING_OPTIONS.map(o => <option key={o} value={o} />)}</datalist>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Chủ đề & Bối cảnh</h3>
            <div onClick={() => bgInputRef.current?.click()} className="h-28 border-2 border-dashed border-indigo-200 rounded-xl flex items-center justify-center bg-indigo-50/30 cursor-pointer overflow-hidden relative group">
                {state.backgroundPreview ? <img src={state.backgroundPreview} className="h-full object-cover w-full" /> : <span className="text-[9px] font-bold text-indigo-400 uppercase">Bối cảnh chung</span>}
                <input type="file" ref={bgInputRef} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setState(p => ({ ...p, backgroundPreview: ev.target?.result as string })); r.readAsDataURL(f); } }} />
            </div>
            <textarea value={state.userContent} onChange={e => setState(p => ({ ...p, userContent: e.target.value }))} placeholder="Ý tưởng hội thoại..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl h-28 text-sm font-bold focus:ring-2 focus:ring-orange-100 outline-none" />
            <div className="grid grid-cols-2 gap-2">
                <select value={state.sceneCount} onChange={e => setState(p => ({ ...p, sceneCount: parseInt(e.target.value) }))} className="w-full p-3 border border-slate-200 rounded-xl font-bold text-xs">{SCENE_COUNT_OPTIONS.map(o => <option key={o.count} value={o.count}>{o.label}</option>)}</select>
                <div className="flex bg-slate-100 p-1 rounded-xl border"><button onClick={() => setState(p => ({...p, imageStyle: 'Realistic'}))} className={`flex-1 text-[9px] font-black rounded-lg ${state.imageStyle === 'Realistic' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>Real</button><button onClick={() => setState(p => ({...p, imageStyle: '3D'}))} className={`flex-1 text-[9px] font-black rounded-lg ${state.imageStyle === '3D' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>3D</button></div>
            </div>
            <button onClick={handleGenerateScript} disabled={state.isGenerating} className="w-full py-4 bg-orange-600 text-white font-black rounded-xl shadow-lg uppercase text-xs hover:bg-orange-700 active:scale-95 disabled:opacity-50">{state.isGenerating ? "Đang tạo..." : "TẠO KỊCH BẢN PV"}</button>
          </div>
        </div>
      </div>

      {state.script && (
        <div className="space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {Object.keys(state.script).map((key, idx) => {
              const char = state.sceneChars[key];
              return (
                <div key={key} className="space-y-4 animate-fadeIn">
                  <div className={`p-2 rounded-xl text-[9px] font-black uppercase text-center border-b-2 ${char === 'A' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>Mẫu {char} nói</div>
                  <ScriptSection title={`Cảnh ${idx + 1}`} content={state.script[key]} color={char === 'A' ? 'border-orange-500' : 'border-blue-500'} onChange={v => setState(p => ({ ...p, script: { ...p.script, [key]: v } }))} maxChars={180} />
                  <div className="flex bg-slate-100 p-1 rounded-xl"><button onClick={() => setState(p => ({ ...p, sceneChars: { ...p.sceneChars, [key]: 'A' } }))} className={`flex-1 py-1.5 text-[9px] font-black rounded-lg ${char === 'A' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>Mẫu A</button><button onClick={() => setState(p => ({ ...p, sceneChars: { ...p.sceneChars, [key]: 'B' } }))} className={`flex-1 py-1.5 text-[9px] font-black rounded-lg ${char === 'B' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>Mẫu B</button></div>
                  <ImageCard 
                    label={`Cảnh ${idx+1}`} 
                    imageData={state.images[key]} 
                    videoPrompt={state.videoPrompts[key]} 
                    onRegenerate={() => handleGenImage(key)} 
                    onGeneratePrompt={() => handleGenVideoPrompt(key)} 
                    onTranslate={() => {}} 
                    onUpload={(file) => {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setState(p => ({
                          ...p,
                          images: {
                            ...p.images,
                            [key]: { ...p.images[key], url: ev.target?.result as string, loading: false }
                          }
                        }));
                      };
                      reader.readAsDataURL(file);
                    }}
                    onDelete={() => setState(p => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], url: '', loading: false } } }))}
                    pose={state.images[key].pose} 
                    onPoseChange={v => setState(p => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], pose: v } } }))} 
                    angle={state.images[key].angle} 
                    onAngleChange={v => setState(p => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], angle: v } } }))} 
                    customPrompt={state.images[key].customPrompt} 
                    onCustomPromptChange={v => setState(p => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], customPrompt: v } } }))} 
                  />
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-10 py-12 border-t border-slate-200">
            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              <button onClick={() => handleBulkAction('image')} className="w-full md:w-auto px-10 py-4 bg-orange-600 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-xs uppercase">Vẽ tất cả ảnh</button>
              <button onClick={() => handleBulkAction('prompt')} className="w-full md:w-auto px-10 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-xs uppercase">Tạo tất cả prompt</button>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-4">
               <button onClick={() => localJsonRef.current?.click()} className="w-full md:w-auto px-10 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl border border-slate-200 hover:bg-slate-200 transition-all flex items-center justify-center gap-3 uppercase text-[11px] tracking-widest shadow-sm">Tải Dự Án (JSON)</button>
               <input type="file" ref={localJsonRef} onChange={e => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (event) => processImportData(JSON.parse(event.target?.result as string)); reader.readAsText(file); } e.target.value = ""; }} className="hidden" accept="application/json" />
               <button onClick={handleLocalExportJson} className="w-full md:w-auto px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 uppercase text-[11px] tracking-widest shadow-lg">Lưu Dự Án (JSON)</button>
            </div>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                <button onClick={async () => { if (typeof JSZip === 'undefined') return alert("ZIP error"); const zip = new JSZip(); let count = 0; Object.keys(state.images).forEach((k, i) => { if (state.images[k].url) { zip.file(`${String(i + 1).padStart(2, '0')}.png`, state.images[k].url.split(',')[1], { base64: true }); count++; } }); if (count === 0) return alert("Không có ảnh"); const content = await zip.generateAsync({ type: "blob" }); const link = document.createElement('a'); link.href = URL.createObjectURL(content); link.download = `pv_images.zip`; link.click(); }} className="w-full md:w-auto px-12 py-5 bg-slate-900 text-white font-black rounded-3xl shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-base">Tải bộ ảnh (ZIP)</button>
                <button onClick={() => { const text = Object.keys(state.videoPrompts).map(k => state.videoPrompts[k].text).filter(t => t).join('\n'); const blob = new Blob([text], { type: 'text/plain' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'prompts.txt'; link.click(); }} className="w-full md:w-auto px-12 py-5 bg-orange-600 text-white font-black rounded-3xl shadow-xl hover:bg-orange-700 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-base">Tải Prompt (TXT)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PvDoiThoaiModule;
