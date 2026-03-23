
import { GoogleGenAI, Type } from "@google/genai";
import { ScriptParts, ScriptPartKey, PovScriptSegment } from "../types";
import { getAiClient } from "./keyService";

interface GenerativePart {
  mimeType: string;
  data: string;
}

export const fileToGenerativePart = async (file: File): Promise<GenerativePart> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({ mimeType: file.type, data: base64Data });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const generateTikTokScript = async (
  imageParts: GenerativePart[], 
  productName: string,
  keyword: string,
  scriptTone: string,
  productSize: string,
  scriptNote: string,
  scriptLayout: string,
  moduleMode: 'koc' | 'review1k' | 'shopee8s' | 'coverlink' | 'carousel' | 'videopov',
  gender: string = 'Nữ',
  voice: string = 'Miền Bắc'
): Promise<ScriptParts> => {
  if (moduleMode === 'coverlink' || moduleMode === 'carousel' || moduleMode === 'videopov') {
    return { v1: '', v2: '', v3: '', v3_5: '', v4: '' };
  }
  const ai = getAiClient();
  const modelId = "gemini-3-flash-preview";
  const voiceDetail = voice === 'Miền Bắc' ? "Chuẩn giọng Hà Nội (Miền Bắc)" : "Chuẩn giọng Sài Gòn (Miền Nam)";
  const genderDetail = gender === 'Nam' ? "giọng nam" : "giọng nữ";
  const toneInstruction = `Nhân vật: ${genderDetail}, ${voiceDetail}. Phong cách: ${scriptTone || "nhanh, kịch tính"}`;
  const sizeInfo = productSize ? `Kích thước: "${productSize}"` : "";
  const noteInstruction = scriptNote ? `LƯU Ý: "${scriptNote}"` : "";
  const forbiddenWords = `TUYỆT ĐỐI KHÔNG DÙNG: Facebook, Shopee, Lazada, Tiki, Zalo, Sale sốc, Mua ngay, Cam kết.`;

  const prompt = `Tạo kịch bản TikTok viral cho "${productName}". USP: "${keyword}". ${sizeInfo} ${noteInstruction} Xưng "em", gọi "anh chị". ${voiceDetail}. ${forbiddenWords} Tối đa 180 ký tự mỗi phần. Tuyệt đối không vượt quá 180 ký tự.`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: [{ text: prompt }, ...imageParts.map(p => ({ inlineData: p }))] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            v1: { type: Type.STRING },
            v2: { type: Type.STRING },
            v3: { type: Type.STRING },
            v3_5: { type: Type.STRING },
            v4: { type: Type.STRING },
          },
          required: ["v1", "v2", "v3", "v3_5", "v4"]
        }
      }
    });
    return response.text ? JSON.parse(response.text) : { v1: '', v2: '', v3: '', v3_5: '', v4: '' };
  } catch (error) { throw error; }
};

export const generateScenarioImage = async (
  referenceImageParts: GenerativePart[],
  faceImagePart: GenerativePart | null,
  productName: string,
  keyword: string,
  scriptPart: string,
  partKey: ScriptPartKey,
  productSize: string,
  characterDescription: string,
  userCustomPrompt?: string,
  moduleMode: 'koc' | 'review1k' | 'shopee8s' | 'coverlink' | 'carousel' | 'videopov' = 'koc',
  gender: string = 'Nữ'
): Promise<string> => {
  const ai = getAiClient();
  const modelId = "gemini-3.1-flash-image-preview";
  const subjectDescription = faceImagePart 
    ? `Character based on the face provided. Gender: ${gender}. Vietnamese.`
    : `Subject: A young Vietnamese ${gender}. ${characterDescription}`;

  const prompt = `Photorealistic 9:16. ${subjectDescription}. Action matches: "${scriptPart}". Product: ${productName} visible. Cinematic, 8k, clean. NO TEXT. ${userCustomPrompt || ""}`;

  const parts: any[] = [{ text: prompt }];
  if (faceImagePart) parts.push({ inlineData: faceImagePart });
  if (referenceImageParts.length > 0) parts.push({ inlineData: referenceImageParts[0] });

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Fail");
  } catch (error) { throw error; }
};

