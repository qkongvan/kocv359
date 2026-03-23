import React, { useState, useRef, useEffect } from 'react';
import * as service from '../services/shopee8sService';
import { Shopee8sProduct, ScriptParts, VideoPromptState, GeneratedImage } from '../types';
import ScriptSection from '../components/ScriptSection';
import ImageCard from '../components/ImageCard';

declare var JSZip: any;

const VOICE_OPTIONS = [
  "Giọng Bắc 20-40 tuổi",
  "Giọng Nam 20-40 tuổi",
  "Giọng Bắc 50-60 tuổi",
  "Giọng Nam 50-60 tuổi",
  "Giọng Bắc 60-80 tuổi",
  "Giọng Nam 60-80 tuổi"
];

const ADDRESSING_OPTIONS = [
  "em - anh chị",
  "em - các bác",
  "tôi - các bạn",
  "tớ - các cậu",
  "mình - các bạn",
  "tao - mày",
  "tui - mấy bà",
  "tui - mấy ní",
  "tui - các bác",
  "tui - mấy ông",
  "mình - cả nhà",
  "mình - mọi người"
];

const Shopee8sModule: React.FC = () => {
  const storageKey = "shopee8s_project_v8_voice_addressing";
  const [products, setProducts] = useState<Shopee8sProduct[]>(
    Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: '',
      usp: '',
      background: '',
      action: '',
      file: null,
      previewUrl: null,
      script: null,
      images: {},
      videoPrompts: {},
      isLoading: false
    }))
  );
  
  const [activeProductId, setActiveProductId] = useState<number>(1);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [outfitFile, setOutfitFile] = useState<File | null>(null);
  const [outfitPreviewUrl, setOutfitPreviewUrl] = useState<string | null>(null);
  const [processedOutfitUrl, setProcessedOutfitUrl] = useState<string | null>(null);
  const [isExtractingOutfit, setIsExtractingOutfit] = useState(false);
  const [gender, setGender] = useState<string>('Nữ');
  const [voice, setVoice] = useState<string>(VOICE_OPTIONS[0]);
  const [addressing, setAddressing] = useState<string>('');
  const [imageStyle, setImageStyle] = useState<'Realistic' | '3D'>('Realistic');
  const [commonNote, setCommonNote] = useState('');
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const outfitInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.products) {
          setProducts(prev => prev.map(p => {
            const savedP = parsed.products.find((sp: any) => sp.id === p.id);
            return savedP ? { 
              ...p, 
              ...savedP, 
              file: null, 
              previewUrl: null, 
              isLoading: false,
              images: savedP.images || {},
              videoPrompts: savedP.videoPrompts || {}
            } : p;
          }));
        }
        if (parsed.commonNote) setCommonNote(parsed.commonNote);
        if (parsed.gender) setGender(parsed.gender);
        if (parsed.voice) setVoice(parsed.voice);
        if (parsed.addressing) setAddressing(parsed.addressing);
        if (parsed.imageStyle) setImageStyle(parsed.imageStyle);
      }
    } catch (e) { console.error("Restore fail", e); }
  }, []);

  useEffect(() => {
    try {
      const persistentProducts = products.map(({ file, previewUrl, isLoading, images, videoPrompts, ...rest }) => {
        const safeImages = Object.keys(images || {}).reduce((acc: any, key) => {
           acc[key] = { ...images[key], url: '' }; 
           return acc;
        }, {});
        return { 
          ...rest, 
          images: safeImages, 
          videoPrompts: videoPrompts || {} 
        };
      });
      localStorage.setItem(storageKey, JSON.stringify({ products: persistentProducts, commonNote, gender, voice, addressing, imageStyle }));
    } catch (e) { }
  }, [products, commonNote, gender, voice, addressing, imageStyle]);

  // Handle Import/Export
  useEffect(() => {
    const handleExport = () => {
      const exportData: any[] = [];
      let stt = 1;
      products.forEach(p => {
        if (!p.script) return;
        ['v1', 'v2', 'v3', 'v4'].forEach(key => {
          exportData.push({
            stt: stt++,
            inputs: {
              productName: p.name,
              usp: p.usp,
              background: p.background,
              action: p.action,
              settings: {
                gender,
                voice,
                addressing,
                imageStyle,
                commonNote
              }
            },
            script: (p.script as any)[key],
            outputImage: p.images[key]?.url || '',
            videoPrompt: p.videoPrompts[key]?.text || ''
          });
        });
      });

      window.dispatchEvent(new CustomEvent('EXPORT_DATA_READY', { 
        detail: { data: exportData, moduleName: 'Shopee_Video_8s' } 
      }));
    };

    const handleImport = async (e: any) => {
      const importedData = e.detail;
      if (!Array.isArray(importedData)) return;

      const smartFind = (obj: any, keys: string[]) => {
        const lowerKeys = keys.map(k => k.toLowerCase());
        const foundKey = Object.keys(obj).find(k => lowerKeys.includes(k.toLowerCase()));
        return foundKey ? obj[foundKey] : undefined;
      };

      const firstItem = importedData[0];
      const globalInputs = smartFind(firstItem, ['inputs', 'data']) || {};
      const globalSettings = smartFind(globalInputs, ['settings']) || {};

      const newProducts = [...products];
      const total = importedData.length;
      
      setGender(smartFind(globalSettings, ['gender']) || gender);
      setVoice(smartFind(globalSettings, ['voice']) || voice);
      setAddressing(smartFind(globalSettings, ['addressing', 'xưng hô']) || addressing);
      setImageStyle(smartFind(globalSettings, ['imageStyle']) || imageStyle);
      setCommonNote(smartFind(globalSettings, ['commonNote']) || commonNote);

      for (let i = 0; i < total; i++) {
        const item = importedData[i];
        const inputs = smartFind(item, ['inputs', 'data']) || {};
        
        const prodIndex = Math.floor(i / 4);
        if (prodIndex >= newProducts.length) break;

        const prod = newProducts[prodIndex];
        prod.name = smartFind(inputs, ['productName', 'name']) || prod.name;
        prod.usp = smartFind(inputs, ['usp', 'keyword']) || prod.usp;
        prod.background = smartFind(inputs, ['background', 'bối cảnh']) || prod.background;
        prod.action = smartFind(inputs, ['action', 'hành động']) || prod.action;

        if (!prod.script) prod.script = { v1: '', v2: '', v3: '', v4: '' };
        
        const sceneIdx = (i % 4) + 1;
        const key = `v${sceneIdx}`;
        
        prod.script[key] = smartFind(item, ['script', 'content', 'text']) || '';
        prod.images[key] = { 
          url: smartFind(item, ['outputImage', 'image', 'base64']) || '', 
          loading: false 
        };
        prod.videoPrompts[key] = { 
          text: smartFind(item, ['videoPrompt', 'prompt']) || '', 
          loading: false, 
          visible: true 
        };

        const percent = Math.round(((i + 1) / total) * 100);
        window.dispatchEvent(new CustomEvent('IMPORT_DATA_PROGRESS', { 
          detail: { percent, complete: i === total - 1 } 
        }));
        await new Promise(r => setTimeout(r, 50));
      }
      setProducts(newProducts);
    };

    window.addEventListener('REQUEST_EXPORT_DATA', handleExport);
    window.addEventListener('REQUEST_IMPORT_DATA', handleImport);
    return () => {
      window.removeEventListener('REQUEST_EXPORT_DATA', handleExport);
      window.removeEventListener('REQUEST_IMPORT_DATA', handleImport);
    };
  }, [products, gender, voice, addressing, imageStyle, commonNote]);

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Don't intercept if user is in a textarea or input (except our specific ones)
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'file')) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob && activeProductId) {
            handleFileChange(activeProductId, blob);
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [activeProductId, products]);

  const updateProduct = (id: number, updates: Partial<Shopee8sProduct>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const updateProductImage = (productId: number, imageKey: string, imgUpdates: Partial<GeneratedImage>) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      const newImages = { ...p.images };
      newImages[imageKey] = { ...(newImages[imageKey] || { url: '', loading: false }), ...imgUpdates };
      return { ...p, images: newImages };
    }));
  };

  const updateProductVideoPrompt = (productId: number, promptKey: string, promptUpdates: Partial<VideoPromptState>) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      const newPrompts = { ...p.videoPrompts };
      newPrompts[promptKey] = { ...(newPrompts[promptKey] || { text: '', loading: false, visible: false }), ...promptUpdates };
      return { ...p, videoPrompts: newPrompts };
    }));
  };

  const handleFileChange = (id: number, file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    updateProduct(id, { file, previewUrl: url });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, productId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
      handleFileChange(productId, files[0]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent, id: number) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          handleFileChange(id, blob);
        }
      }
    }
  };

  const removeProductImage = (id: number) => {
    updateProduct(id, { file: null, previewUrl: null });
  };

  const handleGenerateAll = async () => {
    const productsToGen = products.filter(p => p.file && p.name);
    if (productsToGen.length === 0) {
      alert("Vui lòng tải ảnh và nhập tên cho ít nhất một sản phẩm.");
      return;
    }

    setIsGlobalLoading(true);
    
    try {
      // Use bulk generation for better performance
      const bulkResults = await service.generateShopee8sScriptsBulk(
        productsToGen.map(p => ({ id: p.id, name: p.name, usp: p.usp })),
        voice,
        addressing,
        gender
      );

      setProducts(prev => prev.map(p => {
        const res = bulkResults.find(r => r.id === p.id);
        if (res) {
          const initialImages: any = {};
          const initialPrompts: any = {};
          ['v1', 'v2', 'v3', 'v4'].forEach(k => {
            initialImages[k] = { url: '', loading: false, customPrompt: '' };
            initialPrompts[k] = { text: '', loading: false, visible: false };
          });
          return {
            ...p,
            script: res.script,
            images: initialImages,
            videoPrompts: initialPrompts,
            isLoading: false
          };
        }
        return { ...p, isLoading: false };
      }));

    } catch (error) {
      console.error("Global generation error:", error);
      alert("Có lỗi xảy ra khi tạo kịch bản hàng loạt.");
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleGenerateScriptForProduct = async (productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product || !product.name) {
      alert("Vui lòng nhập tên sản phẩm.");
      return;
    }

    updateProduct(productId, { isLoading: true });
    try {
      const script = await service.generateShopee8sScript(product.name, product.usp, voice, addressing, gender);
      const initialImages: any = {};
      const initialPrompts: any = {};
      ['v1', 'v2', 'v3', 'v4'].forEach(k => {
        initialImages[k] = { url: '', loading: false, customPrompt: '' };
        initialPrompts[k] = { text: '', loading: false, visible: false };
      });
      updateProduct(productId, { 
        script, 
        images: initialImages, 
        videoPrompts: initialPrompts,
        isLoading: false 
      });
    } catch (error) {
      console.error("Single script error:", error);
      updateProduct(productId, { isLoading: false });
      alert("Lỗi khi tạo kịch bản.");
    }
  };

  const handleExtractOutfit = async () => {
    if (!outfitFile) return;
    setIsExtractingOutfit(true);
    try {
      const outfitPart = await service.fileToGenerativePart(outfitFile);
      const result = await service.extractOutfitImage(outfitPart);
      setProcessedOutfitUrl(result);
    } catch (error) {
      console.error("Lỗi trích xuất trang phục:", error);
    } finally {
      setIsExtractingOutfit(false);
    }
  };

  const handleGenImageForKey = async (productId: number, key: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || !product.file || !product.script) return;

    updateProductImage(productId, key, { loading: true, error: undefined });

    try {
      const imagePart = await service.fileToGenerativePart(product.file);
      const facePart = faceFile ? await service.fileToGenerativePart(faceFile) : null;
      const outfitPart = processedOutfitUrl ? { mimeType: 'image/png', data: processedOutfitUrl.split(',')[1] } : null;
      const isFollowUp = key === 'v2' || key === 'v4';
      
      const latestProductState = products.find(p => p.id === productId);
      const customP = latestProductState?.images[key]?.customPrompt || "";

      const charDesc = [
        product.action ? `Action: ${product.action}` : "",
        product.background ? `Background: ${product.background}` : "",
        commonNote, 
        customP
      ].filter(Boolean).join(". ");

      const imgUrl = await service.generateShopee8sImage(
        [imagePart], 
        product.name, 
        (product.script as any)[key], 
        charDesc,
        facePart,
        outfitPart,
        isFollowUp,
        imageStyle,
        gender
      );

      updateProductImage(productId, key, { url: imgUrl, loading: false });
    } catch (error) {
      console.error(error);
      updateProductImage(productId, key, { loading: false, error: 'Lỗi tạo ảnh' });
    }
  };

  const handleGenVideoPrompt = async (productId: number, key: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || !product.script) return;

    updateProductVideoPrompt(productId, key, { text: '', loading: true, visible: true });

    try {
      const productImagePart = product.file ? await service.fileToGenerativePart(product.file) : null;
      const customP = product.images[key]?.customPrompt || "";
      const noProductKeywords = ["không có sản phẩm", "xóa sản phẩm", "không xuất hiện sản phẩm", "bỏ sản phẩm", "không thấy sản phẩm", "no product", "remove product", "without product"];
      const isNoProduct = noProductKeywords.some(kw => customP.toLowerCase().includes(kw));

      const enhancedScript = product.action 
        ? `${(product.script as any)[key]} (Action hint: ${product.action})`
        : (product.script as any)[key];

      const prompt = await service.generateShopee8sVeoPrompt(
        product.name,
        enhancedScript,
        gender,
        voice,
        productImagePart?.data,
        product.images[key]?.url,
        isNoProduct,
        imageStyle
      );

      updateProductVideoPrompt(productId, key, { text: prompt, loading: false, visible: true });
    } catch (error) {
      updateProductVideoPrompt(productId, key, { text: 'Lỗi tạo prompt.', loading: false, visible: true });
    }
  };

  const handleBulkPromptForProduct = async (productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product || !product.script) return;

    updateProduct(productId, { isBulkPromptLoading: true });
    const keys = ['v1', 'v2', 'v3', 'v4'];
    for (const key of keys) {
        await handleGenVideoPrompt(productId, key);
    }
    updateProduct(productId, { isBulkPromptLoading: false });
  };

  const handleBulkImageForProduct = async (productId: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    updateProduct(productId, { isBulkImageLoading: true });
    const keys = ['v1', 'v2', 'v3', 'v4'];
    for (const key of keys) {
        await handleGenImageForKey(productId, key);
    }
    updateProduct(productId, { isBulkImageLoading: false });
  };

  const handleDownloadAllImagesZip = async () => {
    if (typeof JSZip === 'undefined') return;
    const zip = new JSZip();
    let sequenceIndex = 1;
    for (const product of products) {
      for (const key of ['v1', 'v2', 'v3', 'v4']) {
        const img = product.images[key];
        if (img?.url) {
          zip.file(`${String(sequenceIndex).padStart(2, '0')}.png`, img.url.split(',')[1], { base64: true });
          sequenceIndex++;
        }
      }
    }
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "shopee8s_images.zip";
    link.click();
  };

  const handleDownloadAllPromptsTxt = () => {
    let allPrompts = "";
    for (const product of products) {
      for (const key of ['v1', 'v2', 'v3', 'v4']) {
        const p = product.videoPrompts[key];
        if (p?.text) allPrompts += p.text.replace(/\n/g, ' ') + "\n";
      }
    }
    const blob = new Blob([allPrompts], { type: 'text/plain' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "shopee8s_prompts.txt";
    link.click();
  };

  const productsWithResults = products.filter(p => p.script);
  const hasResults = productsWithResults.length > 0;
  const hasAnyMedia = products.some(p => 
    (Object.values(p.images) as GeneratedImage[]).some(img => img.url) || 
    (Object.values(p.videoPrompts) as VideoPromptState[]).some(pr => pr.text)
  );

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
              Tạo Video 16s dùng Up lên nền tảng Shopee Video (1 kịch bản = 2 video 8s). Có thể tạo 5 sản phẩm = 10 kịch bản khác nhau (mỗi sản phẩm 2 kịch bản) hoặc tạo 10 kịch bản cho cùng 1 sản phẩm. 
              Lưu ý phần mô tả hành động của nhân vật với sản phẩm. VD sản phẩm to như ghế massage hoặc bàn ghế thì có thể mô tả là "nhân vật đựng cạnh sản phẩm". Phần Bối cảnh mô tả phù hợp với sản phẩm.  
            </p>
          </div>
        </div>
      </div>

      {/* Input Grid */}
      <div className="bg-white rounded-[1.5rem] border border-slate-200 p-8 shadow-sm space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {products.map((p) => (
              <div 
                tabIndex={0}
                onClick={() => setActiveProductId(p.id)}
                onPaste={(e) => handlePaste(e, p.id)}
                className={`flex flex-col rounded-[1rem] border-2 p-3 transition-all cursor-pointer group relative focus:ring-2 focus:ring-[#ff5722]/20 focus:outline-none ${
                  activeProductId === p.id 
                    ? 'border-[#ff5722] ring-1 ring-[#ff5722]/10 bg-white' 
                    : 'border-[#f1f5f9] bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                    activeProductId === p.id ? 'border-[#ff5722] bg-[#ff5722]' : 'border-slate-300 bg-white'
                  }`}>
                    {activeProductId === p.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <span className={`text-[11px] font-bold ${activeProductId === p.id ? 'text-[#ff5722]' : 'text-slate-500'}`}>
                    Sản phẩm {p.id}
                  </span>
                </div>

                <div 
                  onClick={(e) => { e.stopPropagation(); fileInputRefs.current[p.id]?.click(); }}
                  onPaste={(e) => handlePaste(e, p.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, p.id)}
                  className="aspect-[4/5] bg-[#f8fafc] rounded-lg border border-dashed border-slate-200 mb-3 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:bg-[#f1f5f9] relative"
                >
                {p.previewUrl ? (
                  <>
                    <img src={p.previewUrl} className="w-full h-full object-cover" alt={`p${p.id}`} />
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeProductImage(p.id); }}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black transition-colors z-10"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <div className="text-center p-2 opacity-40">
                    <svg className="w-8 h-8 mx-auto text-slate-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[10px] font-bold uppercase tracking-tighter">TẢI / PASTE ẢNH</span>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={el => { fileInputRefs.current[p.id] = el; }}
                  onChange={(e) => handleFileChange(p.id, e.target.files?.[0] || null)}
                  className="hidden" 
                  accept="image/*"
                />
              </div>

              <div className="space-y-2">
                <input 
                  type="text" 
                  value={p.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateProduct(p.id, { name: e.target.value })}
                  placeholder="Tên sản phẩm..."
                  className="w-full text-[11px] p-2 bg-white border border-slate-200 rounded-md outline-none focus:border-[#ff5722]/40 font-medium placeholder:text-slate-300"
                />
                <input 
                  type="text" 
                  value={p.usp}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateProduct(p.id, { usp: e.target.value })}
                  placeholder="USP (Keyword)..."
                  className="w-full text-[11px] p-2 bg-white border border-slate-200 rounded-md outline-none focus:border-[#ff5722]/40 font-medium placeholder:text-slate-300"
                />
                <input 
                  type="text" 
                  value={p.background}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateProduct(p.id, { background: e.target.value })}
                  placeholder="Bối cảnh (background)..."
                  className="w-full text-[11px] p-2 bg-white border border-slate-200 rounded-md outline-none focus:border-[#ff5722]/40 font-medium placeholder:text-slate-300"
                />
                <input 
                  type="text" 
                  value={p.action}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateProduct(p.id, { action: e.target.value })}
                  placeholder="Hành động với sp..."
                  className="w-full text-[11px] p-2 bg-white border border-slate-200 rounded-md outline-none focus:border-[#ff5722]/40 font-medium placeholder:text-slate-300"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); handleGenerateScriptForProduct(p.id); }}
                  disabled={p.isLoading || isGlobalLoading}
                  className={`w-full py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    p.isLoading 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : 'bg-[#ff5722] text-white hover:bg-[#e64a19] shadow-sm active:scale-95'
                  }`}
                >
                  {p.isLoading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                      ĐANG TẠO...
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14H11V21L20 10H13Z" />
                      </svg>
                      TẠO KỊCH BẢN
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Configuration Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block px-1">Giới tính nhân vật</label>
                    <select 
                      value={gender} 
                      onChange={e => setGender(e.target.value)} 
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-100 transition-all appearance-none"
                    >
                        <option value="Nữ">Nữ</option>
                        <option value="Nam">Nam</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block px-1">Phong cách ảnh</label>
                    <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 h-[46px]">
                      <button 
                        onClick={() => setImageStyle('Realistic')}
                        className={`flex-1 text-[10px] font-black uppercase rounded-lg transition-all ${imageStyle === 'Realistic' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        Chân thực
                      </button>
                      <button 
                        onClick={() => setImageStyle('3D')}
                        className={`flex-1 text-[10px] font-black uppercase rounded-lg transition-all ${imageStyle === '3D' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        3D
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block px-1">Giọng điệu vùng miền</label>
                  <select 
                    value={voice} 
                    onChange={e => setVoice(e.target.value)} 
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-100 transition-all"
                  >
                      {VOICE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block px-1">Cách xưng hô (Người nói - Người nghe)</label>
                  <div className="relative">
                    <input 
                      list="shopee-addressing-list"
                      value={addressing} 
                      onChange={e => setAddressing(e.target.value)}
                      placeholder="VD: em - các bác"
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-slate-100 transition-all"
                    />
                    <datalist id="shopee-addressing-list">
                      {ADDRESSING_OPTIONS.map(opt => <option key={opt} value={opt} />)}
                    </datalist>
                  </div>
                </div>
             </div>

             <div className="space-y-4">
               <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block px-1">0. Ảnh khuôn mặt mẫu (Dùng chung)</label>
                  <div className="flex gap-4">
                    <div 
                      tabIndex={0}
                      onClick={() => faceInputRef.current?.click()}
                      onPaste={(e) => {
                        const items = e.clipboardData.items;
                        for (let i = 0; i < items.length; i++) {
                          if (items[i].type.indexOf("image") !== -1) {
                            const blob = items[i].getAsFile();
                            if (blob) {
                              setFaceFile(blob);
                              setFacePreview(URL.createObjectURL(blob));
                            }
                          }
                        }
                      }}
                      className="w-24 h-24 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all overflow-hidden flex-shrink-0 group relative focus:ring-2 focus:ring-slate-200 focus:outline-none"
                    >
                      {facePreview ? (
                        <>
                          <img src={facePreview} className="w-full h-full object-cover" alt="Face preview" />
                          <button 
                            onClick={(e) => { e.stopPropagation(); setFaceFile(null); setFacePreview(null); }}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black transition-colors z-10"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <div className="text-slate-300 group-hover:text-slate-400">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                        </div>
                      )}
                      <input type="file" ref={faceInputRef} onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) { setFaceFile(f); setFacePreview(URL.createObjectURL(f)); }
                        }} className="hidden" accept="image/*" />
                    </div>
                    <div className="flex-1">
                      <textarea 
                        value={commonNote}
                        onChange={(e) => setCommonNote(e.target.value)}
                        placeholder="Ghi chú thêm về trang phục hoặc bối cảnh cho nhân vật..."
                        className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-100 outline-none resize-none transition-all placeholder:text-slate-400 font-medium"
                      />
                    </div>
                  </div>
               </div>

               <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block px-1">0. Ảnh trang phục (Dùng chung)</label>
                  <div className="flex gap-4">
                    <div 
                      tabIndex={0}
                      onClick={() => outfitInputRef.current?.click()}
                      onPaste={(e) => {
                        const items = e.clipboardData.items;
                        for (let i = 0; i < items.length; i++) {
                          if (items[i].type.indexOf("image") !== -1) {
                            const blob = items[i].getAsFile();
                            if (blob) {
                              setOutfitFile(blob);
                              setOutfitPreviewUrl(URL.createObjectURL(blob));
                            }
                          }
                        }
                      }}
                      className="w-24 h-24 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all overflow-hidden flex-shrink-0 group relative focus:ring-2 focus:ring-slate-200 focus:outline-none"
                    >
                      {outfitPreviewUrl ? (
                        <>
                          <img src={outfitPreviewUrl} className="w-full h-full object-cover" alt="Outfit preview" />
                          <button 
                            onClick={(e) => { e.stopPropagation(); setOutfitFile(null); setOutfitPreviewUrl(null); setProcessedOutfitUrl(null); }}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black transition-colors z-10"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <div className="text-slate-300 group-hover:text-slate-400">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                        </div>
                      )}
                      <input type="file" ref={outfitInputRef} onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) { setOutfitFile(f); setOutfitPreviewUrl(URL.createObjectURL(f)); }
                        }} className="hidden" accept="image/*" />
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                      <button 
                        onClick={handleExtractOutfit}
                        disabled={!outfitFile || isExtractingOutfit}
                        className="w-full py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isExtractingOutfit ? (
                          <>
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Đang tách nền...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            Tách nền trang phục
                          </>
                        )}
                      </button>
                      {processedOutfitUrl && (
                        <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                          <div className="w-8 h-8 rounded-lg overflow-hidden border border-emerald-200 bg-white flex-shrink-0">
                            <img src={processedOutfitUrl} className="w-full h-full object-contain" alt="Processed" />
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">Đã tách nền thành công</span>
                        </div>
                      )}
                    </div>
                  </div>
               </div>
             </div>
          </div>
        </div>

        <button 
          onClick={handleGenerateAll}
          disabled={isGlobalLoading || !products.some(p => p.file && p.name)}
          className="w-full py-5 bg-[#e2e8f0] text-[#64748b] font-black rounded-xl text-lg flex items-center justify-center gap-3 transition-all hover:bg-[#ff5722] hover:text-white hover:shadow-xl hover:shadow-[#ff5722]/10 disabled:opacity-50 disabled:cursor-not-allowed group active:scale-[0.99] uppercase"
        >
          {isGlobalLoading ? (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>ĐANG TẠO KỊCH BẢN BỘ...</span>
            </div>
          ) : "TẠO NỘI DUNG CHO CÁC SẢN PHẨM ĐÃ NHẬP"}
        </button>
      </div>

      {/* Results Section */}
      {hasResults && (
        <div className="mt-12 space-y-12 pb-12">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm flex justify-between items-center">
             <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">KẾT QUẢ KỊCH BẢN BỘ</h3>
                <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">
                  {productsWithResults.length} sản phẩm • {voice} • {addressing}
                </p>
             </div>
          </div>

          {productsWithResults.map((product) => (
            <div key={product.id} className="animate-fadeIn">
              <div className="flex items-center gap-3 mb-6 px-4">
                <div className="w-8 h-8 bg-[#ff5722] text-white rounded-full flex items-center justify-center font-black text-sm">
                  {product.id}
                </div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                   {product.name}
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* VIDEO 1 (16S) */}
                <div className="bg-[#fffcfb] rounded-[2rem] border-2 border-[#ff7043]/10 p-8 shadow-sm relative overflow-hidden">
                   <h3 className="text-lg font-black text-[#ff5722] uppercase tracking-tighter mb-6 flex items-center gap-2">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                     VIDEO 1 (16S)
                   </h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {['v1', 'v2'].map(key => (
                         <div key={key} className="space-y-4">
                           <ScriptSection 
                             title={key === 'v1' ? "Phần 1: Intro" : "Phần 2: Giới thiệu"} 
                             content={(product.script as any)[key]} 
                             color="border-[#ff5722]" 
                             onChange={(val) => {
                               const newScript = { ...product.script, [key]: val } as ScriptParts;
                               updateProduct(product.id, { script: newScript });
                             }} 
                             maxChars={180}
                           />
                           <ImageCard 
                             label={`Hình ảnh ${key.toUpperCase()}`} 
                             imageData={product.images[key] || { url: '', loading: false }} 
                             videoPrompt={(product.videoPrompts as any)?.[key] || { text: '', loading: false, visible: false }} 
                             onGeneratePrompt={() => handleGenVideoPrompt(product.id, key)} 
                             onRegenerate={() => handleGenImageForKey(product.id, key)} 
                             onTranslate={() => {}} 
                             onUpload={(file) => {
                               const reader = new FileReader();
                               reader.onload = (ev) => {
                                 updateProductImage(product.id, key, { url: ev.target?.result as string, loading: false });
                               };
                               reader.readAsDataURL(file);
                             }}
                             onDelete={() => {
                               updateProductImage(product.id, key, { url: '', loading: false });
                             }}
                             customPrompt={product.images[key]?.customPrompt || ""} 
                             onCustomPromptChange={(val) => {
                                updateProductImage(product.id, key, { customPrompt: val });
                             }} 
                           />
                         </div>
                      ))}
                   </div>
                </div>

                {/* VIDEO 2 (16S) */}
                <div className="bg-[#f5f8ff] rounded-[2rem] border-2 border-[#5c6bc0]/10 p-8 shadow-sm relative overflow-hidden">
                   <h3 className="text-lg font-black text-[#3f51b5] uppercase tracking-tighter mb-6 flex items-center gap-2">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 16l2.828-2.828M8 16L5.172 13.172M8 16L11 19M15 10a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                     VIDEO 2 (16S)
                   </h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {['v3', 'v4'].map(key => (
                         <div key={key} className="space-y-4">
                           <ScriptSection 
                             title={key === 'v3' ? "Phần 1: Góc nhìn" : "Phần 2: Giải pháp"} 
                             content={(product.script as any)[key]} 
                             color="border-[#3f51b5]" 
                             onChange={(val) => {
                               const newScript = { ...product.script, [key]: val } as ScriptParts;
                               updateProduct(product.id, { script: newScript });
                             }} 
                             maxChars={180}
                           />
                           <ImageCard 
                             label={`Hình ảnh ${key.toUpperCase()}`} 
                             imageData={product.images[key] || { url: '', loading: false }} 
                             videoPrompt={(product.videoPrompts as any)?.[key] || { text: '', loading: false, visible: false }} 
                             onGeneratePrompt={() => handleGenVideoPrompt(product.id, key)} 
                             onRegenerate={() => handleGenImageForKey(product.id, key)} 
                             onTranslate={() => {}} 
                             onUpload={(file) => {
                               const reader = new FileReader();
                               reader.onload = (ev) => {
                                 updateProductImage(product.id, key, { url: ev.target?.result as string, loading: false });
                               };
                               reader.readAsDataURL(file);
                             }}
                             onDelete={() => {
                               updateProductImage(product.id, key, { url: '', loading: false });
                             }}
                             customPrompt={product.images[key]?.customPrompt || ""} 
                             onCustomPromptChange={(val) => {
                                updateProductImage(product.id, key, { customPrompt: val });
                             }} 
                           />
                         </div>
                      ))}
                   </div>
                </div>
              </div>

              {/* Bulk Actions for Product */}
              <div className="flex justify-center mt-10 gap-4">
                <button 
                    onClick={() => handleBulkImageForProduct(product.id)} 
                    disabled={product.isBulkImageLoading}
                    className="px-10 py-4 bg-orange-600 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center gap-4 uppercase tracking-widest disabled:opacity-50"
                >
                    {product.isBulkImageLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                    )}
                    TỰ ĐỘNG TẠO TẤT CẢ ẢNH
                </button>
                <button 
                    onClick={() => handleBulkPromptForProduct(product.id)} 
                    disabled={product.isBulkPromptLoading}
                    className="px-10 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all text-sm flex items-center gap-4 uppercase tracking-widest disabled:opacity-50"
                >
                    {product.isBulkPromptLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14H11V21L20 10H13Z" /></svg>
                    )}
                    TỰ ĐỘNG VIẾT TẤT CẢ PROMPTS
                </button>
              </div>
            </div>
          ))}

          {/* Bulk Action Footer */}
          {hasAnyMedia && (
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 py-12 border-t border-slate-200 mt-12">
              <button 
                onClick={handleDownloadAllImagesZip}
                className="w-full md:w-auto px-12 py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-base"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Tải Toàn Bộ Ảnh (ZIP)
              </button>
              <button 
                onClick={handleDownloadAllPromptsTxt}
                className="w-full md:w-auto px-12 py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest text-base"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1.01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Tải Kịch Bản Video (.TXT)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Shopee8sModule;