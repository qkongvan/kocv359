
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { ScriptParts } from "../types";
import { getAiClient } from "./keyService";

const cleanJsonResponse = (text: string) => {
  return text.replace(/```json|```/g, "").trim();
};

export const fileToGenerativePart = async (file: File) => {
  return new Promise<{ mimeType: string, data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({ mimeType: file.type, data: (reader.result as string).split(',')[1] });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Nhiệm vụ: Tách đôi chân trần từ ảnh tham chiếu, loại bỏ giày dép.
 * Giữ lại chi tiết hình xăm, sơn móng chân trên nền trắng.
 */
export const extractFootImage = async (footPart: any): Promise<string> => {
  const ai = getAiClient();
  const prompt = `
    TASK: Create a professional commercial photography shot of ONLY the human legs and feet.
    1. REMOVE all footwear: no shoes, no sandals, no socks. The feet MUST be completely bare.
    2. POSE: Straight standing posture, front view facing the camera directly.
    3. FIDELITY: Maintain the exact skin tone, anatomy, and special details like toenail polish and tattoos from the reference image.
    4. BACKGROUND: Pure white background (#FFFFFF).
    5. QUALITY: High resolution, 8k, sharp textures, clean edges, photorealistic.
  `;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: { parts: [{ text: prompt }, { inlineData: footPart }] }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!part) throw new Error("Fail");
    return `data:image/png;base64,${part.inlineData.data}`;
  } catch (error) {
    console.error("Error extracting foot image:", error);
    throw error;
  }
};

const FORBIDDEN_TERMS = `Facebook, Shopee, Lazada, Tiki, Zalo, QR, Sale sốc, Mua ngay, Cam kết.`;

const getVoiceDetailedInstruction = (voiceLabel: string) => {
  const mapping: Record<string, string> = {
    "Giọng Bắc 20-40 tuổi": "Northern Vietnamese (Hanoi) accent, energetic, fast-paced, cheerful, youthful vibe",
    "Giọng Nam 20-40 tuổi": "Southern Vietnamese (Saigon) accent, energetic, fast-paced, cheerful, youthful vibe",
    "Giọng Bắc 50-60 tuổi": "Northern Vietnamese accent, resonant, stable, authoritative",
    "Giọng Nam 50-60 tuổi": "Southern Vietnamese accent, resonant, stable, authoritative",
    "Giọng Bắc 60-80 tuổi": "Northern Vietnamese accent, raspy, hearty, rustic",
    "Giọng Nam 60-80 tuổi": "Southern Vietnamese accent, raspy, hearty, rustic"
  };
  return mapping[voiceLabel] || voiceLabel;
};

export const generateNonFaceScript = async (
  imageParts: any[], productName: string, keyword: string, scriptLayout: string, 
  gender: string, voice: string, addressing: string, sceneCount: number, targetAudience: string
): Promise<ScriptParts> => {
  const ai = getAiClient();
  const voiceDetail = getVoiceDetailedInstruction(voice);

  const prompt = `
    Bạn là chuyên gia marketing Giày dép. Hãy tạo kịch bản Voice-over cho sản phẩm "${productName}". 
    USP: "${keyword}". Layout: "${scriptLayout}". 
    Đặc điểm giọng đọc: ${voice} (${voiceDetail}). Tệp khách hàng: "${targetAudience || 'Đại chúng'}".
    
    YÊU CẦU: Chia thành đúng ${sceneCount} phần (v1..v${sceneCount}).
    ĐỘ DÀI NGHIÊM NGẶT: BẮT BUỘC TỪ 160 ĐẾN 180 KÝ TỰ mỗi phần. Tuyệt đối không vượt quá 180 ký tự và không ngắn hơn 160 ký tự. XƯNG HÔ: "${addressing}".
    Tập trung vào cảm giác đi êm chân, form dáng đẹp, phối đồ sang xịn.
    Không dùng từ cấm: ${FORBIDDEN_TERMS}
  `;

  const properties: Record<string, any> = {};
  const required: string[] = [];
  for (let i = 1; i <= sceneCount; i++) {
    const key = `v${i}`;
    properties[key] = { type: Type.STRING };
    required.push(key);
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }, ...imageParts.slice(0, 3).map(p => ({ inlineData: p }))] },
      config: { 
        responseMimeType: "application/json", 
        responseSchema: { type: Type.OBJECT, properties, required },
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return JSON.parse(cleanJsonResponse(response.text || '{}'));
  } catch (e) {
    return {};
  }
};

