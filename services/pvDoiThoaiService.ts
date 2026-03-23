
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

const FORBIDDEN_TERMS = `Facebook, Shopee, Lazada, Tiki, Zalo, QR, Chuyển khoản, Sale, Voucher, Tiktok, ưu đãi, triân.`;

const getVoiceDetailedInstruction = (voiceLabel: string) => {
  const mapping: Record<string, string> = {
    "Giọng Bắc 20-40 tuổi": "20-40 tuổi, giọng miền Bắc, năng động, đối thoại tự nhiên. Dùng: nhé, ạ, cơ, nhỉ.",
    "Giọng Nam 20-40 tuổi": "20-40 tuổi, giọng miền Nam, trẻ trung. Dùng: nha, nè, hén, thiệt.",
    "Giọng Bắc 50-60 tuổi": "50-60 tuổi, giọng miền Bắc, điềm đạm, tin cậy.",
    "Giọng Nam 50-60 tuổi": "50-60 tuổi, giọng miền Nam, ấm áp, kinh nghiệm.",
    "Giọng Bắc 60-80 tuổi": "60-80 tuổi, giọng miền Bắc, chân chất.",
    "Giọng Nam 60-80 tuổi": "60-80 tuổi, giọng miền Nam, hào sảng."
  };
  return mapping[voiceLabel] || voiceLabel;
};

