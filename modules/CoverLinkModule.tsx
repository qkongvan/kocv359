import React, { useState, useEffect } from 'react';

const CoverLinkModule: React.FC = () => {
  const storageKey = "coverlink_project";
  const [state, setState] = useState({
    coverLinkInput: '',
    coverLinkNames: '',
    coverLinkUrls: '',
    coverLinkOutput: ''
  });

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setState(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  const handleSplit = () => {
    const lines = state.coverLinkInput.split(/\r?\n/);
    let names = ""; let urls = "";
    lines.forEach(line => {
      const httpIndex = line.lastIndexOf("http");
      if (httpIndex !== -1) {
          names += line.substring(0, httpIndex).trim().replace(/:$/, '') + "\n";
          urls += line.substring(httpIndex).trim() + "\n";
      } else {
          names += line.trim() + "\n";
          urls += "\n";
      }
    });
    setState(p => ({ ...p, coverLinkNames: names.trimEnd(), coverLinkUrls: urls.trimEnd() }));
  };

  const handleMerge = () => {
      const names = state.coverLinkNames.split(/\r?\n/);
      const urls = state.coverLinkUrls.split(/\r?\n/);
      let out = "";
      for (let i = 0; i < Math.max(names.length, urls.length); i++) {
          const n = names[i]?.trim(); const u = urls[i]?.trim();
          if (n && u) out += `${n}: ${u}\n`;
          else if (n || u) out += `${n || u}\n`;
      }
      setState(p => ({ ...p, coverLinkOutput: out.trimEnd() }));
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
                Công cụ hỗ trợ tách ghép chuyển đổi link Affiliate của người khác thành của Link của mình phục vụ việc rải link trên MXH (trên 5 link thì nên dùng)
                <br /> Truy cập <b>https://affiliate.shopee.vn/offer/custom_link</b> để chuyển đổi.<br />
                Tải xuống File mẫu <a href="https://drive.google.com/drive/folders/1e-X-fvGzHXbJvzw_Z_y45aG5mWFIcMWJ?usp=sharing" target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline">tại đây</a>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-6">
            <textarea value={state.coverLinkInput} onChange={e=>setState(p=>({...p, coverLinkInput: e.target.value}))} placeholder="Nhập text gốc (Tên: Link)" className="w-full h-48 p-4 border border-slate-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-orange-100 outline-none transition-all" />
            <button onClick={handleSplit} className="w-full py-4 bg-pink-600 text-white font-black rounded-xl uppercase tracking-widest shadow-lg hover:bg-pink-700 active:scale-[0.98] transition-all">1. Tách Link</button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase px-1">Danh sách tên</label>
                  <textarea value={state.coverLinkNames} onChange={e=>setState(p=>({...p, coverLinkNames: e.target.value}))} className="w-full h-64 border border-slate-200 rounded-xl p-3 font-mono text-sm focus:ring-2 focus:ring-slate-100 outline-none transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase px-1">Danh sách link</label>
                  <textarea value={state.coverLinkUrls} onChange={e=>setState(p=>({...p, coverLinkUrls: e.target.value}))} className="w-full h-64 border border-slate-200 rounded-xl p-3 font-mono text-sm focus:ring-2 focus:ring-slate-100 outline-none transition-all" />
                </div>
            </div>
            <button onClick={handleMerge} className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl uppercase tracking-widest shadow-lg hover:bg-indigo-700 active:scale-[0.98] transition-all">2. Ghép Link</button>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase px-1">Kết quả gộp</label>
              <textarea readOnly value={state.coverLinkOutput} className="w-full h-48 border border-slate-200 rounded-xl p-4 bg-slate-50 font-mono text-sm outline-none" />
            </div>
        </div>
    </div>
  );
};

export default CoverLinkModule;