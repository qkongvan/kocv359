
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

export const generateVuaTvImage = async (
  answer: string,
  facePart: { mimeType: string, data: string } | null,
  faceDesc: string,
  regenNote: string = "",
  imageStyle: 'Realistic' | '3D' = 'Realistic'
): Promise<string> => {
  const ai = getAiClient();
  const is3D = imageStyle === '3D';

  const baseStyle = is3D 
    ? "High-quality 3D Animation Pixar/Disney style, vibrant colors, expressive character design, polished CGI."
    : "Photorealistic RAW PHOTO, 8k resolution, authentic textures, cinematic lighting.";

  const subject = facePart 
    ? "Maintain the exact face features from the provided reference image." 
    : `Include a young Vietnamese character. ${faceDesc}`;

  const prompt = `
    STYLE: ${baseStyle} 
    RATIO: 9:16 portrait.
    
    GOAL: Create a "SUPER HARD" puzzle for a game. The answer is: "${answer}".
    
    CRITICAL REQUIREMENT: The image must NOT literally represent the answer. Instead, it should be MISLEADING, UNRELATED, or have an OPPOSITE meaning to "${answer}" to confuse players.
    Example: If answer is "THÁI BÌNH" (Peaceful), show a chaotic, stormy scene.
    
    CHARACTER: ${subject}.
    
    MANDATORY: NO TEXT, NO LOGOS, NO OVERLAYS.
    
    ${regenNote ? `User specific feedback: ${regenNote}` : ""}
  `;

  const parts: any[] = [];
  if (facePart) {
    parts.push({ inlineData: facePart });
  }
  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: { parts },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });

    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("No candidates returned");
    
    for (const part of candidate.content.parts) {
      if (part.inlineData?.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data in AI response");
  } catch (error) {
    console.error("Vua TV Image Generation Error:", error);
    throw error;
  }
};

export const generateVuaTvVideoPrompt = async (
  answer: string,
  puzzle: string,
  headerTitle: string,
  imageUrl: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic'
): Promise<string> => {
  const ai = getAiClient();
  const is3D = imageStyle === '3D';

  const systemPrompt = `
    Bạn là chuyên gia viết prompt cho AI Video (VEO-3). Dựa trên hình ảnh đã được tạo và nội dung chương trình "Vua Tiếng Việt", hãy tạo một prompt video hoàn chỉnh.
    PHONG CÁCH VIDEO: ${is3D ? "3D Animation / CGI Style" : "Photorealistic / Real Life Style"}.
    
    CẤU TRÚC BẮT BUỘC (TIẾNG VIỆT):
    Đoạn 1: Nhân vật & bối cảnh. Mô tả rõ nhân vật chính trong ảnh, ngoại hình, trang phục và không gian xung quanh. Video tỉ lệ 9:16. ${is3D ? "Phong cách hoạt hình 3D Pixar/Disney." : "Phong cách người thật chân thực."}
    Đoạn 2: Chuyển động. Mô tả các chuyển động nhẹ nhàng, tự nhiên cho phần hình ảnh bên dưới (chiếm 8/10 khung hình). Nhân vật có thể mỉm cười, chớp mắt hoặc có các chuyển động môi trường như gió thổi lá cây, ánh sáng lung linh.
    QUAN TRỌNG: Phần tiêu đề 2/10 ở trên cùng (chứa chữ "${headerTitle}" và câu đố "${puzzle}") phải được giữ nguyên 100% tĩnh, không biến đổi.
    Đoạn 3: Không khí & thông số kỹ thuật. Mô tả mood tổng thể, ánh sáng chân thực. 
    Thông số: “Tỉ lệ 9:16, độ phân giải 4K, chuyển động mượt, độ chân thật cao, ${is3D ? "3D Animation, Masterpiece CGI" : "Realistic, Cinematic Lighting"}.”

    YÊU CẦU: Trả về kịch bản bằng Tiếng Việt súc tích trên một đoạn duy nhất.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { 
        parts: [
          { text: systemPrompt },
          { inlineData: { mimeType: "image/png", data: imageUrl.split(",")[1] } }
        ] 
      }
    });
    return response.text?.trim() || "Không thể tạo prompt video.";
  } catch (error) {
    console.error("Vua TV Video Prompt Error:", error);
    return "Lỗi khi tạo prompt video.";
  }
};
