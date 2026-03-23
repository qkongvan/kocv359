import React, { useState, useRef, useEffect } from 'react';
import * as service from '../services/fashionTrackingService';
import { copyToClipboard } from '../utils/clipboard';

declare var JSZip: any;

export const SPY_ANGLES = [
  { value: "", label: "-- Tự động chọn góc máy --" },
  { value: "Side profile view from a distance (Góc nghiêng hoàn toàn từ xa)", label: "1. Nghiêng từ xa" },
  { value: "Three-quarter view from behind (Góc 3/4 nhìn từ phía sau lưng)", label: "2. 3/4 từ sau lưng" },
  { value: "High angle looking down from an elevated position (Góc từ trên cao nhìn xuống như camera giám sát)", label: "3. Từ trên cao xuống (CCTV)" },
  { value: "Hidden camera style, shot through some gaps or obstacles (Góc chụp lén xuyên qua khe hở)", label: "4. Chụp lén qua khe hở" },
  { value: "Low angle side view as if taken from a sitting position (Góc thấp nhìn từ dưới lên phía bên cạnh)", label: "5. Góc thấp bên cạnh" },
  { value: "Over-the-shoulder view from another person's perspective (Góc nhìn qua vai của một người khác)", label: "6. Nhìn qua vai người khác" },
  { value: "Reflected view through a glass window with urban reflections (Góc phản chiếu qua kính cửa hàng)", label: "7. Phản chiếu qua kính" },
  { value: "Extreme long shot tracking the subject in a busy urban crowd (Góc xa bám sát giữa đám đông phố thị)", label: "8. Cực xa giữa đám đông" },
  { value: "Low ground-level tracking shot of footsteps and shoes (Góc sát mặt đất bám sát bước chân đi bộ)", label: "9. Sát đất bám bước chân" },
  { value: "High-angle bird's eye view from directly above (Góc thẳng đứng từ trên đỉnh đầu nhìn xuống)", label: "10. Thẳng đứng từ trên cao" },
  { value: "Handheld shaky cam aesthetic, following subject from a close distance behind (Góc cầm tay bám đuôi sát sau lưng)", label: "11. Cầm tay bám đuôi sát" },
  { value: "Peeking from behind a building corner or a large pillar (Góc quay nấp sau góc tường hoặc cột lớn)", label: "12. Nấp sau góc tường" }
];

interface FashionSlot {
  id: number;
  inputFile: File | null;
  inputPreview: string | null;
  outputUrl: string;
  loading: boolean;
  videoPrompt: string;
  isPromptLoading: boolean;
  regenNote: string;
  angle: string;
}

