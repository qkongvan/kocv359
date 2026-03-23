
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { ScriptParts } from "../types";
import { getAiClient } from "./keyService";

export const fileToGenerativePart = async (file: File) => {
  return new Promise<{ mimeType: string, data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({ mimeType: file.type, data: (reader.result as string).split(',')[1] });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const generateReview1kScript = async (
  imageParts: any[], 
  productName: string, 
  price: string,
  gender: string,
  voice: string,
  note: string
): Promise<ScriptParts> => {
  const ai = getAiClient();
  const dialect = voice === 'Miền Bắc' ? "Giọng Bắc (Hà Nội), dùng từ: nhé, ạ, đấy" : "Giọng Nam (Sài Gòn), dùng từ: nha, nè, hông";
  const prompt = `
    Tạo kịch bản TikTok Review Deal Sốc cho "${productName}". 
    Giá: "${price}". 
    Nhân vật: ${gender}, ${dialect}.
    Lưu ý: "${note}".
    Cấu trúc: v2 (Hook gây sốc), v3 (Review nhanh), v4 (CTA hối thúc). 
    Ngữ khí: kịch tính, tạo cảm giác hời cực độ. 
    Mỗi phần tối đa 180 ký tự. Tuyệt đối không vượt quá 180 ký tự.
    Trả về duy nhất JSON v2, v3, v4.
  `;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }, ...imageParts.slice(0, 3).map(p => ({ inlineData: p }))] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { v2: { type: Type.STRING }, v3: { type: Type.STRING }, v4: { type: Type.STRING } },
          required: ["v2", "v3", "v4"]
        },
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Script generation error", error);
    return { v2: '', v3: '', v4: '' };
  }
};

export const generateReview1kImage = async (
  referenceImageParts: any[], 
  facePart: any | null,
  productName: string, 
  scriptPart: string,
  charDesc: string,
  gender: string,
  userCustomPrompt?: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic'
): Promise<string> => {
  const ai = getAiClient();
  const is3D = imageStyle === '3D';
  
  const baseStyle = is3D 
    ? "3D Animation Pixar/Disney style, vibrant colors, expressive 3D character design, high-quality CGI."
    : "Photorealistic RAW PHOTO, 8k resolution, authentic textures, cinematic lighting.";

  const subject = facePart ? `Adult Vietnamese character from face provided, Gender: ${gender}` : `Adult Vietnamese ${gender}`;
  
  const characterFidelityRule = charDesc ? `
    CRITICAL CHARACTER FIDELITY:
    - The character MUST follow these specific appearance details: "${charDesc}". 
    - STICK TO THE DESCRIBED OUTFIT AND BODY TYPE.
    - Tuyệt đối giữ đúng trang phục và dáng người theo mô tả: "${charDesc}".
    ${is3D ? "- Translate these details into a cute and stylized 3D character design." : ""}
  ` : "";

  const prompt = `
    ${baseStyle} Aspect ratio 9:16. 
    
    CRITICAL VISUAL RULES (STRICT NO-TEXT POLICY):
    1. ABSOLUTELY NO TEXT, NO LETTERS, NO NUMBERS, NO CHARACTERS.
    2. NO ICONS, NO EMOJIS, NO GRAPHICS, NO UI ELEMENTS.
    3. The background must be CLEAN and FREE of signage or labels.
    4. ${is3D ? "Must look like a high-quality 3D CGI." : "Must look like a real photo."}
    
    CRITICAL RESTRICTIONS: 
    1. NO CHILDREN. The subject must be an adult.
    
    ${characterFidelityRule}
    
    STRICT PRODUCT FIDELITY (MANDATORY):
    - The product "${productName}" MUST MATCH the input reference image 1:1.
    - PRESERVE PATTERNS & TEXTURES exactly from the source photo.
    - LOCK the product appearance. Do not hallucinate details.
    ${is3D ? "- Render the product in a clean, polished 3D style that matches the character environment." : ""}

    SCENE: ${subject} reviewing the product. Action: "${scriptPart}". 
    ${userCustomPrompt || ""}
  `;
  
  const contents: any[] = [{ text: prompt }];
  if (facePart) contents.push({ inlineData: facePart });
  if (referenceImageParts.length > 0) contents.push({ inlineData: referenceImageParts[0] });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: { parts: contents },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return imgPart ? `data:image/png;base64,${imgPart.inlineData.data}` : "";
  } catch (error) {
    console.error("Image generation error", error);
    throw error;
  }
};

export const generateReview1kVeoPrompt = async (
  productName: string,
  scriptText: string,
  gender: string,
  voice: string,
  productImageBase64?: string,
  generatedImageBase64?: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic'
): Promise<string> => {
  const ai = getAiClient();
  const is3D = imageStyle === '3D';
  const voiceTag = voice === 'Miền Bắc' ? 'Northern Vietnamese' : 'Southern Vietnamese';
  const voiceGender = gender === 'Nữ' ? 'Female' : 'Male';
  
  const instructionPrompt = `
  Nhiệm vụ: Viết một lời nhắc (Prompt) chi tiết bằng Tiếng Anh (trừ lời thoại) để tạo video AI (VEO-3) dài 8 giây.
  PHONG CÁCH VIDEO: ${is3D ? "3D Animation / CGI Style" : "Photorealistic / Real Life Style"}.
  
  CẤU TRÚC PROMPT YÊU CẦU (TRẢ VỀ TRÊN 1 DÒNG DUY NHẤT):
  
  PHẦN 1: NHÂN VẬT & DIỆN MẠO: Mô tả nhân vật người Việt Nam tuổi 20-30. ${is3D ? "Phong cách hoạt hình 3D Pixar/Disney." : "Phong cách người thật chân thực."} Nếu có ảnh tham chiếu, giữ nguyên khuôn mặt và trang phục.
  PHẦN 2: HÀNH ĐỘNG: Nhân vật đang cầm sản phẩm "${productName}", biểu cảm kịch tính, hào hứng, khoe sản phẩm trước ống kính. Cử động môi khớp với kịch bản.
  PHẦN 3: BỐI CẢNH: Một không gian sạch sẽ, hiện đại hoặc studio chuyên nghiệp. ${is3D ? "Môi trường 3D sống động." : "Ánh sáng điện ảnh chân thực."}
  PHẦN 4: CHUYỂN ĐỘNG: Camera zoom nhẹ hoặc panning mượt mà, tỉ lệ 9:16. [Sản phẩm giữ nguyên tỷ lệ 1:1, không biến dạng].
  PHẦN 5: LỜI THOẠI: ✨ Model speaks in ${voiceTag} voice (${voiceGender}): "${scriptText}"
  PHẦN 6: CHẤT LƯỢT: 4K, ${is3D ? "3D Animation, Masterpiece CGI, 60fps" : "Realistic, Cinematic Lighting, Photorealistic, 60fps"}.

  YÊU CẦU ĐẦU RA: Chỉ trả về một đoạn văn bản duy nhất trên 1 dòng, không xuống dòng, không tiêu đề phần.
  `;

  const contents: any[] = [{ text: instructionPrompt }];
  if (productImageBase64) {
    contents.push({ inlineData: { mimeType: 'image/png', data: productImageBase64.split(',')[1] || productImageBase64 } });
  }
  if (generatedImageBase64) {
    contents.push({ inlineData: { mimeType: 'image/png', data: generatedImageBase64.split(',')[1] || generatedImageBase64 } });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents }
    });
    return response.text?.trim().replace(/\n/g, ' ') || "Không thể tạo prompt.";
  } catch (error) {
    return "Lỗi khi tạo prompt video.";
  }
};
