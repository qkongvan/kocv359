
import { Type } from "@google/genai";
import { getAiClient } from "./keyService";
import { ChatMessage, ChatbotScene } from "../types";

export const sendMessage = async (
  history: ChatMessage[],
  message: string,
  mode: 'script' | 'image' = 'script',
  images?: { mimeType: string, data: string }[],
  video?: { mimeType: string, data: string }
): Promise<{ text: string; scenes: ChatbotScene[]; generatedImage?: string }> => {
  const ai = getAiClient();

  if (mode === 'image') {
    const contents: any[] = [];
    
    const lastModelImage = [...history].reverse().find(m => m.role === 'model' && m.image);
    
    if (lastModelImage?.image) {
      contents.push({
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/png", data: lastModelImage.image.split(',')[1] } },
          { text: "Đây là hình ảnh trước đó. Hãy dựa vào nó và yêu cầu sau để tạo ra hình ảnh mới: " + message }
        ]
      });
    } else if (images && images.length > 0) {
      contents.push({
        role: "user",
        parts: [
          ...images.map(img => ({ inlineData: img })),
          { text: message }
        ]
      });
    } else {
      contents.push({ role: "user", parts: [{ text: message }] });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents,
      config: {
        systemInstruction: "Bạn là chuyên gia thiết kế hình ảnh. Hãy tạo ra hình ảnh dựa trên yêu cầu của người dùng. Nếu có hình ảnh tham chiếu, hãy giữ sự nhất quán về phong cách và nhân vật.",
      }
    });

    let generatedImageUrl = '';
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    return {
      text: response.text || "Đây là hình ảnh tôi đã tạo cho bạn.",
      scenes: [],
      generatedImage: generatedImageUrl
    };
  }

  const systemInstruction = `
    Bạn là chuyên gia biên kịch TikTok. 
    Khi người dùng yêu cầu tạo kịch bản, hãy chia kịch bản thành nhiều cảnh.
    
    TRƯỜNG HỢP CÓ VIDEO HOẶC HÌNH ẢNH ĐÍNH KÈM:
    1. Hãy phân tích video hoặc các hình ảnh để hiểu nội dung, bối cảnh và hành động.
    2. Kết hợp nội dung đa phương tiện với yêu cầu cụ thể của người dùng để tạo ra kịch bản chi tiết cuối cùng.
    3. Trích xuất các cảnh từ video/ảnh nếu phù hợp hoặc tạo cảnh mới dựa trên cảm hứng từ chúng.

    QUY TẮC BẮT BUỘC CHO KỊCH BẢN:
    1. Mỗi cảnh phải có phần lời thoại (content) độ dài từ 160 đến 180 ký tự. 
    2. TUYỆT ĐỐI KHÔNG được ngắn hơn 160 ký tự và KHÔNG được dài hơn 180 ký tự cho phần lời thoại.
    3. Mỗi cảnh phải có phần ghi chú hành động (action) ngắn gọn, mô tả những gì diễn ra trong cảnh đó.
    4. Nội dung mỗi cảnh phải súc tích, hấp dẫn, phù hợp với TikTok.
    5. Trả về kết quả dưới dạng JSON với cấu trúc: { "text": "Lời chào/phản hồi", "scenes": [{ "id": 1, "content": "Lời thoại cảnh 1...", "action": "Hành động cảnh 1..." }] }
    `;

  const contents: any[] = [
    ...history.map(m => ({ role: m.role, parts: [{ text: m.text }] }))
  ];

  const userParts: any[] = [];
  if (images && images.length > 0) {
    images.forEach(img => userParts.push({ inlineData: img }));
  }
  if (video) userParts.push({ inlineData: video });
  userParts.push({ text: message });

  contents.push({
    role: "user",
    parts: userParts
  });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.INTEGER },
                content: { type: Type.STRING },
                action: { type: Type.STRING }
              },
              required: ["id", "content", "action"]
            }
          }
        },
        required: ["text", "scenes"]
      }
    }
  });

  const result = JSON.parse(response.text);
  return result;
};
