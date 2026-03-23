
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { getAiClient } from "./keyService";
import { AnalyzedCharacter } from "../types";

const cleanJsonResponse = (text: string) => {
  return text.replace(/```json|```/g, "").trim();
};

const getVoiceDetailedInstruction = (voiceLabel: string) => {
  const isNorth = voiceLabel.includes("Bắc");
  const dialectInstruction = isNorth ? `
    VĂN PHONG MIỀN BẮC (HÀ NỘI):
    - Sử dụng từ đệm: "nhé", " ạ", " thế", " đấy", " vậy", " vâng", " chứ".
    - TUYỆT ĐỐI KHÔNG dùng các từ miền Nam như: nha, nè, nghen, thiệt, hông, vầy.
  ` : `
    VĂN PHONG MIỀN NAM (SÀI GÒN):
    - Sử dụng từ đệm: "nha", " nè", " nghen", " hen", " đó", " vầy", " ha".
    - TUYỆT ĐỐI KHÔNG dùng các từ miền Bắc như: nhé, ạ, thế, đấy, chả, vâng.
  `;

  const ageMapping: Record<string, string> = {
    "Giọng miền Bắc 20-40 tuổi": "Độ tuổi 20-40, miền Bắc, năng động, vui vẻ, tông cao.",
    "Giọng miền Nam 20-40 tuổi": "Độ tuổi 20-40, miền Nam, năng động, vui vẻ, tông cao.",
    "Giọng miền Bắc 50-60 tuổi": "Độ tuổi 50-60, miền Bắc, trầm, vang, uy quyền.",
    "Giọng miền Nam 50-60 tuổi": "Độ tuổi 50-60, miền Nam, trầm, vang, uy quyền.",
    "Giọng miền Bắc 60-80 tuổi": "Độ tuổi 60-80, miền Bắc, khàn, hào sảng, chân chất.",
    "Giọng miền Nam 60-80 tuổi": "Độ tuổi 60-80, miền Nam, khàn, hào sảng, chân chất."
  };
  
  return (ageMapping[voiceLabel] || voiceLabel) + "\n" + dialectInstruction;
};

export const analyzePersonDescription = async (desc: string): Promise<AnalyzedCharacter[]> => {
  const ai = getAiClient();
  const prompt = `Nhiệm vụ: Phân tích danh sách nhân vật từ mô tả sau: "${desc}".
  YÊU CẦU:
  1. Chỉ xác định số lượng và tên các nhân vật người xuất hiện.
  2. KHÔNG viết mô tả ngoại hình, không viết chi tiết trang phục.
  3. Trả về mảng JSON các đối tượng { "name": "..." }.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING }
            },
            required: ["name"]
          }
        }
      }
    });
    const text = response.text || "[]";
    const data = JSON.parse(cleanJsonResponse(text));
    return data.map((item: any) => ({ name: item.name, description: "" }));
  } catch (e) {
    console.error("Lỗi phân tích nhân vật:", e);
    return [{ name: "Nhân vật người", description: "" }];
  }
};

export const splitScriptIntoSegments = async (originalScript: string, voice: string, addressing: string, segmentCount: number): Promise<string[]> => {
  const ai = getAiClient();
  const voiceDetail = getVoiceDetailedInstruction(voice);
  
  const prompt = `
    Nhiệm vụ: Phân chia kịch bản văn bản dưới đây thành đúng ${segmentCount} đoạn nhỏ để làm video TikTok.
    Kịch bản gốc: "${originalScript}"
    
    YÊU CẦU NGÔN NGỮ & GIỌNG ĐIỆU:
    - Đặc điểm giọng nói: ${voiceDetail}
    - XƯNG HÔ (BẮT BUỘC): Sử dụng cặp xưng hô "${addressing}" (Người nói - Người nghe).
    
    YÊU CẦU KỸ THUẬT QUAN TRỌNG:
    1. Chia thành ĐÚNG ${segmentCount} phần (từ v1 đến v${segmentCount}).
    2. Mỗi đoạn BẮT BUỘC có độ dài TỪ 160 ĐẾN 180 KÝ TỰ.
    3. Tuyệt đối KHÔNG ĐƯỢC DÀI HƠN 180 ký tự và KHÔNG ĐƯỢC NGẮN HƠN 160 ký tự.
    4. Giữ nguyên nội dung và tính mạch lạc, không làm mất ý nghĩa của câu.
    5. Trả về kết quả dưới dạng một mảng JSON các chuỗi ký tự.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return JSON.parse(cleanJsonResponse(response.text || '[]'));
  } catch (e) {
    console.error("Lỗi chia kịch bản:", e);
    return [];
  }
};

