import { GoogleGenAI, Type } from "@google/genai";
import { getAiClient } from "./keyService";

export const fileToGenerativePart = async (file: File) => {
  return new Promise<{ mimeType: string, data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({ mimeType: file.type, data: (reader.result as string).split(',')[1] });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const hexToRgba = (hex: string, alpha: number) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const applyTextOverlay = async (
    imageUrl: string, 
    text: string, 
    position: 'Top' | 'Bottom' | 'Center',
    fontId: string = 'Montserrat',
    textColor: string = '#FFFFFF',
    userFontSize: number = 60,
    overlayColor: string = '#000000',
    alignment: 'left' | 'center' = 'center',
    showOverlay: boolean = true,
    overlayOpacity: number = 60
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(imageUrl); return; }

            ctx.drawImage(img, 0, 0);

            const scaleFactor = img.width / 1200;
            let baseFontSize = Math.floor(userFontSize * scaleFactor);
            
            let fontFamily = 'Montserrat, sans-serif';
            switch(fontId) {
              case 'Roboto': fontFamily = '"Roboto", sans-serif'; break;
              case 'Montserrat': fontFamily = '"Montserrat", sans-serif'; break;
              case 'Open Sans': fontFamily = '"Open Sans", sans-serif'; break;
              case 'Oswald': fontFamily = '"Oswald", sans-serif'; break;
              case 'Noto Sans': fontFamily = '"Noto Sans", sans-serif'; break;
              case 'Playfair Display': fontFamily = '"Playfair Display", serif'; break;
              case 'Lora': fontFamily = '"Lora", serif'; break;
              case 'Merriweather': fontFamily = '"Merriweather", serif'; break;
              case 'Pacifico': fontFamily = '"Pacifico", cursive'; break;
              case 'Dancing Script': fontFamily = '"Dancing Script", cursive'; break;
              case 'Lobster': fontFamily = '"Lobster", cursive'; break;
              case 'Charm': fontFamily = '"Charm", cursive'; break;
              case 'Mali': fontFamily = '"Mali", cursive'; break;
              case 'Patrick Hand': fontFamily = '"Patrick Hand", cursive'; break;
              case 'Baloo 2': fontFamily = '"Baloo 2", cursive'; break;
              case 'Comfortaa': fontFamily = '"Comfortaa", cursive'; break;
              case 'Quicksand': fontFamily = '"Quicksand", sans-serif'; break;
              case 'Josefin Sans': fontFamily = '"Josefin Sans", sans-serif'; break;
              case 'Archivo Black': fontFamily = '"Archivo Black", sans-serif'; break;
              case 'Saira Stencil One': fontFamily = '"Saira Stencil One", cursive'; break;
              case 'Noto Sans SC': fontFamily = '"Noto Sans SC", sans-serif'; break;
            }
            
            const fontWeight = ['Pacifico', 'Lobster', 'Archivo Black', 'Saira Stencil One'].includes(fontId) ? '' : '900';
            ctx.font = `${fontWeight} ${baseFontSize}px ${fontFamily}`;
            
            const spacing = Math.floor(baseFontSize * 0.05);
            if ('letterSpacing' in ctx) { (ctx as any).letterSpacing = `${spacing}px`; }

            const maxWidth = img.width * 0.92;
            const lineHeight = baseFontSize * 1.35;

            const wrapTextToLines = (txt: string): string[] => {
                const paragraphs = txt.split('\n');
                let allLines: string[] = [];

                paragraphs.forEach(para => {
                    const words = para.trim().split(' ');
                    if (words.length === 0 || (words.length === 1 && words[0] === '')) {
                        allLines.push("");
                        return;
                    }
                    let currentLine = words[0];

                    for (let i = 1; i < words.length; i++) {
                        const width = ctx.measureText(currentLine + " " + words[i]).width;
                        if (width < maxWidth) {
                            currentLine += " " + words[i];
                        } else {
                            allLines.push(currentLine);
                            currentLine = words[i];
                        }
                    }
                    allLines.push(currentLine);
                });
                return allLines;
            };

            const lines = wrapTextToLines(text);
            const totalTextHeight = lines.length * lineHeight;
            const paddingV = img.height * 0.08;
            const paddingH = img.width * 0.04;

            let startY = 0;
            if (position === 'Top') {
                startY = paddingV;
            } else if (position === 'Bottom') {
                startY = img.height - totalTextHeight - paddingV;
            } else { // Center
                startY = (img.height - totalTextHeight) / 2;
            }

            // --- VẼ LỚP PHỦ PHỦ TOÀN BỘ ẢNH (DYNAMC OPACITY) ---
            if (showOverlay) {
                ctx.fillStyle = hexToRgba(overlayColor, overlayOpacity / 100);
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // --- VẼ CHỮ ---
            ctx.fillStyle = textColor;
            ctx.textAlign = alignment === 'center' ? 'center' : 'left';
            ctx.textBaseline = 'middle';
            
            ctx.lineWidth = Math.max(3, baseFontSize * 0.12);
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            
            let currentY = startY + (lineHeight / 2);
            const x = alignment === 'center' ? img.width / 2 : paddingH;
            
            lines.forEach(line => {
               if (line !== "") {
                   ctx.strokeText(line, x, currentY);
                   ctx.fillText(line, x, currentY);
               }
               currentY += lineHeight;
            });

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(imageUrl);
        img.src = imageUrl;
    });
};

