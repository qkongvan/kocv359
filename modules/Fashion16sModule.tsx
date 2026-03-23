
import React, { useState, useRef, useEffect } from 'react';
import * as service from '../services/fashion16sService';
import { FashionImageItem, FashionScenarioPart } from '../types';
import { copyToClipboard } from '../utils/clipboard';

declare var JSZip: any;

const BODY_TYPES = [
  { label: 'Cân đối', prompt: 'well-proportioned body, average height, balanced shoulders and hips, healthy physique' },
  { label: 'Cao gầy', prompt: 'tall and slender body, long limbs, narrow shoulders, low body fat' },
  { label: 'Chubby (mập vừa, dễ thương)', prompt: 'slightly overweight body, soft curves, round face, visible belly, cute appearance' },
  { label: 'Béo lùn', prompt: 'short height, stocky body, round torso, short limbs, high body fat' },
  { label: 'Gầy nhỏ người', prompt: 'short and slim body, small frame, low body fat' },
  { label: 'Đầy đặn, phúc hậu', prompt: 'full-bodied, proportionate, soft and rounded silhouette' },
  { label: 'Cơ bắp / săn chắc', prompt: 'athletic body, muscular definition, low body fat' }
];

const FASHION_ACTIONS = [
  "Người mẫu đi thẳng về phía trước", "Xoay người nhẹ 180° hoặc 360°", "Đứng tạo dáng, dồn trọng tâm sang một bên",
  "Chỉnh áo, kéo khóa, cài cúc", "Vuốt cổ áo, xắn tay áo", "Vén tóc sau tai", "Đi bộ nhẹ lên phía trước",
  "Tạo dáng dứt khoát", "Dáng đứng nhấn vai, hông", "Ánh mắt mạnh, nghiêng đầu", "Tay chống hông",
  "Vải bay nhẹ theo gió", "Quay đầu chậm", "Nghiêng người về camera", "Mỉm cười nhẹ", "Tay cầm túi xách",
  "Vuốt nhẹ thân áo", "Kéo nhẹ gấu váy", "Dừng lại, xoay đầu chậm", "Đứng nghiêng người 45 độ",
  "Khoanh tay trước ngực", "Một tay đút túi quần", "Tay chạm nhẹ vào cổ", "Cúi đầu nhẹ nhìn xuống",
  "Bước đi chậm rãi phong thái catwalk", "Xoay vai nhìn lại phía sau", "Tay chỉnh kính râm (nếu có)",
  "Tay vuốt tóc nhẹ nhàng", "Dáng đứng tự tin, mắt nhìn thẳng", "Nở nụ cười rạng rỡ với camera"
];