const FashionTrackingModule: React.FC = () => {
  const storageKey = "fashion_tracking_v8_no_scenario";
  const [backgroundNote, setBackgroundNote] = useState('');
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [slots, setSlots] = useState<FashionSlot[]>(
    Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      inputFile: null,
      inputPreview: null,
      outputUrl: '',
      loading: false,
      videoPrompt: '',
      isPromptLoading: false,
      regenNote: '',
      angle: ''
    }))
  );
  const [copyStatus, setCopyStatus] = useState<{[key: string]: boolean}>({});

  const handleCopy = async (text: string, id: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopyStatus(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopyStatus(prev => ({ ...prev, [id]: false }));
      }, 2000);
    }
  };

  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const localJsonRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setBackgroundNote(parsed.backgroundNote || '');
        setFacePreview(parsed.facePreview || null);
        if (parsed.slots && Array.isArray(parsed.slots)) {
          setSlots(prev => prev.map((s, i) => ({
            ...s,
            ...(parsed.slots[i] || {}),
            inputFile: null,
            loading: false,
            isPromptLoading: false
          })));
        }
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const toSave = {
      backgroundNote,
      facePreview: facePreview?.startsWith('data:') ? facePreview : '',
      slots: slots.map(s => ({
        id: s.id,
        inputPreview: s.inputPreview || '',
        outputUrl: s.outputUrl || '',
        videoPrompt: s.videoPrompt || '',
        regenNote: s.regenNote || '',
        angle: s.angle || ''
      }))
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(toSave));
    } catch (e) {}
  }, [slots, backgroundNote, facePreview]);

  const processImportData = async (importedData: any) => {
    if (!Array.isArray(importedData)) return;
    window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { detail: { percent: 10, complete: false } }));
    
    try {
      const firstItem = importedData[0] || {};
      const inputs = firstItem.inputs || {};
      setBackgroundNote(inputs.backgroundNote || '');
      setFacePreview(inputs.faceImage || null);

      const newSlots = Array.from({ length: 6 }, (_, i) => ({
        id: i + 1,
        inputFile: null,
        inputPreview: null,
        outputUrl: '',
        loading: false,
        videoPrompt: '',
        isPromptLoading: false,
        regenNote: '',
        angle: ''
      }));

      const total = Math.min(importedData.length, 6);
      for (let i = 0; i < total; i++) {
        const item = importedData[i];
        const itemInputs = item.inputs || {};
        const itemSettings = itemInputs.settings || {};
        newSlots[i] = {
          ...newSlots[i],
          inputPreview: itemInputs.inputImage || item.inputPreview || null,
          outputUrl: item.outputImage || item.outputUrl || '',
          videoPrompt: item.videoPrompt || '',
          regenNote: itemInputs.regenNote || '',
          angle: itemSettings.angle || ''
        };
        const percent = Math.round(((i + 1) / total) * 100);
        window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { detail: { percent, complete: i === total - 1 } }));
        await new Promise(r => setTimeout(r, 50));
      }
      setSlots(newSlots);
    } catch (error) {
      alert("Lỗi khi nạp dữ liệu JSON!");
    }
  };

  const constructExportData = () => {
    return slots.map((s, i) => ({
      stt: i + 1,
      inputs: {
        inputImage: s.inputPreview || '',
        faceImage: facePreview || '',
        backgroundNote: backgroundNote,
        regenNote: s.regenNote,
        settings: { angle: s.angle }
      },
      script: backgroundNote,
      outputImage: s.outputUrl || '',
      videoPrompt: s.videoPrompt
    }));
  };

  useEffect(() => {
    const handleGlobalExport = () => {
      const data = constructExportData();
      window.dispatchEvent(new CustomEvent('EXPORT_DATA_READY', { detail: { data, moduleName: 'Fashion_Tracking' } }));
    };
    const handleGlobalImport = (e: any) => processImportData(e.detail);
    window.addEventListener('REQUEST_EXPORT_DATA', handleGlobalExport);
    window.addEventListener('REQUEST_IMPORT_DATA', handleGlobalImport);
    return () => {
      window.removeEventListener('REQUEST_EXPORT_DATA', handleGlobalExport);
      window.removeEventListener('REQUEST_IMPORT_DATA', handleGlobalImport);
    };
  }, [slots, backgroundNote, facePreview]);

  const downloadAllPromptsTxt = () => {
    const text = slots
      .map(s => s.videoPrompt || "")
      .filter(t => t.trim().length > 0)
      .map(t => t.replace(/\n/g, ' '))
      .join('\n');

    if (!text) return alert("Vui lòng tạo Video Prompt trước khi tải xuống.");

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prompts_fashion_tracking_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const updateSlot = (id: number, updates: Partial<FashionSlot>) => {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleFileUpload = (id: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      updateSlot(id, { inputFile: file, inputPreview: e.target?.result as string, outputUrl: '', videoPrompt: '' });
    };
    reader.readAsDataURL(file);
  };

  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setFacePreview(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateImage = async (id: number) => {
    const slot = slots.find(s => s.id === id);
    if (!slot?.inputPreview) return;

    updateSlot(id, { loading: true, outputUrl: '' });
    try {
      const getPart = (url: string) => ({
        mimeType: 'image/png',
        data: url.split(',')[1]
      });

      const outfitPart = getPart(slot.inputPreview);
      const facePart = facePreview ? getPart(facePreview) : null;

      const url = await service.generateFashionTrackingImage(
        outfitPart, 
        id - 1, 
        backgroundNote, 
        slot.regenNote,
        facePart,
        "", // scenarioPart để trống vì đã xóa UI
        slot.angle
      );
      updateSlot(id, { outputUrl: url, loading: false });
    } catch (error) {
      updateSlot(id, { loading: false });
    }
  };

  const handleGeneratePrompt = async (id: number) => {
    const slot = slots.find(s => s.id === id);
    if (!slot?.outputUrl) return;

    updateSlot(id, { isPromptLoading: true });
    try {
      const prompt = await service.generateFashionTrackingVideoPrompt(slot.outputUrl, backgroundNote, "");
      updateSlot(id, { videoPrompt: prompt, isPromptLoading: false });
    } catch (e) {
      updateSlot(id, { isPromptLoading: false });
    }
  };

  const handleBulkImage = async () => {
    for (const slot of slots) {
      if (slot.inputPreview && !slot.outputUrl) await handleGenerateImage(slot.id);
    }
  };

  const handleBulkPrompt = async () => {
    for (const slot of slots) {
      if (slot.outputUrl && !slot.videoPrompt) await handleGeneratePrompt(slot.id);
    }
  };

  const downloadAllImagesZip = async () => {
    if (typeof JSZip === 'undefined') return alert("Thư viện ZIP chưa sẵn sàng.");
    const zip = new JSZip();
    let count = 0;
    slots.forEach((s, i) => {
      if (s.outputUrl) {
        zip.file(`${String(i + 1).padStart(2, '0')}.png`, s.outputUrl.split(',')[1], { base64: true });
        count++;
      }
    });
    if (count === 0) return alert("Chưa có ảnh nào.");
    const content = (await zip.generateAsync({ type: "blob" })) as any;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `fashion_tracking_${Date.now()}.zip`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Section giới thiệu module */}
      <div className="bg-orange-50 border-l-4 border-orange-500 p-5 mb-8 rounded-r-2xl shadow-sm animate-fadeIn">
        <div className="flex items-start gap-4">
          <div className="mt-1 flex-shrink-0 bg-orange-100 p-2 rounded-full">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-orange-900 leading-relaxed">
            Tạo video thời trang - nhân vật đang di chuyển tự nhiên trong bối cảnh (có thể đang đi làm hoặc dạo phố)
            <br />Lưu ý: Nếu không thêm ảnh mặt mẫu AI sẽ tự tham chiếu từ ảnh trang phục. Ở dưới hình ảnh tạo ra có chỗ để mô tả chi tiết lại cho việc sửa ảnh.
            <br />Sau khi tạo hình ảnh {"=>"} Tạo Prompt Video {"=>"} Download sang Veo 3 để tạo Video. 
            </p>
          </div>
        </div>
      </div>

      {/* 1. THIẾT LẬP CHIẾN DỊCH */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-6 mb-10">
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">1. THIẾT LẬP CHIẾN DỊCH</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Gương mặt cố định • Candid Tracking</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => localJsonRef.current?.click()} className="px-4 py-2 bg-slate-100 text-slate-600 text-[10px] font-black rounded-xl hover:bg-slate-200 transition-all uppercase border border-slate-200">Tải Dự Án</button>
              <input type="file" ref={localJsonRef} className="hidden" accept="application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => processImportData(JSON.parse(ev.target?.result as string)); r.readAsText(f); } e.target.value = ""; }} />
              <button onClick={handleBulkImage} disabled={!slots.some(s => s.inputPreview)} className="px-5 py-2 bg-indigo-600 text-white text-[10px] font-black rounded-xl hover:bg-indigo-700 transition-all uppercase shadow-lg shadow-indigo-100">🚀 Bắt đầu tạo ảnh</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Ảnh mặt mẫu */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-[10px] font-black text-indigo-600 uppercase px-1">Mặt mẫu:</label>
              <div 
                onClick={() => faceInputRef.current?.click()}
                className={`h-24 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden relative cursor-pointer ${facePreview ? 'border-indigo-500 bg-white' : 'border-slate-300 bg-slate-50'}`}
              >
                {facePreview ? (
                  <>
                    <img src={facePreview} className="w-full h-full object-cover" />
                    <button onClick={(e) => { e.stopPropagation(); setFacePreview(null); }} className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </>
                ) : (
                  <div className="text-center opacity-30">
                    <svg className="w-5 h-5 mx-auto mb-1 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <span className="text-[8px] font-black uppercase">Tải mặt</span>
                  </div>
                )}
                <input type="file" ref={faceInputRef} onChange={handleFaceUpload} className="hidden" accept="image/*" />
              </div>
            </div>

            {/* Bối cảnh */}
            <div className="md:col-span-10 space-y-1.5">
              <label className="block text-[10px] font-black text-indigo-600 uppercase px-1">Mô tả bối cảnh chung:</label>
              <textarea 
                value={backgroundNote}
                onChange={e => setBackgroundNote(e.target.value)}
                placeholder="VD: Trong trung tâm thương mại cao cấp, sân bay hiện đại, hoặc đường phố Tokyo..."
                className="w-full h-24 p-3 bg-indigo-50/30 border border-indigo-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-100 outline-none resize-none shadow-inner transition-all leading-relaxed"
              />
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">2. DANH SÁCH TRANG PHỤC (OUTFITS):</label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {slots.map((slot, idx) => (
                <div key={slot.id} className="space-y-2">
                  <div 
                    onClick={() => fileInputRefs.current[idx]?.click()}
                    className={`aspect-[3/4] rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden relative cursor-pointer ${slot.inputPreview ? 'border-indigo-500 bg-white' : 'border-slate-200 bg-slate-50'}`}
                  >
                    {slot.inputPreview ? (
                      <img src={slot.inputPreview} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-2 opacity-30">
                        <svg className="w-5 h-5 mx-auto mb-1 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                        <span className="text-[8px] font-black uppercase tracking-tighter">BỘ {slot.id}</span>
                      </div>
                    )}
                    <input type="file" ref={el => { fileInputRefs.current[idx] = el; }} onChange={(e) => e.target.files?.[0] && handleFileUpload(slot.id, e.target.files[0])} className="hidden" accept="image/*" />
                  </div>
                  {slot.inputPreview && (
                    <button onClick={() => updateSlot(slot.id, { inputFile: null, inputPreview: null, outputUrl: '', videoPrompt: '' })} className="w-full py-1 text-slate-300 hover:text-red-500 transition-colors flex justify-center"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. KẾT QUẢ HÌNH ẢNH */}
      <div className="space-y-8 pb-32">
        <div className="bg-slate-900 rounded-[2rem] p-6 border border-slate-800 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col text-center md:text-left">
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">2. KẾT QUẢ HÌNH ẢNH (9:16)</h2>
            <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest">Candid Paparazzi Tracking</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
             <button onClick={handleBulkImage} className="px-5 py-2.5 bg-orange-600 text-white text-[10px] font-black rounded-xl hover:bg-orange-700 transition-all uppercase tracking-widest active:scale-95">🎨 Tự động vẽ ảnh</button>
             <button onClick={handleBulkPrompt} className="px-5 py-2.5 bg-blue-600 text-white text-[10px] font-black rounded-xl hover:bg-blue-700 transition-all uppercase tracking-widest active:scale-95">✨ Viết Prompt Video</button>
             <button onClick={downloadAllImagesZip} className="px-5 py-2.5 bg-white text-slate-900 text-[10px] font-black rounded-xl hover:bg-slate-100 transition-all uppercase tracking-widest active:scale-95">📦 Tải ZIP Ảnh</button>
             <button onClick={downloadAllPromptsTxt} className="px-5 py-2.5 bg-indigo-600 text-white text-[10px] font-black rounded-xl hover:bg-indigo-700 transition-all uppercase tracking-widest active:scale-95">📄 Tải Prompt (.txt)</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {slots.map((slot) => (
            <div key={slot.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full group hover:shadow-xl transition-all duration-500 min-h-[400px]">
              <div className="relative aspect-[9/16] bg-slate-50 overflow-hidden">
                {slot.outputUrl ? (
                  <>
                    <img src={slot.outputUrl} className="w-full h-full object-cover animate-fadeIn" />
                    <button onClick={() => updateSlot(slot.id, { outputUrl: '', videoPrompt: '' })} className="absolute top-4 right-4 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-all active:scale-90"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </>
                ) : slot.loading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 backdrop-blur-[1px]">
                    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="mt-4 text-[9px] font-black text-indigo-600 uppercase tracking-widest animate-pulse">Đang vẽ...</span>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center opacity-20">
                     <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                     <span className="text-[10px] font-black uppercase">Đợi tín hiệu</span>
                  </div>
                )}
                <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md text-white text-[9px] font-black px-3 py-1.5 rounded-full">OUTFIT #{slot.id}</div>
              </div>

              <div className="p-6 space-y-4 bg-white flex-1 flex flex-col">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Góc máy phân cảnh:</label>
                    <select 
                      value={slot.angle} 
                      onChange={e => updateSlot(slot.id, { angle: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-[9px] font-bold text-slate-600 outline-none focus:border-indigo-400 transition-all shadow-inner"
                    >
                      {SPY_ANGLES.map(angle => <option key={angle.value} value={angle.value}>{angle.label}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ghi chú chỉnh sửa ảnh:</label>
                    <input type="text" value={slot.regenNote} onChange={e => updateSlot(slot.id, { regenNote: e.target.value })} placeholder="VD: Sửa gương mặt, thêm nắng..." className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-auto pt-2">
                  <button onClick={() => handleGenerateImage(slot.id)} disabled={!slot.inputPreview || slot.loading} className="py-3 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-black transition-all uppercase tracking-widest active:scale-95 disabled:opacity-30">Vẽ ảnh AI</button>
                  <button onClick={() => handleGeneratePrompt(slot.id)} disabled={!slot.outputUrl || slot.isPromptLoading} className="py-3 bg-orange-100 text-orange-700 text-[10px] font-black rounded-xl hover:bg-orange-200 transition-all uppercase tracking-widest active:scale-95 disabled:opacity-30">Prompt</button>
                </div>

                {slot.videoPrompt && (
                  <div className="mt-2 bg-slate-900 p-4 rounded-2xl animate-slideUp border border-white/5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div> VEO-3 Ready
                      </span>
                      <button 
                        onClick={() => handleCopy(slot.videoPrompt, `slot-${slot.id}`)} 
                        className={`text-[8px] font-black uppercase transition-colors w-16 text-right ${copyStatus[`slot-${slot.id}`] ? 'text-green-400' : 'text-white underline'}`}
                      >
                        {copyStatus[`slot-${slot.id}`] ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-300 italic leading-relaxed line-clamp-4">"{slot.videoPrompt}"</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FashionTrackingModule;