export const regenerateNonFaceScriptPart = async (
  imageParts: any[], productName: string, keyword: string, scriptPartKey: string,
  currentPartContent: string, fullScript: ScriptParts, gender: string, voice: string,
  addressing: string, targetAudience: string = ""
): Promise<string> => {
  const ai = getAiClient();
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const prompt = `Viết lại lời thoại TikTok cho giày "${productName}". Nội dung cũ: "${currentPartContent}". Tệp khách hàng: "${targetAudience}". Xưng hô: "${addressing}". Giọng: ${voiceDetail}. ĐỘ DÀI NGHIÊM NGẶT: BẮT BUỘC TỪ 160 ĐẾN 180 KÝ TỰ. Tuyệt đối không vượt quá 180 ký tự. Chỉ trả về text mới.`;
  try {
    const response = await ai.models.generateContent({ 
      model: "gemini-3-flash-preview", 
      contents: { parts: [{ text: prompt }, ...imageParts.slice(0, 3).map(p => ({ inlineData: p }))] },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return response.text?.trim() || currentPartContent;
  } catch (error) { return currentPartContent; }
};

export const generateFootwearImage = async (
  referenceImageParts: any[], 
  footReferencePart: any | null,
  productName: string,
  scriptPart: string, 
  userCustomPrompt: string | undefined, 
  imageStyle: 'Realistic' | '3D' = 'Realistic', 
  displayMode: 'no_foot' | 'beside_foot' | 'on_foot' = 'on_foot',
  backgroundNote: string = "",
  visualNote: string = "",
  backgroundReferencePart: any | null = null,
  productAngle: string = "",
  poseLabel: string = "",
  footDescription: string = ""
): Promise<string> => {
  const ai = getAiClient();
  const is3D = imageStyle === '3D';
  
  const baseStyle = is3D 
    ? "High-quality 3D Animation, Pixar character style, polished CGI, vibrant colors." 
    : "Ultra-realistic raw commercial photography, 8k resolution, cinematic lighting, sharp focus on footwear textures.";

  let specificEnvironment = backgroundNote || "High-end fashion retail store or modern home interior";
  let specificComposition = productAngle || "Eye-level professional footwear shot";

  if (poseLabel.includes("Sky View")) {
    specificEnvironment = "Clear blue sky with soft white clouds as the background. Low angle shot looking straight up.";
    specificComposition = "Extreme low angle view. The soles of the shoes are the main focus against the vast sky.";
  } else if (poseLabel.includes("POV Pavement") || poseLabel.includes("concrete")) {
    specificEnvironment = "Clean urban pavement or concrete ground with natural texture. Daylight.";
    specificComposition = "POV perspective, looking directly down at the feet from the wearer's point of view.";
  } else if (poseLabel.includes("Grass")) {
    specificEnvironment = "Lush green artificial grass or natural garden lawn. Soft sunlight.";
    specificComposition = "Low angle or eye-level sitting position on the grass.";
  }

  const physicsRules = `
    !!! CRITICAL PHYSICAL REALISM (MANDATORY) !!!:
    1. FLOOR CONTACT: The feet and shoes MUST be firmly planted on the ground surface. Use realistic "contact shadows" where the sole meets the floor.
    2. GRAVITY: Show natural weight distribution. If the person is standing, the heels and soles must look pressed against the floor.
    3. NO FLOATING: Absolutely no floating shoes or hovering feet. Everything must be grounded.
    4. ANATOMY: The connection between the legs, ankles, and feet must be anatomically correct.
    5. SKIN TEXTURE: Natural human skin texture for legs, with subtle micro-folds at the joints.
  `;

  const footIdentity = `
    FOOT CHARACTERISTICS: ${footDescription || "Clean, realistic human legs and feet"}. 
    ${footReferencePart ? "BẮT BUỘC: Sử dụng cấu trúc bàn chân và đặc điểm từ ảnh FOOT_REFERENCE đính kèm." : ""}
  `;

  let interactionRule = "";
  if (displayMode === 'on_foot') {
    interactionRule = `MANDATORY: A person is WEARING the ${productName} on their feet. Show the natural interaction between the skin and the shoe material.`;
  } else if (displayMode === 'beside_foot') {
    interactionRule = `Show the ${productName} placed neatly on the floor directly NEXT TO the person's feet.`;
  } else {
    interactionRule = "!!! STRICT RULE: PRODUCT ONLY. NO PEOPLE, NO FEET, NO LEGS. Show the shoes on a realistic surface.";
  }

  const visualRules = `
    - PRODUCT FIDELITY: The ${productName} MUST be 100% identical to the reference product images. Preserve patterns and materials.
    - NO TEXT: Strictly no text, labels, or watermarks.
    - COMPOSITION: ${specificComposition}.
    - POSE: ${poseLabel || "Natural stance"}.
  `;

  const prompt = `
    ${baseStyle} Aspect ratio 9:16.
    ${physicsRules}
    ${footIdentity}
    ${interactionRule}
    ${visualRules}
    ENVIRONMENT: ${backgroundReferencePart ? "Use background from BACKGROUND_REFERENCE." : specificEnvironment}.
    SCENE CONTEXT: "${scriptPart}". 
    ${visualNote ? `LAYOUT: ${visualNote}.` : ""}
    ${userCustomPrompt || ""}
  `;
  
  const contents: any[] = [{ text: prompt }];

  // Helper function to clean base64 data
  const cleanData = (part: any) => ({
    inlineData: {
      mimeType: part.mimeType,
      data: part.data.includes('base64,') ? part.data.split('base64,')[1] : part.data
    }
  });

  if (backgroundReferencePart) {
    contents.push({ text: "BACKGROUND_REFERENCE:" });
    contents.push(cleanData(backgroundReferencePart));
  }
  
  if (footReferencePart) {
    contents.push({ text: "FOOT_REFERENCE:" });
    contents.push(cleanData(footReferencePart));
  }

  if (referenceImageParts && referenceImageParts.length > 0) {
    contents.push({ text: "PRODUCT_REFERENCE_IMAGES:" });
    referenceImageParts.forEach(part => contents.push(cleanData(part)));
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts: contents },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!part) throw new Error("API did not return image data");
    return `data:image/png;base64,${part.inlineData.data}`;
  } catch (error) { 
    console.error("Error in generateFootwearImage:", error);
    throw error; 
  }
};

