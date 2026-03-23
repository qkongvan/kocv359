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

const FORBIDDEN_TERMS = `
  Facebook, Shopee, Lazada, Tiki, Zalo, QR, Chuyển khoản, Fanpage, Địa Chỉ, Số điện thoại, Có 1 không 2,
  Em đang có, Xem này, Mã giảm sâu, Voucher, Tiktok, dành riêng, ưu đãi, dành riêng, quà tặng, duy nhất, triân, nhé, nha, thế chứ.
`;

const getVoiceDetailedInstruction = (voiceLabel: string) => {
  const mapping: Record<string, string> = {
    "Giọng Bắc 20-40 tuổi": "20-40 years old, Northern Vietnamese (Hanoi) accent, energetic, fast-paced, cheerful, high pitch, youthful vibe",
    "Giọng Nam 20-40 tuổi": "20-40 years old, Southern Vietnamese (Saigon) accent, energetic, fast-paced, cheerful, high pitch, youthful vibe",
    "Giọng Bắc 50-60 tuổi": "50-60 years old, Northern Vietnamese accent, middle-aged, deep, resonant, stable, authoritative and trustworthy",
    "Giọng Nam 50-60 tuổi": "50-60 years old, Southern Vietnamese accent, middle-aged, deep, resonant, stable, authoritative and trustworthy",
    "Giọng Bắc 60-80 tuổi": "60-80 years old, Northern Vietnamese accent, elderly, slightly raspy, hearty, rustic, slow and emotional",
    "Giọng Nam 60-80 tuổi": "60-80 years old, Southern Vietnamese accent, elderly, slightly raspy, hearty, rustic, slow and emotional"
  };
  return mapping[voiceLabel] || voiceLabel;
};

/**
 * Tạo kịch bản TikTok tập trung vào sản phẩm (Voice-over style).
 */
export const generateNonFaceScript = async (
  imageParts: any[], 
  productName: string, 
  keyword: string, 
  scriptLayout: string, 
  gender: string, 
  voice: string,
  addressing: string,
  sceneCount: number,
  targetAudience: string
): Promise<ScriptParts> => {
  const ai = getAiClient();
  const voiceDetail = getVoiceDetailedInstruction(voice);

  const prompt = `
    Trong vai 1 Creator chuyên nghiệp, hãy tạo kịch bản bán hàng (Voice-over) cho sản phẩm "${productName}". 
    USP: "${keyword}". 
    Bố cục: "${scriptLayout}". 
    NHÂN VẬT VOICE-OVER: Giới tính ${gender}, Đặc điểm giọng nói: ${voice} (${voiceDetail}).
    
    !!! TỆP KHÁCH HÀNG: "${targetAudience || 'Đại chúng'}" !!!
    => YÊU CẦU: Kịch bản thuần lời dẫn (Voice-over), tập trung hoàn toàn vào lợi ích và trải nghiệm sản phẩm.
    
    YÊU CẦU: Đúng ${sceneCount} phần (v1..v${sceneCount}).
    
    !!! QUY TẮC ĐỘ DÀI NGHIÊM NGẶT !!!:
    Mỗi phần kịch bản (v1, v2...) BẮT BUỘC PHẢI CÓ ĐỘ DÀI TỪ 160 ĐẾN 180 KÝ TỰ. 
    - Tuyệt đối KHÔNG ĐƯỢC DÀI HƠN 180 ký tự và KHÔNG ĐƯỢC NGẮN HƠN 160 ký tự.
    XƯNG HÔ (BẮT BUỘC): Sử dụng cặp xưng hô "${addressing}" xuyên suốt kịch bản.
    - Không dùng từ cấm: ${FORBIDDEN_TERMS}
    - Văn phong phải cực kỳ khớp với đối tượng: ${voice}.
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
    const fallback: ScriptParts = {};
    for (let i = 1; i <= sceneCount; i++) fallback[`v${i}`] = '';
    return fallback;
  }
};

/**
 * Tạo lại một phần kịch bản cụ thể (v1, v2...) cho Non-Face mode.
 */
export const regenerateNonFaceScriptPart = async (
  imageParts: any[], 
  productName: string, 
  keyword: string, 
  scriptPartKey: string,
  currentPartContent: string,
  fullScript: ScriptParts,
  gender: string, 
  voice: string,
  addressing: string,
  targetAudience: string = ""
): Promise<string> => {
  const ai = getAiClient();
  const voiceDetail = getVoiceDetailedInstruction(voice);

  const prompt = `
    Hãy VIẾT LẠI phần kịch bản Voice-over "${scriptPartKey}" cho sản phẩm "${productName}".
    Tệp khách hàng mục tiêu: "${targetAudience}".
    Nội dung cũ: "${currentPartContent}".
    Bối cảnh toàn bộ kịch bản: ${JSON.stringify(fullScript)}.
    
    YÊU CẦU:
    1. Giữ nguyên phong cách và sự logic với các phần khác.
    2. ĐỘ DÀI NGHIÊM NGẶT: BẮT BUỘC TỪ 160 ĐẾN 180 KÝ TỰ. Tuyệt đối không vượt quá 180 ký tự.
    3. Giới tính giọng đọc: ${gender}, Đặc điểm giọng nói: ${voiceDetail}.
    4. XƯNG HÔ (BẮT BUỘC): Sử dụng cặp xưng hô "${addressing}" (Người nói - Người nghe).
    5. TUYỆT ĐỐI KHÔNG dùng từ cấm: ${FORBIDDEN_TERMS}
    6. Đảm bảo ngôn từ thu hút và viral hơn bản cũ.
    
    Trả về duy nhất chuỗi ký tự kịch bản mới.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }, ...imageParts.slice(0, 3).map(p => ({ inlineData: p }))] },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return response.text?.trim() || currentPartContent;
  } catch (error) {
    return currentPartContent;
  }
};