export const generatePersonifiedImage = async (
  segmentContent: string,
  characterIdea: string,
  gender: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  personDescription: string = "",
  isPersonified: boolean = true,
  speakerName: string = 'Object',
  personParts: any[] = [],
  backgroundNote: string = "",
  productParts: any[] = []
): Promise<string> => {
  const ai = getAiClient();
  const isRealisticMode = imageStyle === 'Realistic';
  
  const objectPresenceRule = isPersonified 
    ? `THIẾT KẾ VẬT THỂ NHÂN HÓA: Một nhân vật 3D được nhân hóa dựa trên "${characterIdea || 'vật thể'}". Có đôi mắt to, biểu cảm sinh động. Có chân tay nhưng ngắn ngủn bé xíu dễ thương.`
    : `GHI CHÚ BỔ SUNG CHO CẢNH: ${characterIdea}.`;
  
  const contextStyle = isRealisticMode 
    ? `MÔI TRƯỜNG: Ảnh chụp thực tế (Photorealistic), chất lượng 8k, ánh sáng tự nhiên.`
    : `MÔI TRƯỜNG: Hoạt hình 3D Pixar, rực rỡ sắc màu.`;

  const backgroundRule = backgroundNote ? `BỐI CẢNH CHI TIẾT: ${backgroundNote} tại Việt Nam. Hãy thiết lập không gian này cho toàn bộ khung hình.` : "";

  const personIdentityRule = personParts.length > 0
    ? `!!! KHÓA DANH TÍNH NHÂN VẬT TUYỆT ĐỐI (STRICT IDENTITY LOCK) !!!: 
       1. Bạn PHẢI sử dụng chính xác khuôn mặt, kiểu tóc, màu tóc và trang phục từ ảnh mẫu "PERSON_REFERENCE" đính kèm. 
       2. Đối chiếu 1:1, không được thay đổi bất kỳ chi tiết ngoại hình nào để đảm bảo nhân vật đồng nhất 100% giữa các cảnh.
       3. Nhân vật là người Việt Nam (${gender}).
       4. Giữ nguyên kết cấu da người chi tiết (lỗ chân lông, nếp nhăn vi mô) nếu ở chế độ thực tế.`
    : `NHÂN VẬT NGƯỜI: Người Việt Nam (${gender}) và chỉ xuất hiện 1 phần cơ thể đang trong cảnh quay (không lộ mặt).`;

  const productIdentityRule = productParts.length > 0
    ? `!!! KHÓA DANH TÍNH SẢN PHẨM TUYỆT ĐỐI (STRICT PRODUCT FIDELITY) !!!:
       1. Bạn PHẢI sử dụng chính xác hình dáng, màu sắc, logo và nhãn hiệu từ ảnh mẫu "PRODUCT_REFERENCE" đính kèm.
       2. Sản phẩm phải xuất hiện rõ ràng và chân thực trong cảnh quay.`
    : "";

  const actionFidelityRule = `
    !!! QUY TẮC HÀNH ĐỘNG VẬT LÝ TUYỆT ĐỐI (STRICT PHYSICAL ACTION LOCK) !!!:
    1. BẠN PHẢI vẽ nhân vật đang thực hiện chính xác hành động vật lý được mô tả trong lời thoại này: "${segmentContent}".
    2. VÍ DỤ: 
       - Nếu lời thoại là mắng việc "đổ nước lạnh vào nồi", hãy vẽ nhân vật (con dâu) đang cầm bình nước đổ vào nồi, và nhân vật khác (mẹ chồng) đang chỉ tay hoặc có vẻ mặt giận dữ.
       - Nếu lời thoại là "thắng đường", hãy vẽ nhân vật đang đứng bếp, tay cầm muôi khuấy đường trong nồi/chảo nóng.
       - Nếu lời thoại là "khoe sản phẩm", hãy vẽ nhân vật đang giơ sản phẩm lên.
    3. TẠO TƯƠNG TÁC VỚI ĐẠO CỤ: Phải có các đạo cụ liên quan (bếp, nồi, bình nước, thực phẩm...) xuất hiện chân thực.
    4. NHÂN VẬT ${speakerName} là người thực hiện hành động chính hoặc đang có biểu cảm khớp nhất với lời thoại.
  `;

  const prompt = `
    NHIỆM VỤ: Tạo hình ảnh dọc 9:16 cho TikTok thể hiện một phân cảnh hành động thực tế.
    ${actionFidelityRule}
    ${objectPresenceRule}
    ${contextStyle}
    ${backgroundRule}
    ${personIdentityRule}
    ${productIdentityRule}
    
    NỘI DUNG PHÂN CẢNH CỤ THỂ: "${segmentContent}".
    
    !!! QUY TẮC SỐ LƯỢNG NHÂN VẬT TUYỆT ĐỐI !!!:
    ${isPersonified 
      ? "- CHỈ ĐƯỢC PHÉP xuất hiện DUY NHẤT vật thể nhân hóa (The Object). TUYỆT ĐỐI KHÔNG vẽ thêm bất kỳ con người hay nhân vật nào khác." 
      : `- CHỈ ĐƯỢC PHÉP xuất hiện các nhân vật đã được liệt kê cụ thể: ${personDescription}.`
    }
    - TUYỆT ĐỐI KHÔNG được thêm bất kỳ người lạ hay nhân vật phụ nào khác.
    - KHÔNG NHÂN BẢN NHÂN VẬT TRONG CÙNG 1 KHUNG HÌNH.

    HẠN CHẾ KỸ THUẬT:
    - QUAN TRỌNG: Tuyệt đối không chèn bất kỳ chữ viết nào lên ảnh.
    - Bối cảnh SẠCH, không có biển hiệu, không phụ đề, không biểu tượng.
  `;

  const contents: any[] = [{ text: prompt }];
  if (personParts.length > 0) {
    contents.push({ text: "PERSON_REFERENCE_IMAGES (USE THIS FOR FACE, HAIR, AND OUTFIT FIDELITY):" });
    personParts.forEach(p => contents.push({ inlineData: p }));
  }
  if (productParts.length > 0) {
    contents.push({ text: "PRODUCT_REFERENCE_IMAGES (USE THIS FOR PRODUCT FIDELITY):" });
    productParts.forEach(p => contents.push({ inlineData: p }));
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: { parts: contents },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    
    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return imgPart ? `data:image/png;base64,${imgPart.inlineData.data}` : "";
  } catch (e) {
    console.error("Lỗi tạo ảnh:", e);
    throw e;
  }
};

