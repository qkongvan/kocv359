
import { GoogleGenAI, Type } from "@google/genai";
import { FashionScenarioPart } from "../types";
import { getAiClient } from "./keyService";

// Helper xử lý lỗi 429 Quota Exceeded với retry
const callWithRetry = async (fn: () => Promise<any>, retries = 2, delay = 4000) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      if (e.message?.includes("429") && i < retries) {
        console.warn(`Quota exceeded, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
};

export const fileToGenerativePart = async (file: File) => {
  return new Promise<{ mimeType: string, data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({ mimeType: file.type, data: (reader.result as string).split(',')[1] });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const describeOutfit = async (outfitPart: any): Promise<string> => {
  const ai = getAiClient();
  const prompt = `
    Analyze the CLOTHING in this image in extreme detail for a fashion AI generator.
    CRITICAL: Focus ONLY on the garments. IGNORE the model's face, body shape, or hair.
    Focus on: materials, colors, patterns, textures, and specific design details.
    Return a descriptive paragraph in English.
  `;

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }, { inlineData: outfitPart }] }
    }));
    return response.text?.trim() || "Stylish fashion outfit.";
  } catch (error) {
    return "Detailed fashion outfit.";
  }
};

/**
 * Tạo kịch bản bộ sưu tập chuyên nghiệp (6 phân cảnh)
 */
export const generateFashionScenario = async (
  outfitPreviews: string[],
  gender: string
): Promise<FashionScenarioPart[]> => {
  const ai = getAiClient();
  const prompt = `
    Bạn là một Fashion Creative Director chuyên nghiệp.
    Dựa trên việc xem xét ${outfitPreviews.length} bộ trang phục dành cho ${gender}, hãy tạo một kịch bản chụp ảnh (Storyboard) gồm đúng 6 phân cảnh (mỗi bộ trang phục sẽ xuất hiện trong 1-2 cảnh).
    
    YÊU CẦU CHO MỖI PHÂN CẢNH:
    1. Tư thế (Pose): Mô tả tư thế của người mẫu chuyên nghiệp, sang trọng. Tối đa 180 ký tự.
    2. Vibe/Bối cảnh: Không gian và ánh sáng phù hợp để làm nổi bật trang phục. Tối đa 180 ký tự.
    
    Trả về mảng JSON gồm 6 đối tượng { id: number, outfitIndex: number (0 to ${outfitPreviews.length - 1}), poseDescription: string (English), vibeDescription: string (Vietnamese) }.
  `;

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.NUMBER },
              outfitIndex: { type: Type.NUMBER },
              poseDescription: { type: Type.STRING },
              vibeDescription: { type: Type.STRING }
            },
            required: ["id", "outfitIndex", "poseDescription", "vibeDescription"]
          }
        }
      }
    }));
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Scenario gen failed", e);
    return [];
  }
};

export const generateFashionImage = async (
  facePart: any,
  outfitPart: any,
  outfitDescription: string,
  backgroundNotes: string,
  backgroundPart: any = null,
  charDesc: string = "",
  regenNote: string = "",
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  gender: string = 'Nữ',
  bodyTypePrompt: string = "",
  selectedActions: string[] = [],
  scenarioPart?: string
): Promise<string> => {
  const ai = getAiClient();
  const is3D = imageStyle === '3D';
  
  const baseStyle = is3D 
    ? "High-quality 3D Animation Pixar/Disney style, vibrant colors, expressive 3D character design, polished CGI, masterpiece."
    : "Photorealistic high-end commercial fashion photography, 8k resolution, authentic skin textures, cinematic lighting, professional studio setup.";

  const poseDescription = scenarioPart 
    ? `SPECIFIC POSE: ${scenarioPart}.`
    : selectedActions.length > 0 
      ? `POSE/ACTION: The model is ${selectedActions.join(', ')}.`
      : "POSE: Professional fashion model pose, confident stance.";

  const prompt = `
    STYLE: ${baseStyle} 
    RATIO: 9:16 aspect ratio.
    
    CRITICAL CHARACTER FIDELITY (PRIORITY #1 - 100% MANDATORY):
    - FACE & IDENTITY: You MUST use the EXACT facial features, bone structure, and eyes from the provided FACE REFERENCE image.
    - HAIRSTYLE: You MUST use the EXACT hairstyle, hair color, and hair texture from the provided FACE REFERENCE image. 1:1 match.
    - LOOK: The character MUST be an identical match to the person in the face reference image.
    - ETHNICITY: Vietnamese ${gender}.
    - BODY TYPE: ${bodyTypePrompt || "standard fit body"}.
    - PERSONALITY: ${charDesc}.

    ${poseDescription}

    STRICT OUTFIT RULES (PRIORITY #2):
    - OUTFIT: The character MUST wear the exact clothing: ${outfitDescription}. 
    - IMPORTANT: DO NOT use the face, body shape, or hair of the person in the OUTFIT REFERENCE image. Use ONLY the clothes from it.
    
    ENVIRONMENT: ${backgroundPart ? "Use EXACT background from BACKGROUND REF." : (backgroundNotes || "Minimalist fashion studio")}.
    
    MANDATORY: NO TEXT, NO LOGOS, NO WATERMARKS.
    ${regenNote ? `USER FEEDBACK: ${regenNote}` : ""}
  `;

  const contents: any[] = [
    { inlineData: facePart }, 
    { text: prompt },
    { inlineData: outfitPart }
  ];
  if (backgroundPart) contents.push({ inlineData: backgroundPart });

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: { parts: contents },
      config: { imageConfig: { aspectRatio: "9:16" } }
    }));

    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!imgPart) throw new Error("Image generation failed");
    return `data:image/png;base64,${imgPart.inlineData.data}`;
  } catch (e) { throw e; }
};

/**
 * Tạo Video Prompt theo đúng 5 đoạn cấu trúc yêu cầu
 */
export const generateFashionVeoPrompt = async (
  generatedImageBase64: string,
  backgroundNotes: string,
  charDesc: string = "",
  regenNote: string = "",
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  gender: string = 'Nữ',
  selectedActions: string[] = []
): Promise<string> => {
  const ai = getAiClient();
  const is3D = imageStyle === '3D';
  
  const actionsText = selectedActions.length > 0 
    ? `Hành động: ${selectedActions.join(', ')}.`
    : "Người mẫu sải bước và xoay người nhẹ nhàng.";

  const instructionPrompt = `
    Nhiệm vụ: Viết một video prompt chi tiết cho AI Video (VEO-3) dài 8 giây dựa trên hình ảnh đính kèm.
    PHONG CÁCH: ${is3D ? "3D Animation / CGI Style" : "Photorealistic / Real Life Style"}.

    BẮT BUỘC TUÂN THỦ CẤU TRÚC 5 ĐOẠN (VIẾT LIỀM MẠCH TRÊN 1 DÒNG DUY NHẤT):

    Đoạn 1: Nhân vật & bối cảnh. 
    Mô tả nhân vật chính là người Việt Nam, trang phục, ngoại hình, gương mặt và kiểu tóc phải KHỚP 100% VỚI HÌNH ẢNH THAM CHIẾU. Không gian xung quanh đồng nhất với ảnh.

    Đoạn 2: Hành động & tương tác. 
    Mô tả nhân vật thực hiện hành động: "${actionsText}". Tuyệt đối không xuất hiện hoặc tự ý thêm vào các sản phẩm khác. Nhân vật phải được giữ nguyên diện mạo (gương mặt, kiểu tóc) xuyên suốt video.

    Đoạn 3: Góc quay & chuyển động máy. 
    Dựa trên hành động "${actionsText}", tạo ra các góc quay (như Zoom, Pan, Dolly) và chuyển động của nhân vật tương ứng phù hợp để tôn vinh bộ trang phục.

    Đoạn 4: Hậu cảnh & đạo cụ. 
    Mô tả chi tiết không gian background: ${backgroundNotes || "Minimalist fashion studio"}. Đảm bảo hậu cảnh tĩnh lặng, tập trung vào nhân vật.

    Đoạn 5: Thông số kỹ thuật. 
    Tỉ lệ 9:16, độ phân giải 4K, phong cách ${is3D ? "3D Animation Masterpiece, CGI" : "chân thực, ánh sáng điện ảnh chuyên nghiệp (Cinematic Lighting)"}, 60fps.

    YÊU CẦU ĐẦU RA: Trả về 1 đoạn văn bản Tiếng Anh duy nhất trên một dòng.
  `;

  const imagePart = {
    inlineData: {
      mimeType: 'image/png',
      data: generatedImageBase64.split(',')[1] || generatedImageBase64
    }
  };

  try {
    const response = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [imagePart, { text: instructionPrompt }] }
    }));
    return response.text?.trim().replace(/\n/g, ' ') || "Error creating video prompt.";
  } catch (e) { return "Error creating video prompt."; }
};
