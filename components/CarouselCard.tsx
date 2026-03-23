import React from 'react';
import { CarouselItem } from '../types';

interface CarouselCardProps {
  item: CarouselItem;
  onTextChange: (id: number, text: string) => void;
  onGenerate: (id: number) => void;
  onRegenerate: (id: number) => void;
  onNoteChange: (id: number, text: string) => void;
  onPositionChange: (id: number, pos: 'Top' | 'Bottom' | 'Center') => void;
  onAlignmentChange: (id: number, align: 'left' | 'center') => void;
  onColorChange: (id: number, color: string) => void;
  onOverlayColorChange: (id: number, color: string) => void;
  onOverlayOpacityChange: (id: number, opacity: number) => void;
  onToggleOverlay: (id: number, show: boolean) => void;
  onApplyStyleToAll: (style: Partial<CarouselItem>) => void;
  onFontSizeChange: (id: number, size: number) => void;
}

const CarouselCard: React.FC<CarouselCardProps> = ({ 
  item, 
  onTextChange, 
  onGenerate, 
  onRegenerate,
  onNoteChange,
  onPositionChange,
  onAlignmentChange,
  onColorChange,
  onOverlayColorChange,
  onOverlayOpacityChange,
  onToggleOverlay,
  onApplyStyleToAll,
  onFontSizeChange
}) => {
  const positions: ('Top' | 'Bottom' | 'Center')[] = ['Top', 'Bottom', 'Center'];
  const alignments: { value: 'left' | 'center', label: string }[] = [
    { value: 'center', label: 'Giữa' },
    { value: 'left', label: 'Trái' }
  ];
  const charCount = item.content.length;
  const isValid = charCount >= 60 && charCount <= 180;

  const handleApplyAll = () => {
    onApplyStyleToAll({
      textPosition: item.textPosition,
      alignment: item.alignment,
      textColor: item.textColor,
      fontSize: item.fontSize,
      overlayColor: item.overlayColor,
      overlayOpacity: item.overlayOpacity,
      showOverlay: item.showOverlay
    });
  };

  return (
    <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full group transition-all hover:shadow-md">
      {/* Header */}
      <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
         <span className="font-black text-[10px] text-slate-500 uppercase tracking-tighter">Slide #{item.id}</span>
         {item.loading && (
           <div className="flex items-center gap-1.5">
             <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce"></div>
             <span className="text-[10px] text-pink-600 font-black animate-pulse uppercase">Đang xử lý...</span>
           </div>
         )}
      </div>

      <div className="p-5 flex flex-col gap-5 flex-1">
         {/* Text Content Input */}
         <div className="space-y-1.5">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung chữ trên ảnh</label>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full transition-all ${
                  isValid 
                  ? 'bg-green-100 text-green-700' 
                  : charCount > 180 || (charCount > 0 && charCount < 60)
                    ? 'bg-red-100 text-red-600'
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {charCount}/180
                </span>
              </div>
            </div>
            <textarea
               className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:ring-4 focus:ring-orange-50 focus:border-orange-400 outline-none resize-none transition-all leading-relaxed"
               rows={3}
               value={item.content}
               onChange={(e) => onTextChange(item.id, e.target.value)}
               placeholder="Nhập nội dung slide (Bắt buộc 60-180 ký tự)..."
            />
         </div>

         {/* Image Area */}
         <div className="relative aspect-[3/4] bg-slate-100 rounded-[24px] overflow-hidden border border-slate-100 group">
            {item.imageUrl ? (
               <img src={item.imageUrl} alt={`Slide ${item.id}`} className="w-full h-full object-cover" />
            ) : (
               <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-slate-300">
                  {item.loading ? (
                     <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                     <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm">
                           <svg className="w-7 h-7 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Ready to Gen</span>
                     </div>
                  )}
               </div>
            )}
         </div>

         {/* Per-Slide Config */}
         <div className="space-y-4 pt-2">
            {/* --- NÚT ÁP DỤNG TẤT CẢ TỔNG HỢP --- */}
            <button 
                onClick={handleApplyAll}
                className="w-full py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2"
                title="Áp dụng Vị trí, Căn lề, Màu chữ, Kích cỡ và Lớp phủ này cho tất cả slide"
            >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Áp dụng cho tất cả
            </button>

            <div className="space-y-1.5 px-1 pt-2 border-t border-slate-100">
              <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Mô tả hình ảnh & Chỉnh sửa</label>
              <textarea
                  value={item.regenerateNote}
                  onChange={(e) => onNoteChange(item.id, e.target.value)}
                  placeholder="VD: Đổi bối cảnh, nhân vật đang cười, thêm sản phẩm..."
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 outline-none resize-none font-bold bg-slate-50 focus:bg-white transition-all shadow-inner"
                  rows={5}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 px-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Vị trí (Pos)</label>
                <div className="grid grid-cols-1 gap-1">
                  {positions.map((pos) => (
                    <button
                      key={pos}
                      onClick={() => onPositionChange(item.id, pos)}
                      className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border-2 ${
                        item.textPosition === pos 
                          ? 'border-orange-500 bg-orange-50 text-orange-600' 
                          : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2 px-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Căn lề (Align)</label>
                <div className="grid grid-cols-1 gap-1">
                  {alignments.map((align) => (
                    <button
                      key={align.value}
                      onClick={() => onAlignmentChange(item.id, align.value)}
                      className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border-2 ${
                        (item.alignment || 'center') === align.value 
                          ? 'border-blue-500 bg-blue-50 text-blue-600' 
                          : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      {align.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 px-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Màu chữ</label>
                  <div className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: item.textColor }}></div>
                </div>
                <div className="relative h-10 w-full rounded-xl overflow-hidden border-2 border-slate-100 hover:border-slate-200 transition-all">
                  <input 
                    type="color" 
                    value={item.textColor}
                    onChange={(e) => onColorChange(item.id, e.target.value)}
                    className="absolute inset-0 w-full h-full p-0 border-none cursor-pointer scale-[2]"
                  />
                </div>
              </div>

              <div className="space-y-2 px-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Kích cỡ (px)</label>
                <input 
                  type="number" 
                  value={item.fontSize}
                  min={20}
                  max={200}
                  onChange={(e) => onFontSizeChange(item.id, parseInt(e.target.value) || 60)}
                  className="w-full h-10 px-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold text-slate-700 focus:border-orange-400 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2 px-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Lớp phủ ({item.overlayOpacity || 60}%)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={item.showOverlay !== false} 
                    onChange={(e) => onToggleOverlay(item.id, e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <div className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: item.overlayColor }}></div>
                </div>
              </div>
              <div className="flex gap-2">
                <div className={`relative h-10 flex-1 rounded-xl overflow-hidden border-2 transition-all ${item.showOverlay === false ? 'opacity-50 grayscale border-slate-100' : 'border-slate-100 hover:border-slate-200'}`}>
                  <input 
                    type="color" 
                    value={item.overlayColor}
                    disabled={item.showOverlay === false}
                    onChange={(e) => onOverlayColorChange(item.id, e.target.value)}
                    className="absolute inset-0 w-full h-full p-0 border-none cursor-pointer scale-[2] disabled:cursor-not-allowed"
                  />
                </div>
                <div className={`relative h-10 w-20 rounded-xl overflow-hidden border-2 transition-all ${item.showOverlay === false ? 'opacity-50 grayscale border-slate-100' : 'border-slate-100 hover:border-slate-200'}`}>
                  <input 
                    type="number" 
                    min={0}
                    max={100}
                    value={item.overlayOpacity || 60}
                    disabled={item.showOverlay === false}
                    onChange={(e) => onOverlayOpacityChange(item.id, parseInt(e.target.value) || 0)}
                    className="w-full h-full px-2 text-center text-xs font-bold text-slate-700 outline-none disabled:cursor-not-allowed bg-white"
                  />
                </div>
              </div>
            </div>
         </div>

         {/* Actions */}
         <div className="mt-auto pt-2 flex flex-col gap-2">
            {!item.imageUrl ? (
               <button
                  onClick={() => onGenerate(item.id)}
                  disabled={item.loading || !item.content.trim()}
                  className={`w-full py-4 rounded-2xl text-xs font-black transition-all uppercase tracking-widest shadow-xl ${
                     item.loading || !item.content.trim()
                     ? 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100 shadow-none'
                     : 'bg-slate-100 text-slate-400 hover:bg-slate-900 hover:text-white border border-slate-200'
                  }`}
               >
                  TẠO ẢNH SLIDE
               </button>
            ) : (
               <button
                  onClick={() => onRegenerate(item.id)}
                  disabled={item.loading}
                  className="w-full py-4 bg-slate-900 text-white hover:bg-black font-black rounded-2xl text-xs transition-all uppercase tracking-widest shadow-lg active:scale-95"
               >
                  VẼ LẠI ẢNH
               </button>
            )}
         </div>
         
         {item.error && <p className="text-[10px] text-red-500 font-black text-center bg-red-50 py-2 rounded-xl border border-red-100 px-3">{item.error}</p>}
      </div>
    </div>
  );
};

export default CarouselCard;