const Fashion16sModule: React.FC = () => {
  const storageKey = "fashion16s_state_v17_scenario_4outfits";
  const [state, setState] = useState({
    faceFile: null as File | null,
    facePreview: null as string | null,
    backgroundFile: null as File | null,
    backgroundPreview: null as string | null,
    outfitFiles: [null, null, null, null] as (File | null)[],
    outfitPreviews: [null, null, null, null] as (string | null)[],
    backgroundNotes: '',
    characterDescription: '',
    gender: 'Nữ',
    bodyType: BODY_TYPES[0].label,
    selectedActions: [] as string[],
    imageStyle: 'Realistic' as 'Realistic' | '3D',
    isGenerating: false,
    isScenarioLoading: false,
    scenario: [] as FashionScenarioPart[],
    images: [] as FashionImageItem[]
  });
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

  const faceInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const outfitRefs = [
    useRef<HTMLInputElement>(null), 
    useRef<HTMLInputElement>(null), 
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ];

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setState(p => ({
          ...p,
          ...parsed,
          faceFile: null,
          facePreview: null,
          backgroundFile: null,
          backgroundPreview: null,
          outfitFiles: [null, null, null, null],
          outfitPreviews: [null, null, null, null],
          images: (parsed.images || []).map((img: any) => ({ ...img, url: '', loading: false }))
        }));
      } catch (e) { console.error("Restore state error", e); }
    }
  }, []);

  useEffect(() => {
    const toSave = {
      backgroundNotes: state.backgroundNotes,
      characterDescription: state.characterDescription,
      gender: state.gender,
      bodyType: state.bodyType,
      selectedActions: state.selectedActions,
      imageStyle: state.imageStyle,
      scenario: state.scenario,
      images: state.images.map(img => ({ ...img, url: '' }))
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(toSave));
    } catch (e) { console.error("Quota exceeded", e); }
  }, [state.backgroundNotes, state.characterDescription, state.gender, state.bodyType, state.selectedActions, state.imageStyle, state.images, state.scenario]);

  useEffect(() => {
    const handleExport = () => {
      const exportData = state.images.map((img, index) => ({
        stt: index + 1,
        inputs: {
          characterDescription: state.characterDescription,
          backgroundNotes: state.backgroundNotes,
          scenarioPart: img.scenarioPart,
          settings: {
            gender: state.gender,
            bodyType: state.bodyType,
            imageStyle: state.imageStyle,
            outfitIndex: img.outfitIndex
          }
        },
        script: `Fashion Scene: ${img.scenarioPart || 'Professional Pose'}`,
        outputImage: img.url || '',
        videoPrompt: img.videoPrompt || ''
      }));

      window.dispatchEvent(new CustomEvent('EXPORT_DATA_READY', { 
        detail: { data: exportData, moduleName: 'Fashion_Collection' } 
      }));
    };

    const smartFind = (obj: any, keys: string[]) => {
      if (!obj) return undefined;
      const lowerKeys = keys.map(k => k.toLowerCase());
      const foundKey = Object.keys(obj).find(k => lowerKeys.includes(k.toLowerCase()));
      return foundKey ? obj[foundKey] : undefined;
    };

    const handleImport = async (e: any) => {
      const importedData = e.detail;
      if (!Array.isArray(importedData)) return;

      const firstItem = importedData[0];
      const inputs = smartFind(firstItem, ['inputs', 'input', 'data']) || {};
      const settings = smartFind(inputs, ['settings', 'config']) || {};

      const newState = {
        ...state,
        characterDescription: smartFind(inputs, ['characterDescription', 'character']) || state.characterDescription,
        backgroundNotes: smartFind(inputs, ['backgroundNotes', 'background']) || state.backgroundNotes,
        gender: smartFind(settings, ['gender', 'giới tính']) || state.gender,
        bodyType: smartFind(settings, ['bodyType', 'dáng người']) || state.bodyType,
        imageStyle: smartFind(settings, ['imageStyle']) || state.imageStyle,
        images: [] as FashionImageItem[]
      };

      const total = importedData.length;
      for (let i = 0; i < total; i++) {
        const item = importedData[i];
        const itemSettings = smartFind(item, ['settings', 'config']) || {};

        newState.images.push({
          id: `imported-${i}-${Date.now()}`,
          outfitIndex: smartFind(itemSettings, ['outfitIndex']) || 0,
          url: smartFind(item, ['outputImage', 'image', 'base64']) || '',
          loading: false,
          regenNote: '',
          videoPrompt: smartFind(item, ['videoPrompt', 'prompt']) || '',
          isPromptLoading: false,
          isPromptVisible: true,
          scenarioPart: smartFind(item, ['script', 'content']) || ''
        });

        const percent = Math.round(((i + 1) / total) * 100);
        window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { 
          detail: { percent, complete: i === total - 1 } 
        }));
        await new Promise(r => setTimeout(r, 80));
      }

      setState(newState as any);
    };

    window.addEventListener('REQUEST_EXPORT_DATA', handleExport);
    window.addEventListener('REQUEST_IMPORT_DATA', handleImport);
    return () => {
      window.removeEventListener('REQUEST_EXPORT_DATA', handleExport);
      window.removeEventListener('REQUEST_IMPORT_DATA', handleImport);
    };
  }, [state]);

  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setState(p => ({ ...p, faceFile: file, facePreview: URL.createObjectURL(file) }));
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setState(p => ({ ...p, backgroundFile: file, backgroundPreview: URL.createObjectURL(file) }));
  };

  const handleOutfitUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newFiles = [...state.outfitFiles];
      const newPreviews = [...state.outfitPreviews];
      newFiles[index] = file;
      newPreviews[index] = URL.createObjectURL(file);
      setState(p => ({ ...p, outfitFiles: newFiles, outfitPreviews: newPreviews }));
    }
  };

  const toggleAction = (action: string) => {
    setState(p => {
      const exists = p.selectedActions.includes(action);
      return { ...p, selectedActions: exists ? p.selectedActions.filter(a => a !== action) : [...p.selectedActions, action] };
    });
  };

  const handleGenerateScenario = async () => {
    const validOutfits = state.outfitPreviews.filter(p => p !== null) as string[];
    if (validOutfits.length === 0) return alert("Vui lòng tải ít nhất 1 ảnh trang phục.");
    setState(p => ({ ...p, isScenarioLoading: true }));
    try {
      const scenario = await service.generateFashionScenario(validOutfits, state.gender);
      setState(p => ({ ...p, scenario, isScenarioLoading: false }));
    } catch (e) { 
      setState(p => ({ ...p, isScenarioLoading: false })); 
      alert("Lỗi khi tạo kịch bản storyboard.");
    }
  };

  const handleGenerateImages = async () => {
    const validOutfits = state.outfitFiles.filter(f => f !== null) as File[];
    if (!state.faceFile || validOutfits.length === 0) return alert("Cần ít nhất 1 ảnh mặt và 1 ảnh trang phục.");
    
    setState(p => ({ ...p, isGenerating: true }));
    try {
      const facePart = await service.fileToGenerativePart(state.faceFile);
      const bgPart = state.backgroundFile ? await service.fileToGenerativePart(state.backgroundFile) : null;
      const bodyTypePrompt = BODY_TYPES.find(b => b.label === state.bodyType)?.prompt || "";
      
      const newImages: FashionImageItem[] = [];
      if (state.scenario.length > 0) {
        state.scenario.forEach(s => {
          newImages.push({
            id: `img-${s.id}-${Date.now()}`, 
            outfitIndex: s.outfitIndex, 
            url: '', 
            loading: true, 
            regenNote: '',
            videoPrompt: '', 
            isPromptLoading: false, 
            isPromptVisible: false, 
            scenarioPart: s.poseDescription
          });
        });
      } else {
        for (let i = 0; i < validOutfits.length; i++) {
          for (let j = 0; j < 2; j++) {
            newImages.push({
              id: `outfit-${i}-img-${j}-${Date.now()}`, 
              outfitIndex: i, 
              url: '', 
              loading: true, 
              regenNote: '',
              videoPrompt: '', 
              isPromptLoading: false, 
              isPromptVisible: false
            });
          }
        }
      }
      
      setState(p => ({ ...p, images: newImages }));
      
      const outfitIndices = Array.from(new Set(newImages.map(img => img.outfitIndex)));
      
      for (const i of outfitIndices) {
        const outfitFile = validOutfits[i];
        if (!outfitFile) continue;
        
        const outfitPart = await service.fileToGenerativePart(outfitFile);
        const outfitDescription = await service.describeOutfit(outfitPart);
        const itemsToGen = newImages.filter(img => img.outfitIndex === i);
        
        for (const item of itemsToGen) {
          try {
            const url = await service.generateFashionImage(
              facePart, 
              outfitPart, 
              outfitDescription, 
              state.backgroundNotes, 
              bgPart, 
              state.characterDescription, 
              "", 
              state.imageStyle, 
              state.gender, 
              bodyTypePrompt, 
              state.selectedActions, 
              item.scenarioPart
            );
            setState(p => ({ ...p, images: p.images.map(img => img.id === item.id ? { ...img, url, loading: false } : img) }));
          } catch (e) { 
            setState(p => ({ ...p, images: p.images.map(img => img.id === item.id ? { ...img, loading: false } : img) })); 
          }
        }
      }
    } finally { 
      setState(p => ({ ...p, isGenerating: false })); 
    }
  };

  const handleRegenImage = async (id: string) => {
    const item = state.images.find(img => img.id === id);
    const validOutfits = state.outfitFiles.filter(f => f !== null) as File[];
    if (!item || !state.faceFile || validOutfits.length <= item.outfitIndex) return;
    
    setState(p => ({ ...p, images: p.images.map(img => img.id === id ? { ...img, loading: true } : img) }));
    try {
      const facePart = await service.fileToGenerativePart(state.faceFile);
      const outfitPart = await service.fileToGenerativePart(validOutfits[item.outfitIndex]);
      const bgPart = state.backgroundFile ? await service.fileToGenerativePart(state.backgroundFile) : null;
      const bodyTypePrompt = BODY_TYPES.find(b => b.label === state.bodyType)?.prompt || "";
      const outfitDescription = await service.describeOutfit(outfitPart);
      
      const url = await service.generateFashionImage(
        facePart, 
        outfitPart, 
        outfitDescription, 
        state.backgroundNotes, 
        bgPart, 
        state.characterDescription, 
        item.regenNote, 
        state.imageStyle, 
        state.gender, 
        bodyTypePrompt, 
        state.selectedActions, 
        item.scenarioPart
      );
      setState(p => ({ ...p, images: p.images.map(img => img.id === id ? { ...img, url, loading: false } : img) }));
    } catch (e) { 
      setState(p => ({ ...p, images: p.images.map(img => img.id === id ? { ...img, loading: false } : img) })); 
    }
  };

  const handleGenPrompt = async (id: string) => {
    const item = state.images.find(img => img.id === id);
    if (!item || !item.url) return;
    setState(p => ({ ...p, images: p.images.map(img => img.id === id ? { ...img, isPromptLoading: true, isPromptVisible: true } : img) }));
    try {
      const prompt = await service.generateFashionVeoPrompt(
        item.url, 
        state.backgroundNotes, 
        state.characterDescription, 
        item.regenNote, 
        state.imageStyle, 
        state.gender, 
        state.selectedActions
      );
      setState(p => ({ ...p, images: p.images.map(img => img.id === id ? { ...img, videoPrompt: prompt, isPromptLoading: false } : img) }));
    } catch (e) { 
      setState(p => ({ ...p, images: p.images.map(img => img.id === id ? { ...img, isPromptLoading: false } : img) })); 
    }
  };

  const downloadAllImagesZip = async () => {
    if (typeof JSZip === 'undefined') return alert("Đang tải thư viện ZIP, vui lòng đợi...");
    const zip = new JSZip();
    let count = 0;
    state.images.forEach((img, i) => {
      if (img.url) {
        zip.file(`fashion_${i+1}.png`, img.url.split(',')[1], { base64: true });
        count++;
      }
    });
    if (count > 0) {
      zip.generateAsync({type:"blob"}).then((content: any) => {
        const link = document.createElement('a'); 
        link.href = URL.createObjectURL(content); 
        link.download = `fashion_${Date.now()}.zip`; 
        link.click();
      });
    } else {
      alert("Chưa có ảnh nào để tải.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="bg-white rounded-[2.5rem] p-10 mb-12 shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* CONFIGURATION COLUMN */}
          <div className="lg:col-span-5 space-y-8 border-r border-slate-50 pr-0 lg:pr-10">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest px-1">Giới tính</label>
                <select 
                  value={state.gender} 
                  onChange={e => setState(p => ({ ...p, gender: e.target.value }))} 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-orange-50 appearance-none transition-all"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.2rem' }}
                >
                  <option value="Nữ">Nữ</option>
                  <option value="Nam">Nam</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest px-1">Phong cách</label>
                <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200 h-[52px]">
                  <button 
                    onClick={() => setState(p => ({ ...p, imageStyle: 'Realistic' }))} 
                    className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-all ${state.imageStyle === 'Realistic' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Chân thực
                  </button>
                  <button 
                    onClick={() => setState(p => ({ ...p, imageStyle: '3D' }))} 
                    className={`flex-1 py-2 text-xs font-black uppercase rounded-xl transition-all ${state.imageStyle === '3D' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    3D
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest px-1">Dáng người (Body Type)</label>
              <select 
                value={state.bodyType} 
                onChange={e => setState(p => ({ ...p, bodyType: e.target.value }))} 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none transition-all appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.2rem' }}
              >
                {BODY_TYPES.map(bt => <option key={bt.label} value={bt.label}>{bt.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-[0.2em] border-b pb-2">Gương mặt mẫu</label>
                <div onClick={() => faceInputRef.current?.click()} className="aspect-[3/4] bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden transition-all hover:border-orange-400 group relative">
                  {state.facePreview ? <img src={state.facePreview} className="w-full h-full object-cover" /> : (
                    <div className="text-center p-4">
                       <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                       <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Tải mặt mẫu</span>
                    </div>
                  )}
                  <input type="file" ref={faceInputRef} onChange={handleFaceUpload} className="hidden" accept="image/*" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-[0.2em] border-b pb-2">Bối cảnh (Tùy chọn)</label>
                <div onClick={() => backgroundInputRef.current?.click()} className="aspect-[3/4] bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden transition-all hover:border-indigo-400 group relative">
                  {state.backgroundPreview ? <img src={state.backgroundPreview} className="w-full h-full object-cover" /> : (
                    <div className="text-center p-4">
                       <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                       <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Tải bối cảnh</span>
                    </div>
                  )}
                  <input type="file" ref={backgroundInputRef} onChange={handleBackgroundUpload} className="hidden" accept="image/*" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest px-1">Ghi chú bối cảnh bằng chữ</label>
              <textarea 
                value={state.backgroundNotes} 
                onChange={e => setState(p => ({ ...p, backgroundNotes: e.target.value }))} 
                placeholder="VD: Đường phố Châu Âu, ánh sáng hoàng hôn, studio cao cấp..." 
                className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-orange-50 resize-none font-medium" 
              />
            </div>
          </div>

          {/* OUTFITS & ACTIONS COLUMN */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Trang phục (Tối đa 4 bộ)</label>
                <button 
                  onClick={handleGenerateScenario} 
                  disabled={state.isScenarioLoading || state.outfitPreviews.every(p => p === null)}
                  className="text-xs font-black text-orange-600 hover:text-orange-700 uppercase tracking-widest transition-colors flex items-center gap-1"
                >
                  {state.isScenarioLoading ? "Đang tạo kịch bản..." : "✨ Tự động tạo Storyboard"}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[0, 1, 2, 3].map(idx => (
                  <div key={idx} onClick={() => outfitRefs[idx].current?.click()} className="aspect-[3/4] bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden transition-all hover:border-blue-400 hover:shadow-xl group relative">
                    {state.outfitPreviews[idx] ? <img src={state.outfitPreviews[idx]!} className="w-full h-full object-cover" /> : (
                      <div className="text-center p-2">
                        <svg className="w-6 h-6 text-slate-300 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                        <span className="text-xs font-black text-slate-400 uppercase">Bộ {idx + 1}</span>
                      </div>
                    )}
                    <input type="file" ref={outfitRefs[idx]} onChange={(e) => handleOutfitUpload(idx, e)} className="hidden" accept="image/*" />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest px-1">Hành động của người mẫu</label>
              <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
                {FASHION_ACTIONS.map(action => (
                  <button 
                    key={action} 
                    onClick={() => toggleAction(action)} 
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${state.selectedActions.includes(action) ? 'bg-orange-600 text-white border-orange-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-orange-400'}`}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={handleGenerateImages} 
              disabled={state.isGenerating || !state.faceFile || state.outfitFiles.every(f => f === null)} 
              className="w-full py-5 bg-slate-900 text-white font-black rounded-3xl shadow-2xl hover:bg-black transition-all text-sm uppercase tracking-[0.3em] disabled:opacity-50 active:scale-[0.98]"
            >
              {state.isGenerating ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>ĐANG TẠO BỘ SƯU TẬP...</span>
                </div>
              ) : "BẮT ĐẦU TẠO VISUALS"}
            </button>
          </div>
        </div>
      </div>

      {/* STORYBOARD SECTION */}
      {state.scenario.length > 0 && (
        <div className="mb-12 animate-fadeIn">
          <div className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 shadow-2xl">
            <h3 className="text-xl font-black text-white uppercase tracking-[0.2em] mb-8 border-b border-white/10 pb-6 flex items-center gap-3">
              <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1.01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              STORYBOARD ĐẠO DIỄN
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
              {state.scenario.map((s) => (
                <div key={s.id} className="bg-white/5 p-5 rounded-2xl border border-white/10 hover:bg-white/15 transition-all">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-black text-orange-500 uppercase tracking-widest">Cảnh {s.id}</span>
                    <span className="text-xs font-bold text-white/40 uppercase bg-white/10 px-2 py-1 rounded">Bộ {s.outfitIndex + 1}</span>
                  </div>
                  <div className="space-y-4">
                    <p className="text-sm text-white/90 font-bold leading-relaxed italic">"{s.vibeDescription}"</p>
                    <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                       <p className="text-xs text-white/30 uppercase font-black mb-1 tracking-tighter">Pose Tech:</p>
                       <p className="text-xs text-orange-200/60 font-mono leading-tight">{s.poseDescription}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GALLERY RESULTS */}
      {state.images.length > 0 && (
        <div className="space-y-12 pb-40">
          <div className="flex flex-col md:flex-row justify-between items-center bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 gap-6 shadow-2xl">
            <div className="text-center md:text-left">
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter">GALLERY <span className="text-orange-500">COLLECTION</span></h3>
              <p className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] mt-2 italic">
                {state.imageStyle === 'Realistic' ? 'Photorealistic' : '3D Animation'} • {state.bodyType} • {state.images.length} scenes
              </p>
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <button 
                onClick={downloadAllImagesZip} 
                className="flex-1 md:flex-none px-10 py-5 bg-white text-slate-900 text-sm font-black rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest shadow-xl shadow-white/5 active:scale-95"
              >
                Tải ZIP Bộ Ảnh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
            {state.images.map((img) => (
              <div key={img.id} className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col group hover:shadow-2xl transition-all duration-700 relative border-b-8 border-b-slate-100">
                <div className="relative aspect-[9/16] bg-slate-50 overflow-hidden">
                  {img.url ? <img src={img.url} className={`w-full h-full object-cover transition-all duration-1000 group-hover:scale-105 ${img.loading ? 'blur-sm grayscale opacity-50' : ''}`} /> : null}
                  
                  {img.loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-black/5 backdrop-blur-[4px] z-10">
                      <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4 shadow-xl"></div>
                      <p className="text-xs font-black text-orange-600 uppercase tracking-widest animate-pulse">Processing...</p>
                    </div>
                  )}

                  <div className="absolute top-6 left-6 px-4 py-2 bg-black/60 backdrop-blur-md text-white text-xs font-black rounded-full uppercase tracking-[0.1em] border border-white/20 z-20 shadow-xl">
                    OUTFIT #{img.outfitIndex + 1}
                  </div>
                </div>

                <div className="p-8 space-y-5 flex-1 flex flex-col bg-white">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block px-1">Chỉnh sửa cảnh</label>
                    <textarea 
                      value={img.regenNote} 
                      onChange={e => setState(p => ({ ...p, images: p.images.map(i => i.id === img.id ? { ...i, regenNote: e.target.value } : i) }))} 
                      placeholder="VD: Chỉnh góc máy, ánh sáng rực rỡ hơn..." 
                      className="w-full h-24 p-4 text-sm font-bold bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:border-orange-500 focus:bg-white transition-all resize-none shadow-inner" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-auto">
                    <button 
                      onClick={() => handleRegenImage(img.id)} 
                      disabled={img.loading}
                      className="py-4 bg-slate-900 text-white text-xs font-black rounded-2xl uppercase hover:bg-black transition-all tracking-widest shadow-lg disabled:opacity-50 active:scale-95"
                    >
                      Tạo Lại
                    </button>
                    <button 
                      onClick={() => handleGenPrompt(img.id)} 
                      disabled={img.isPromptLoading}
                      className="py-4 bg-orange-50 border border-orange-100 text-orange-700 text-xs font-black rounded-2xl uppercase hover:bg-orange-100 transition-all tracking-widest active:scale-95"
                    >
                      Prompt
                    </button>
                  </div>
                </div>

                {img.isPromptVisible && (
                  <div className="p-6 bg-slate-900 border-t border-slate-800 animate-slideUp">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-black text-orange-500 uppercase tracking-widest">Video Prompt Ready</span>
                      <button 
                        onClick={() => handleCopy(img.videoPrompt, `img-${img.id}`)} 
                        className={`text-xs font-black uppercase transition-colors w-16 text-right ${copyStatus[`img-${img.id}`] ? 'text-green-400' : 'text-white underline hover:text-orange-400'}`}
                      >
                        {copyStatus[`img-${img.id}`] ? 'COPIED!' : 'Copy'}
                      </button>
                    </div>
                    {img.isPromptLoading ? (
                      <div className="h-12 flex items-center justify-center"><div className="w-5 h-5 border-2 border-orange-600 border-t-white rounded-full animate-spin"></div></div>
                    ) : (
                      <p className="text-xs text-slate-300 leading-relaxed italic line-clamp-4 font-medium opacity-80">"{img.videoPrompt}"</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Fashion16sModule;