/**
 * Tạo prompt ảnh sản phẩm.
 */
export const generateNonFaceImagePrompt = async (
  productName: string,
  scriptPart: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  handVisibility: 'no_hand' | 'with_hand' = 'no_hand',
  visualNote: string = "",
  productParts: any[] = []
): Promise<string> => {
  const ai = getAiClient();
  const is3D = imageStyle === '3D';
  const baseStyle = is3D ? "3D Animation Pixar/Disney style, high-quality polished CGI" : "Photorealistic high-end commercial still life photography, 8k, cinematic studio lighting";

  const handRule = handVisibility === 'with_hand' 
    ? "Show professional, clean human hands holding or interacting with the product. Close-up focus on hand and product."
    : "!!! STRICT RULE: ABSOLUTELY NO PEOPLE, NO HANDS, NO HUMANS, NO MODELS, NO BODY PARTS !!!";

  const instructionText = `
    Task: Write a technical image generation prompt (in English) for a PRODUCT-FOCUSED scene.
    Focus ONLY on the product: "${productName}" and its professional environment.
    ${handRule}
    
    Context: "${scriptPart}".
    Style: ${baseStyle}.
    Visual Atmosphere: "${visualNote}".
    
    Requirements:
    1. Professional commercial photography composition (hero shot, bokeh background, macro details).
    2. Strictly NO TEXT, NO ICON, NO EFFECT in image.
    
    Return ONLY the English prompt.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: instructionText }, ...productParts.map(p => ({ inlineData: p }))] }
    });
    return response.text?.trim().replace(/\n/g, ' ') || "";
  } catch (error) {
    return "Error generating image prompt.";
  }
};

/**
 * Tạo hình ảnh sản phẩm.
 */
export const generateNonFaceImage = async (
  referenceImageParts: any[], 
  handReferencePart: any | null,
  productName: string,
  scriptPart: string, 
  userCustomPrompt: string | undefined, 
  imageStyle: 'Realistic' | '3D' = 'Realistic', 
  handVisibility: 'no_hand' | 'with_hand' = 'no_hand',
  backgroundNote: string = "",
  visualNote: string = "",
  backgroundReferencePart: any | null = null,
  productAngle: string = "",
  poseLabel: string = ""
): Promise<string> => {
  const ai = getAiClient();
  const is3D = imageStyle === '3D';
  
  const angleMapping: Record<string, string> = {
    "0": "front view",
    "45": "front-right quarter view",
    "90": "right side view",
    "270": "left side view",
    "315": "front-left quarter view"
  };
  const angleLabel = angleMapping[productAngle] || "";

  const baseStyle = is3D 
    ? "Phong cách Hoạt hình 3D chất lượng cao Pixar Style, màu sắc rực rỡ, CGI trau chuốt."
    : "Ảnh chụp sản phẩm thương mại RAW PHOTO, Still Life chuyên nghiệp, 8k, cinematic lighting.";
    
  let handRule = "";
  if (handVisibility === 'with_hand') {
    handRule = `Góc máy có xuất hiện bàn tay người đang cầm hoặc tương tác với sản phẩm một cách khéo léo và thẩm mỹ. ${handReferencePart ? "Sử dụng bàn tay từ ảnh HAND_REFERENCE làm mẫu." : ""}`;
  } else {
    handRule = "!!! CẢNH BÁO TỐI QUAN TRỌNG: TUYỆT ĐỐI KHÔNG CÓ NGƯỜI, KHÔNG CÓ BẤT KỲ BỘ PHẬN CƠ THỂ NÀO (KHÔNG CÓ TAY CẦM SẢN PHẨM) !!!";
  }

  const poseInstruction = poseLabel ? `PRODUCT DISPLAY STYLE (MANDATORY): The product is ${poseLabel}. Ensure the visual arrangement matches this specific style.` : "";

  const visualRules = `
    ${handRule}
    ${poseInstruction}
    1. CHI TIẾT SẢN PHẨM "${productName}" PHẢI GIỐNG ẢNH THAM CHIẾU 100% (luôn luôn tham chiếu lại hình ảnh sản phẩm mà người dùng tải lên trước khi tạo hình ảnh).
    2. TUYỆT ĐỐI KHÔNG CÓ VĂN BẢN, CHỮ CÁI, LOGO LẠ, ICON, EFFECT, BONG BÓNG CHAT.
    ${angleLabel ? `- Góc nhìn sản phẩm: ${angleLabel}.` : ""}
  `;

  const backgroundRule = backgroundReferencePart 
    ? `MÔI TRƯỜNG: Sử dụng bối cảnh và bố cục từ ảnh BACKGROUND_REFERENCE.`
    : `MÔI TRƯỜNG: Đặt sản phẩm trong bối cảnh ${backgroundNote || 'studio cao cấp'}.`;

  const prompt = `
    ${baseStyle} Tỷ lệ khung hình 9:16. 
    ${visualRules}
    ${backgroundRule}
    ${visualNote ? `BỐ CỤC: ${visualNote}.` : ""}
    MÔ TẢ CẢNH: "${scriptPart}". 
    ${userCustomPrompt || ""}
  `;
  
  const contents: any[] = [{ text: prompt }];
  if (backgroundReferencePart) contents.push({ inlineData: backgroundReferencePart });
  if (handReferencePart) contents.push({ inlineData: handReferencePart });
  referenceImageParts.forEach(part => contents.push({ inlineData: part }));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts: contents },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (!imgPart) throw new Error("Fail");
    return `data:image/png;base64,${imgPart.inlineData.data}`;
  } catch (error) { throw error; }
};

/**
 * Tạo lời nhắc video tập trung vào SẢN PHẨM (VEO-3).
 */
export const generateNonFaceVeoPrompt = async (
  productName: string, 
  scriptText: string, 
  gender: string, 
  voice: string,
  handVisibility: 'no_hand' | 'with_hand' = 'no_hand',
  productImageBase64?: string,
  generatedImageBase64?: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic'
): Promise<string> => {
  const ai = getAiClient();
  const is3D = imageStyle === '3D';
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const voiceGender = gender === 'Nữ' ? 'Female' : 'Male';
  
  const handInstruction = handVisibility === 'with_hand'
    ? `- Xuất hiện bàn tay đang cầm hoặc tương tác tinh tế với sản phẩm.`
    : `!!! TUYỆT ĐỐI KHÔNG CÓ NGƯỜI HAY TAY NGƯỜI XUẤT HIỆN TRONG VIDEO !!!`;

  const instructionPrompt = `
  Nhiệm vụ: Viết một lời nhắc (Prompt) chi tiết tạo video AI (VEO-3) dài 8 giây tập trung hoàn toàn vào SẢN PHẨM.
  ${handInstruction}
  
  CẤU TRÚC PROMPT BẮT BUỘC:
  PHẦN 1: SẢN PHẨM & BỐI CẢNH. Mô tả sản phẩm "${productName}" ở chính giữa khung hình, sắc nét, giữ nguyên tỷ lệ 1:1, không biến dạng. ${is3D ? "3D Pixar Animation style." : "Cinematic Realistic style."} Bối cảnh đồng nhất với ảnh tham chiếu.
  PHẦN 2: CHUYỂN ĐỘNG CAMERA (9:16). Dolly in, Pan hoặc Zoom mượt mà vào sản phẩm 1 cách chuyên nghiệp. Tuyệt đối không thay đổi bối cảnh và sản phẩm suốt 8s. 
  
  PHẦN 3: LỜI THOẠI (BẮT BUỘC THAM CHIẾU GIỌNG NÓI & ĐỘ TUỔI): 
  ✨ Model performs Voice-over with specific traits: "${voice}" (Technical specs: ${voiceDetail}). 
  Speaker Gender: ${voiceGender}. 
  Script content: "${scriptText}"

  PHẦ4: CHẤT LƯỢNG KỸ THUẬT: 4K, 60fps, Cinematic Studio Lighting. 
  Tuyệt đối không có nhạc nền, Khung hình tại giây 8.0 phải giống hệt khung hình tại giây 6.5.
  Video là một cảnh quay liên tục duy nhất từ đầu đến cuối.
  
  YÊU CẦU: Trả về 1 dòng Tiếng Anh duy nhất (trừ phần lời thoại). Không xuống dòng.`;

  const contents: any[] = [{ text: instructionPrompt }];
  if (productImageBase64) contents.push({ inlineData: { mimeType: 'image/png', data: productImageBase64.split(',')[1] || productImageBase64 } });
  if (generatedImageBase64) contents.push({ inlineData: { mimeType: 'image/png', data: generatedImageBase64.split(',')[1] || generatedImageBase64 } });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents }
    });
    return response.text?.trim().replace(/\n/g, ' ') || "";
  } catch (error) {
    return "Error generating video prompt.";
  }
};