export const generateVideoPromptV2 = async (
  segmentContent: string,
  characterIdea: string,
  gender: string,
  voice: string,
  imageStyle: 'Realistic' | '3D' = 'Realistic',
  personDescription: string = "",
  isPersonified: boolean = true,
  speakerName: string = 'Object',
  generatedImageBase64?: string
): Promise<string> => {
  const ai = getAiClient();
  const voiceGender = gender === 'Nữ' ? 'Female' : 'Male';
  const isRealisticMode = imageStyle === 'Realistic';

  const characterRule = isPersonified
    ? `Đoạn 1: NHÂN VẬT & DIỆN MẠO. Tập trung DUY NHẤT vào vật thể nhân hóa (The Object) từ ảnh tham chiếu. TUYỆT ĐỐI KHÔNG mô tả hay cho phép bất kỳ nhân vật người nào khác xuất hiện trong cảnh này.`
    : `Đoạn 1: NHÂN VẬT & DIỆN MẠO. Mô tả nhân vật khớp tuyệt đối ảnh tham chiếu. Gán tên định danh cho các nhân vật người xuất hiện trong danh sách "${personDescription}" lần lượt là Character A, Character B... theo thứ tự xuất hiện.`;

  const lipSyncRule = isPersonified
    ? `Đoạn 4: QUY TẮC HÀNH ĐỘNG NÓI (STRICT LIP-SYNC RULE): Chỉ có vật thể nhân hóa (The Object) là được phép di chuyển miệng/bộ phận phát âm để nói chuyện theo kịch bản.`
    : `Đoạn 4: QUY TẮC HÀNH ĐỘNG NÓI & IM LẶNG (STRICT LIP-SYNC RULE): 
      - CHỈ CÓ NHÂN VẬT ĐƯỢC CHỈ ĐỊNH LÀ NGƯỜI NÓI (Identify Speaker ở đoạn 6) là được phép di chuyển miệng để nói chuyện và khớp môi.
      - TẤT CẢ CÁC NHÂN VẬT KHÁC TRONG CẢNH PHẢI TUYỆT ĐỐI KHÔNG ĐƯỢC NÓI, MIỆNG PHẢI ĐÓNG CHẶT, KHÔNG CÓ BẤT KỲ CỬ ĐỘNG MÔI NÀO. Họ chỉ đóng vai trò là người nghe, có thể chớp mắt hoặc gật đầu nhẹ nhưng miệng không được mở.`;

  const speakerRule = isPersonified
    ? `Đoạn 6: Lời thoại: ✨ Identify speaker: The Object. Speaker details: speaks with ${voice} characteristics (${voiceGender}). Dialogue: "${segmentContent}"`
    : `Đoạn 6: Lời thoại: ✨ Identify speaker: Nếu người nói là "${speakerName}" và là người trong danh sách nhân vật, hãy gọi chính xác là "Character A" hoặc "Character B" tương ứng. Nếu là vật thể nhân hóa, hãy gọi là "The Object". 
      Speaker details: speaks with ${voice} characteristics (${voiceGender}). Dialogue: "${segmentContent}"`;

  const systemPrompt = `
    Bạn là chuyên gia viết prompt cho AI Video (VEO-3). 
    NHIỆM VỤ: Chuyển hình ảnh tham chiếu thành video 8 giây diễn tả hành động vật lý chính xác theo lời thoại.
    
    !!! QUY TẮC ĐỒNG NHẤT TUYỆT ĐỐI !!!: 
    - Nhân vật và bối cảnh PHẢI GIỮ NGUYÊN Y HỆT HÌNH ẢNH THAM CHIẾU.
    
    CẤU TRÚC PROMPT (1 DÒNG):
    ${characterRule}
    Đoạn 2: BỐI CẢNH & ÁNH SÁNG. Không gian đồng nhất với bối cảnh ảnh tham chiếu.
    Đoạn 3: HÀNH ĐỘNG VẬT LÝ CHÍNH (CRITICAL). NHÂN VẬT THỰC HIỆN CHI TIẾT HÀNH ĐỘNG VẬT LÝ ĐƯỢC MÔ TẢ TRONG KỊCH BẢN: "${segmentContent}". Chuyển động cơ thể, tay và vai phải tương tác với đồ vật chân thực theo kịch bản "${segmentContent}".
    ${lipSyncRule}
    Đoạn 5: Camera. Dolly-in nhẹ nhàng hoặc Static shot tập trung vào hành động tay và biểu cảm khuôn mặt.
    ${speakerRule}
    Đoạn 7: Thông số: 9:16, 4K, 60fps, ${isRealisticMode ? 'Realistic' : '3D Animation'}.

    YÊU CẦU: Trả về prompt Tiếng Anh (trừ lời thoại).
  `;

  const contents: any[] = [];
  if (generatedImageBase64) {
    contents.push({ inlineData: { mimeType: 'image/png', data: generatedImageBase64.split(',')[1] || generatedImageBase64 } });
  }
  contents.push({ text: systemPrompt });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents }
    });
    return response.text?.trim().replace(/\n/g, ' ') || "";
  } catch (e) {
    return "Lỗi khi tạo prompt video.";
  }
};