export const generateFootwearVeoPrompt = async (
  productName: string, 
  scriptText: string, 
  gender: string, 
  voice: string,
  displayMode: string,
  productImageData?: string,
  generatedImageBase64?: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic'
): Promise<string> => {
  const ai = getAiClient();
  const is3D = imageStyle === '3D';
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const voiceGender = gender === 'Nữ' ? 'Female' : 'Male';
  
  const interactionInstruction = displayMode === 'on_foot'
    ? `- Xuất hiện đôi chân đang đi đôi "${productName}" một cách tự nhiên, dồn trọng tâm và bước đi nhanh tự nhiên.`
    : displayMode === 'beside_foot'
    ? `- Sản phẩm "${productName}" đặt trên sàn, ngay cạnh đôi chân trần hoặc đang đi tất.`
    : `!!! TUYỆT ĐỐI KHÔNG CÓ NGƯỜI HAY CHÂN NGƯỜI XUẤT HIỆN TRONG VIDEO !!!`;

  const instructionPrompt = `
  Nhiệm vụ: Viết một lời nhắc (Prompt) chi tiết tạo video AI (VEO-3) dài 8 giây tập trung hoàn toàn vào SẢN PHẨM GIÀY DÉP.
  ${interactionInstruction}
  
  CẤU TRÚC PROMPT BẮT BUỘC:
  PHẦN 1: SẢN PHẨM & BỐI CẢNH. Mô tả sản phẩm "${productName}" ở chính giữa khung hình, sắc nét, giữ nguyên tỷ lệ 1:1, không biến dạng. ${is3D ? "3D Pixar Animation style." : "Cinematic Realistic style."} Bối cảnh đồng nhất với ảnh tham chiếu. Đảm bảo đế giày tiếp xúc thực tế với mặt sàn, có bóng đổ tiếp xúc rõ rệt.
  PHẦN 2: Tự sáng tạo hành động tự nhiên như đang ngắm nghía, trải nghiệm sản phẩm.
  PHẦN 3: CHUYỂN ĐỘNG CAMERA (9:16). Dolly in, Pan hoặc Zoom mượt mà vào chi tiết sản phẩm hoặc tracking theo nhân vật. Tuyệt đối không thay đổi bối cảnh và sản phẩm suốt 8s. 
  PHẦN 4: LỜI THOẠI (BẮT BUỘC THAM CHIẾU GIỌNG NÓI & ĐỘ TUỔI): 
  ✨ Model performs Voice-over with specific traits: "${voice}" (Technical specs: ${voiceDetail}). 
  Speaker Gender: ${voiceGender}. 
  Script content: "${scriptText}"

  PHẦN 5: CHẤT LƯỢNG KỸ THUẬT: 4K, 60fps, Cinematic Studio Lighting. 
  Tuyệt đối không có nhạc nền. Khung hình tại giây 8.0 phải giống hệt khung hình tại giây 6.5.
  Video là một cảnh quay liên tục duy nhất từ đầu đến cuối.
  
  YÊU CẦU: Trả về 1 dòng Tiếng Anh duy nhất (trừ phần lời thoại). Không xuống dòng.`;

  const contents: any[] = [{ text: instructionPrompt }];
  
  const cleanB64 = (b64: string) => b64.includes('base64,') ? b64.split('base64,')[1] : b64;

  if (productImageData) {
    contents.push({ inlineData: { mimeType: 'image/png', data: cleanB64(productImageData) } });
  }
  if (generatedImageBase64) {
    contents.push({ inlineData: { mimeType: 'image/png', data: cleanB64(generatedImageBase64) } });
  }

  try {
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: contents }
    });
    return response.text?.trim().replace(/\n/g, ' ') || "";
  } catch (error) {
    return "Error generating footwear video prompt.";
  }
};