export const generatePvDoiThoaiScript = async (
  sceneCount: number,
  charA: { gender: string, voice: string, addressing: string },
  charB: { gender: string, voice: string, addressing: string },
  userContent: string,
  backgroundNote: string = ""
): Promise<ScriptParts> => {
  const ai = getAiClient();
  
  const prompt = `
    Nhiệm vụ: Tạo kịch bản ĐỐI THOẠI/PHÓNG VẤN giữa 2 nhân vật (A và B).
    CHỦ ĐỀ: "${userContent || 'Tự do sáng tạo'}"
    BỐI CẢNH: "${backgroundNote || 'Trong đời sống hàng ngày'}"
    
    YÊU CẦU:
    1. Chia kịch bản thành đúng ${sceneCount} cảnh (v1..v${sceneCount}).
    2. Mỗi cảnh chỉ chứa lời thoại thuần túy, không thêm tên nhân vật "A:" hay "B:".
    3. Nhân vật A: ${charA.gender}, ${getVoiceDetailedInstruction(charA.voice)}. Xưng hô: "${charA.addressing}".
    4. Nhân vật B: ${charB.gender}, ${getVoiceDetailedInstruction(charB.voice)}. Xưng hô: "${charB.addressing}".
    5. Độ dài: tối đa 180 ký tự mỗi cảnh. Tuyệt đối không vượt quá 180 ký tự. Không dùng từ cấm: ${FORBIDDEN_TERMS}
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
      contents: { parts: [{ text: prompt }] },
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

export const generatePvDoiThoaiImage = async (
  faceAPart: any | null, 
  faceBPart: any | null,
  outfitAPart: any | null,
  outfitBPart: any | null,
  scriptPart: string, 
  imageStyle: 'Realistic' | '3D',
  activeChar: 'A' | 'B' | 'Both',
  genderA: string,
  genderB: string,
  pose: string,
  angle: string,
  customNote: string,
  bgPart: any | null,
  backgroundNote: string = ""
): Promise<string> => {
  const ai = getAiClient();
  const is3D = imageStyle === '3D';
  const baseStyle = is3D ? "3D Animation Pixar style, high-end CGI, polished." : "Photorealistic high-end commercial photography, 8k, cinematic lighting.";

  let identityRule = "";
  let outfitRule = "";

  if (activeChar === 'A') {
    identityRule = `Subject is an adult Vietnamese person (Character A, ${genderA}). ${faceAPart ? "Maintain features from the REFERENCE_FACE_A image." : "They look professional and friendly."} Gaze: Looking slightly away from the camera lens towards a partner on the right.`;
    if (outfitAPart) outfitRule = `Wearing the exact outfit from the REFERENCE_OUTFIT_A image.`;
  } else if (activeChar === 'B') {
    identityRule = `Subject is an adult Vietnamese person (Character B, ${genderB}). ${faceBPart ? "Maintain features from the REFERENCE_FACE_B image." : "They look approachable and expressive."} Gaze: Looking slightly away from the camera lens towards a partner on the left.`;
    if (outfitBPart) outfitRule = `Wearing the exact outfit from the REFERENCE_OUTFIT_B image.`;
  } else {
    identityRule = `Two adult Vietnamese people (A and B) interacting together. ${faceAPart ? "A matches REFERENCE_FACE_A." : ""} ${faceBPart ? "B matches REFERENCE_FACE_B." : ""} They are looking at each other, not at the camera.`;
    outfitRule = `${outfitAPart ? "A wears REFERENCE_OUTFIT_A." : ""} ${outfitBPart ? "B wears REFERENCE_OUTFIT_B." : ""}`;
  }

  const prompt = `
    Style: ${baseStyle} Aspect 9:16.
    Composition: No direct eye contact with camera. Medium shot.
    
    Character Setup: ${identityRule}
    Outfit Setup: ${outfitRule}
    
    Environment: ${backgroundNote || 'Professional indoor setting'}. ${bgPart ? "Match elements from the REFERENCE_BACKGROUND image." : ""}
    
    Scene Action: "${scriptPart}". 
    Technical: Pose is ${pose || 'natural'}, camera angle is ${angle || 'standard'}. Clean image, no text, no watermarks.
    ${customNote ? `Notes: ${customNote}` : ""}
  `;
  
  const contents: any[] = [{ text: prompt }];
  // Gán nhãn khớp với text mô tả bên trên
  if (faceAPart) contents.push({ text: "REFERENCE_FACE_A:", inlineData: faceAPart });
  if (outfitAPart) contents.push({ text: "REFERENCE_OUTFIT_A:", inlineData: outfitAPart });
  if (faceBPart) contents.push({ text: "REFERENCE_FACE_B:", inlineData: faceBPart });
  if (outfitBPart) contents.push({ text: "REFERENCE_OUTFIT_B:", inlineData: outfitBPart });
  if (bgPart) contents.push({ text: "REFERENCE_BACKGROUND:", inlineData: bgPart });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts: contents },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return imgPart ? `data:image/png;base64,${imgPart.inlineData.data}` : "";
  } catch (error) { throw error; }
};

export const generatePvDoiThoaiVeoPrompt = async (
  scriptText: string, 
  gender: string,
  voice: string,
  imageStyle: string,
  backgroundNote: string = "",
  generatedImageBase64?: string
): Promise<string> => {
  const ai = getAiClient();
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const is3D = imageStyle === '3D';

  const prompt = `
    Task: Write a detailed VEO-3 video prompt (8 seconds) for a dialogue scene.
    Style: ${is3D ? "3D Animation" : "Photorealistic"}.
    
    Requirements:
    1. Character & Setting: Vietnamese adult, environment is ${backgroundNote || 'natural'}.
    2. Action: Speaking naturally, matching lips with kịch bản: "${scriptText}". No eye contact with camera.
    3. Camera: Gentle movement, 9:16 ratio.
    4. Voice Metadata: Speaks in ${voiceDetail} (${gender}): "${scriptText}".
    5. Quality: 4K, 60fps.
    
    Output: 1 single line in English.
  `;

  const contents: any[] = [{ text: prompt }];
  if (generatedImageBase64) {
    contents.push({ inlineData: { mimeType: 'image/png', data: generatedImageBase64.split(',')[1] || generatedImageBase64 } });
  }

  try {
    const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents });
    return response.text?.trim().replace(/\n/g, ' ') || "";
  } catch (error) { return ""; }
};