export const generateVeoPrompt = async (
  referenceImageParts: GenerativePart[],
  productName: string,
  keyword: string,
  scriptText: string,
  partKey: ScriptPartKey,
  productSize: string,
  scriptTone: string,
  characterDescription: string,
  moduleMode: 'koc' | 'review1k' | 'shopee8s' | 'coverlink' | 'carousel' | 'videopov' = 'koc',
  gender: string = 'Nữ',
  voice: string = 'Miền Bắc'
): Promise<string> => {
  const ai = getAiClient();
  const modelId = "gemini-3-flash-preview";
  const prompt = `VEO-3 prompt. Character: Vietnamese ${gender}, voice ${voice}. Product: ${productName}. Scene: ${scriptText}. Photorealistic.`;
  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: [{ text: prompt }] },
      config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING } } } }
    });
    return response.text ? JSON.parse(response.text).prompt : "Error";
  } catch (error) { return "Error"; }
};

export const translateText = async (text: string): Promise<string> => text;

export const generateCarouselScript = async (
  topic: string,
  imageCount: number,
  notes: string,
  productName: string,
  category: string,
  subCategory: string,
  storyIdea: string
): Promise<string[]> => {
  const ai = getAiClient();
  const modelId = "gemini-3-flash-preview";
  const strategyNote = `
    CHIẾN LƯỢC: Tạo sự đồng cảm (Vulnerability), khai thác Insight (nỗi sợ/lo lắng), hoặc kể chuyện cá nhân.
    Nếu là "Daily content": tạo sự bền bỉ, thu hút những người muốn làm nhưng chưa làm.
    Nội dung phải có quan điểm cá nhân rõ ràng.
  `;
  const prompt = `
    Tạo kịch bản ${imageCount} slide cho TikTok Ảnh cuộn (Carousel).
    Chủ đề chính: "${topic}". 
    Ý tưởng câu chuyện: "${storyIdea}".
    Danh mục: ${category} - ${subCategory}.
    Tên sản phẩm (nếu có): ${productName}.
    Ghi chú thêm: ${notes}.
    ${strategyNote}
    YÊU CẦU: Mỗi slide là 1 câu ngắn gọn, súc tích, gây ấn tượng mạnh, phù hợp để chèn lên ảnh. Tối đa 180 ký tự mỗi slide. Tuyệt đối không vượt quá 180 ký tự.
    Ngôn ngữ: Tiếng Việt chính xác 100% chính tả, ngữ pháp.
    Trả về mảng JSON các chuỗi ký tự.
  `;
  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    });
    return response.text ? JSON.parse(response.text) : [];
  } catch (error) { throw error; }
};

export const generateCarouselImage = async (
  productImages: GenerativePart[],
  faceImage: GenerativePart | null,
  textContent: string,
  characterNote: string,
  extraNote: string,
  regenerateNote: string
): Promise<string> => {
  const ai = getAiClient();
  const modelId = "gemini-3.1-flash-image-preview";
  
  const prompt = `
    TASK: Generate a Photorealistic TikTok Carousel Slide (3:4 ratio, 1200x1600).
    SUBJECT: A Vietnamese character holding the product in their hands. 
    Character details: ${characterNote}.
    Expression: Emotionally matching the content: "${textContent}".
    Vibe: High-end lifestyle photography, cinematic lighting, 8k sharp.

    MANDATORY TEXT OVERLAY SPECIFICATIONS:
    - Text to overlay: "${textContent}"
    - Font Style: Montserrat Bold, large, thick, and highly readable.
    - LANGUAGE: VIETNAMESE (100% ACCURATE SPELLING AND DIACRITICS).
    - CRITICAL ACCENTS: Check accurately for "huyền (à)", "sắc (á)", "hỏi (ả)", "ngã (ã)", "nặng (ạ)". 
    - Text Placement: Place text in Top-Center, Bottom-Center, or Corners.
    - RULE: THE TEXT MUST NOT OVERLAP THE CHARACTER'S FACE OR THE PRODUCT.
    - Spelling check: Double-check that "${textContent}" is written EXACTLY with correct Vietnamese marks.

    Context: ${extraNote}
    ${regenerateNote ? `User feedback for improvement: ${regenerateNote}` : ""}
  `;

  const parts: any[] = [{ text: prompt }];
  if (faceImage) parts.push({ inlineData: faceImage });
  productImages.forEach(p => parts.push({ inlineData: p }));

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config: { imageConfig: { aspectRatio: "3:4" } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image generated.");
  } catch (error) { throw error; }
};

export const analyzeVideoContent = async (videoFile: File): Promise<string> => { return ""; };
export const generatePovScriptSegments = async (a: string, s: string, c: number): Promise<PovScriptSegment[]> => { return []; };
export const generatePovImage = async (s: string, f: GenerativePart | null): Promise<string> => { return ""; };
export const generatePovVeoPrompt = async (i: string, s: string): Promise<string> => { return ""; };
