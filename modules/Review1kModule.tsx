
import React, { useState, useRef, useEffect } from 'react';
import * as service from '../services/review1kService';
import ScriptSection from '../components/ScriptSection';
import ImageCard from '../components/ImageCard';

const initialImageState = { url: '', loading: false, customPrompt: '' };
const initialVideoPromptState = { text: '', loading: false, visible: false };

declare var JSZip: any;

const Review1kModule: React.FC = () => {
  const storageKey = "review1k_project_v2_stable"; 
  
  const getInitialState = () => ({
    faceFile: null,
    facePreviewUrl: null,
    selectedFiles: [],
    previewUrls: [],
    productName: '',
    keyword: '',
    characterDescription: '',
    scriptNote: '',
    gender: 'Nữ',
    voice: 'Miền Bắc',
    imageStyle: 'Realistic', // Added imageStyle
    isGeneratingScript: false,
    script: null,
    images: { 
      v2: { ...initialImageState }, 
      v3: { ...initialImageState }, 
      v4: { ...initialImageState } 
    },
    videoPrompts: { 
      v2: { ...initialVideoPromptState }, 
      v3: { ...initialVideoPromptState }, 
      v4: { ...initialVideoPromptState } 
    }
  });

  const [state, setState] = useState<any>(getInitialState());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setState((prev: any) => ({ 
            ...prev, 
            ...parsed,
            images: {
              v2: { ...initialImageState, ...(parsed.images?.v2 || {}) },
              v3: { ...initialImageState, ...(parsed.images?.v3 || {}) },
              v4: { ...initialImageState, ...(parsed.images?.v4 || {}) },
            },
            videoPrompts: {
              v2: { ...initialVideoPromptState, ...(parsed.videoPrompts?.v2 || {}) },
              v3: { ...initialVideoPromptState, ...(parsed.videoPrompts?.v3 || {}) },
              v4: { ...initialVideoPromptState, ...(parsed.videoPrompts?.v4 || {}) },
            },
            selectedFiles: [], 
            previewUrls: [],
            faceFile: null,
            facePreviewUrl: null,
            isGeneratingScript: false 
          }));
        }
      }
    } catch (e) {
      console.error("Failed to restore Review1k state", e);
    }
  }, []);

  useEffect(() => {
    try {
      const { selectedFiles, previewUrls, faceFile, facePreviewUrl, isGeneratingScript, images, ...rest } = state;
      const safeImages = Object.keys(images || {}).reduce((acc: any, key) => {
        acc[key] = { ...(images[key] || {}), url: '' };
        return acc;
      }, {});
      localStorage.setItem(storageKey, JSON.stringify({ ...rest, images: safeImages }));
    } catch (e) { }
  }, [state]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = [e.target.files[0]];
      setState((prev: any) => ({ ...prev, selectedFiles: files, previewUrls: [URL.createObjectURL(files[0])] }));
    }
  };

  const handleFaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setState((prev: any) => ({ ...prev, faceFile: file, facePreviewUrl: URL.createObjectURL(file) }));
    }
  };

  const handleGenerateScript = async () => {
    if (state.selectedFiles.length === 0 || !state.productName) return;
    
    setState((prev: any) => ({ 
      ...prev, 
      isGeneratingScript: true, 
      script: null,
      images: { v2: {...initialImageState}, v3: {...initialImageState}, v4: {...initialImageState} },
      videoPrompts: { v2: {...initialVideoPromptState}, v3: {...initialVideoPromptState}, v4: {...initialVideoPromptState} }
    }));

    try {
      const imageParts = await Promise.all(state.selectedFiles.map(file => service.fileToGenerativePart(file)));
      const script = await service.generateReview1kScript(
        imageParts, 
        state.productName, 
        state.keyword, 
        state.gender, 
        state.voice, 
        state.scriptNote
      );
      setState((prev: any) => ({ ...prev, script }));
    } catch(e) {
      console.error(e);
    } finally { 
      setState((prev: any) => ({ ...prev, isGeneratingScript: false })); 
    }
  };

  const handleGenImageForKey = async (key: string) => {
    setState((p:any)=>({...p, images: { ...p.images, [key]: { ...(p.images?.[key] || initialImageState), loading: true } } }));
    try {
      const imageParts = await Promise.all(state.selectedFiles.map(file => service.fileToGenerativePart(file)));
      const facePart = state.faceFile ? await service.fileToGenerativePart(state.faceFile) : null;
      const url = await service.generateReview1kImage(
        imageParts, 
        facePart, 
        state.productName, 
        state.script[key], 
        state.characterDescription, 
        state.gender,
        state.images[key]?.customPrompt,
        state.imageStyle
      );
      setState((p:any)=>({...p, images: { ...p.images, [key]: { ...(p.images?.[key] || initialImageState), url, loading: false } } }));
    } catch (e) {
      setState((p:any)=>({...p, images: { ...p.images, [key]: { ...(p.images?.[key] || initialImageState), loading: false, error: 'Lỗi' } } }));
    }
  };

  const handleGenPromptForKey = async (key: string) => {
    setState((p:any)=>({...p, videoPrompts: { ...(p.videoPrompts || {}), [key]: { ...(p.videoPrompts?.[key] || initialVideoPromptState), loading: true, visible: true}}}));
    try {
      const productImagePart = state.selectedFiles[0] ? await service.fileToGenerativePart(state.selectedFiles[0]) : null;
      const prompt = await service.generateReview1kVeoPrompt(
        state.productName, 
        state.script[key], 
        state.gender, 
        state.voice, 
        productImagePart?.data,
        state.images[key]?.url,
        state.imageStyle
      );
      setState((p:any)=>({...p, videoPrompts: { ...(p.videoPrompts || {}), [key]: { text: prompt, loading: false, visible: true}}}));
    } catch (e) {
      setState((p:any)=>({...p, videoPrompts: { ...(p.videoPrompts || {}), [key]: { ...(p.videoPrompts?.[key] || initialVideoPromptState), loading: false }}}));
    }
  };

  const downloadAllImagesZip = async () => {
    if (typeof JSZip === 'undefined') {
      alert("Đang tải thư viện nén...");
      return;
    }
    const zip = new JSZip();
    let count = 0;
    const keys = ['v2', 'v3', 'v4'];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const img = state.images[key];
      if (img?.url) {
        const base64Data = img.url.split(',')[1];
        zip.file(`${String(i + 1).padStart(2, '0')}.png`, base64Data, { base64: true });
        count++;
      }
    }
    if (count === 0) return alert("Chưa có ảnh nào.");
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `review1k_images_${state.productName || 'project'}.zip`;
    link.click();
  };

  const downloadAllPromptsTxt = () => {
    const keys = ['v2', 'v3', 'v4'];
    const text = keys
      .map(key => state.videoPrompts[key]?.text || "")
      .filter(t => t.trim().length > 0)
      .join('\n');
    if (!text) return alert("Chưa có prompt nào.");
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `prompts_review1k_${state.productName || 'project'}.txt`;
    link.click();
  };

  const hasGeneratedItems = state.script && Object.values(state.images).some((img: any) => img.url);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-white rounded-[24px] border border-slate-200 p-8 shadow-sm mb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">1. Hình ảnh sản phẩm</label>
              <div 
                onClick={() => fileInputRef.current?.click()} 
                className="w-full aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-orange-400 transition-all overflow-hidden"
              >
                {state.previewUrls[0] ? (
                  <img src={state.previewUrls[0]} className="h-full object-contain" />
                ) : (
                  <div className="text-center opacity-40">
                    <svg className="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-xs font-bold uppercase tracking-tighter">Tải ảnh sản phẩm</span>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">0. Ảnh khuôn mặt mẫu</label>
              <div className="flex gap-4">
                <div 
                  onClick={() => faceInputRef.current?.click()}
                  className="w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-orange-400 transition-all overflow-hidden flex-shrink-0"
                >
                  {state.facePreviewUrl ? (
                    <img src={state.facePreviewUrl} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center opacity-30">
                       <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                  )}
                  <input type="file" ref={faceInputRef} onChange={handleFaceFileChange} className="hidden" accept="image/*" />
                </div>
                <div className="flex-1 text-center flex flex-col justify-center border-2 border-dashed border-slate-100 rounded-2xl">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ảnh mặt nhân vật</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase px-1">Mô tả nhân vật</label>
                <textarea 
                  value={state.characterDescription}
                  onChange={e => setState((p:any)=>({...p, characterDescription: e.target.value}))}
                  placeholder="Trang phục, dáng người..."
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-50 focus:border-orange-500 transition-all resize-none h-20 font-medium"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">2. Tên sản phẩm</label>
              <input 
                type="text" 
                value={state.productName} 
                onChange={e=>setState((p:any)=>({...p, productName: e.target.value}))} 
                placeholder="Bộ phát wifi 4G..." 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-500" 
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">3. Giá / USP</label>
              <input 
                type="text" 
                value={state.keyword} 
                onChange={e=>setState((p:any)=>({...p, keyword: e.target.value}))} 
                placeholder="Ví dụ: Chỉ 1k..." 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-500" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Giới tính</label>
                    <select 
                        value={state.gender} 
                        onChange={e => setState((p:any)=>({...p, gender: e.target.value}))}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-orange-500"
                    >
                        <option value="Nữ">Nữ</option>
                        <option value="Nam">Nam</option>
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Vùng miền</label>
                    <select 
                        value={state.voice} 
                        onChange={e => setState((p:any)=>({...p, voice: e.target.value}))}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-orange-500"
                    >
                        <option value="Miền Bắc">Miền Bắc</option>
                        <option value="Miền Nam">Miền Nam</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-black text-slate-500 uppercase px-1">Phong cách ảnh</label>
                    <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                      <button 
                        onClick={() => setState((p:any)=>({...p, imageStyle: 'Realistic'}))}
                        className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${state.imageStyle === 'Realistic' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Chân thực
                      </button>
                      <button 
                        onClick={() => setState((p:any)=>({...p, imageStyle: '3D'}))}
                        className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${state.imageStyle === '3D' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        3D Animation
                      </button>
                    </div>
                </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Lưu ý kịch bản</label>
              <textarea 
                value={state.scriptNote}
                onChange={e => setState((p:any)=>({...p, scriptNote: e.target.value}))}
                placeholder="Bối cảnh quán cafe..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-500 transition-all h-24 resize-none font-medium"
              />
            </div>

            <button 
              onClick={handleGenerateScript} 
              disabled={state.isGeneratingScript || !state.productName || state.selectedFiles.length === 0}
              className="w-full py-5 bg-orange-600 text-white font-black rounded-xl text-lg flex items-center justify-center gap-3 transition-all hover:bg-orange-700 hover:shadow-xl shadow-orange-100 disabled:opacity-50 disabled:cursor-not-allowed group uppercase tracking-widest"
            >
              {state.isGeneratingScript ? "ĐANG TẠO CHIẾN DỊCH..." : "BẮT ĐẦU TẠO CAMPAIGN"}
            </button>
          </div>
        </div>
      </div>

      {state.script && (
          <div className="space-y-12 pb-32">
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm">
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">KẾT QUẢ CHIẾN DỊCH</h3>
                  <p className="text-xs font-bold text-orange-500 uppercase tracking-widest">
                    Đã tạo xong kịch bản cho 3 phần (Hook, Review, CTA) • Style: {state.imageStyle === 'Realistic' ? 'Chân thực' : '3D Animation'}
                  </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {['v2', 'v3', 'v4'].map(key => (
                      <div key={key} className="space-y-4 animate-fadeIn">
                          <ScriptSection 
                            title={key === 'v2' ? "Hook" : key === 'v3' ? "Review" : "CTA"} 
                            content={state.script?.[key] || ""} 
                            color="border-orange-600" 
                            onChange={(val) => setState((p:any)=>({...p, script: { ...(p.script || {}), [key]: val }}))} 
                            maxChars={180}
                          />
                          <ImageCard 
                            label={key === 'v2' ? "Hook" : key === 'v3' ? "Review" : "CTA"} 
                            imageData={state.images?.[key] || initialImageState} 
                            videoPrompt={state.videoPrompts?.[key] || initialVideoPromptState} 
                            onGeneratePrompt={() => handleGenPromptForKey(key)} 
                            onRegenerate={() => handleGenImageForKey(key)} 
                            onTranslate={() => {}} 
                            onUpload={(file) => {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setState((p: any) => ({
                                  ...p,
                                  images: {
                                    ...p.images,
                                    [key]: { ...p.images[key], url: ev.target?.result as string, loading: false }
                                  }
                                }));
                              };
                              reader.readAsDataURL(file);
                            }}
                            onDelete={() => setState((p: any) => ({ ...p, images: { ...p.images, [key]: { ...p.images[key], url: '', loading: false } } }))}
                            customPrompt={state.images[key]?.customPrompt || ""} 
                            onCustomPromptChange={(val) => setState((p:any)=>({...p, images: { ...p.images, [key]: { ...p.images[key], customPrompt: val }}}))} 
                          />
                      </div>
                  ))}
              </div>

              {/* Download Buttons Section */}
              {hasGeneratedItems && (
                <div className="flex flex-col md:flex-row items-center justify-center gap-4 py-12 border-t border-slate-200 mt-12">
                  <button 
                    onClick={downloadAllImagesZip}
                    className="w-full md:w-auto px-12 py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-base"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Tải toàn bộ ảnh (ZIP)
                  </button>
                  <button 
                    onClick={downloadAllPromptsTxt}
                    className="w-full md:w-auto px-12 py-5 bg-orange-600 text-white font-black rounded-2xl shadow-xl hover:bg-orange-700 transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-base"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Tải File Prompt (.txt)
                  </button>
                </div>
              )}
          </div>
      )}
    </div>
  );
};

export default Review1kModule;