export const generateCarouselScript = async (
  topic: string, 
  imageCount: number, 
  notes: string, 
  productName: string,
  category: string, 
  subCategory: string, 
  storyIdea: string,
  gender: string = 'Nữ',
  addressing: string = ''
): Promise<string[]> => {
  const ai = getAiClient();

  const strategy = `CHIẾN LƯỢC: Tạo sự đồng cảm, khai thác Insight, hoặc kể chuyện cá nhân. NHÂN VẬT: Giới tính ${gender}.`;
  
  const categoryInstruction = category === "Giữ nguyên văn phong kịch bản" 
    ? "GIỮ NGUYÊN VĂN PHONG: Hãy tôn trọng tối đa văn phong và cách diễn đạt của người dùng trong Topic/Story, chỉ điều chỉnh độ dài để khớp với số slide và yêu cầu ký tự."
    : `DANH MỤC: ${category}${subCategory ? ` - ${subCategory}` : ""}. Hãy viết theo phong cách phù hợp với danh mục này.`;

  const prompt = `
    Tạo kịch bản cho ${imageCount} slide TikTok Carousel. 
    Topic: "${topic}". 
    Story: "${storyIdea}". 
    Pro: ${productName}. 
    Note: ${notes}. 
    ${strategy}
    ${categoryInstruction}
    
    XƯNG HÔ (BẮT BUỘC): Sử dụng cặp xưng hô "${addressing}" (Người nói - Người nghe).
    
    !!! YÊU CẦU ĐỘ DÀI NGHIÊM NGẶT !!!:
    - Mỗi slide BẮT BUỘC chỉ gồm 1 câu duy nhất.
    - Độ dài mỗi câu PHẢI nằm trong khoảng từ 60 đến 100 ký tự. 
    - Tuyệt đối không ngắn hơn 60 và không dài quá 100 ký tự.
    - Ngôn ngữ: Tiếng Việt chuẩn 100%, viral, súc tích.
    
    Trả về mảng JSON các chuỗi ký tự.
  `;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [{ text: prompt }] },
    config: { 
      responseMimeType: "application/json", 
      responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } 
    }
  });
  return JSON.parse(response.text || '[]');
};

export const generateCarouselImage = async (
  productImages: any[], 
  faceImage: any | null, 
  textContent: string,
  characterNote: string, 
  extraNote: string, 
  regenerateNote: string,
  fontFamily: string = "Montserrat", 
  textPosition: string = "Bottom",
  gender: string = 'Nữ',
  textColor: string = '#FFFFFF',
  overlayColor: string = '#000000',
  fontSize: number = 60,
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  alignment: 'left' | 'center' = 'center',
  showOverlay: boolean = true,
  overlayOpacity: number = 60
): Promise<string> => {
  const ai = getAiClient();
  const is3D = imageStyle === '3D';
  
  const baseStyle = is3D 
    ? "3D Animation Pixar/Disney style, vibrant colors, expressive 3D character design, high-quality CGI."
    : "Photorealistic RAW PHOTO, professional lifestyle commercial photography, cinematic lighting, 8k resolution.";

  const prompt = `
    TASK: Generate a high-quality ${is3D ? '3D Animation' : 'Photorealistic'} slide for TikTok Carousel (3:4 ratio).
    ${baseStyle}
    
    CONSISTENCY:
    - FACE: Match provided Face reference exactly.
    - GENDER: Adult Vietnamese ${gender}.
    - OUTFIT: ${characterNote}.
    - PRODUCT: Must match input reference image exactly.

    SUBJECT: A Vietnamese person in a lifestyle setting.
    VIBE: Matching the story: "${textContent}".
    SCENE: ${extraNote}. ${regenerateNote ? `Feedback: ${regenerateNote}` : ""}
    STRICT CONSTRAINT: NO TEXT IN IMAGE. 
  `;

  const parts: any[] = [{ text: prompt }];
  if (faceImage) parts.push({ inlineData: faceImage });
  productImages.forEach(p => parts.push({ inlineData: p }));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts },
      config: { imageConfig: { aspectRatio: "3:4" } }
    });
    
    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!imgPart) throw new Error("No image generated");
    
    const rawBase64 = `data:image/png;base64,${imgPart.inlineData.data}`;
    return await applyTextOverlay(rawBase64, textContent, textPosition as any, fontFamily, textColor, fontSize, overlayColor, alignment, showOverlay, overlayOpacity);
  } catch (error) {
    throw error;
  }
}