
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { ScriptParts, ScriptPartKey } from "../types";
import { getAiClient } from "./keyService";

/**
 * Làm sạch phản hồi JSON từ mô hình AI bằng cách loại bỏ các thẻ markdown.
 */
const cleanJsonResponse = (text: string) => {
  return text.replace(/```json|```/g, "").trim();
};

/**
 * Chuyển đổi File sang định dạng mà mô hình Generative AI có thể hiểu được.
 */
export const fileToGenerativePart = async (file: File) => {
  return new Promise<{ mimeType: string, data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({ mimeType: file.type, data: (reader.result as string).split(',')[1] });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Trích xuất ảnh trang phục: Xóa người và bối cảnh, giữ lại trang phục trên nền trắng.
 */
export const extractOutfitImage = async (outfitPart: any): Promise<string> => {
  const ai = getAiClient();
  const prompt = `
    Chụp ảnh sản phẩm chuyên nghiệp CHỈ dành cho trang phục.
    1. Xóa hoàn toàn người và bối cảnh.
    2. Nền trắng tinh khiết (#FFFFFF). 
    3. Giữ nguyên hoa văn và màu sắc 100%.
  `;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: { parts: [{ text: prompt }, { inlineData: outfitPart }] }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return part ? `data:image/png;base64,${part.inlineData.data}` : "";
  } catch (error) { throw error; }
};

const FORBIDDEN_TERMS = `Facebook, Shopee, Lazada, Tiki, Zalo, QR, Chuyển khoản, Sale, Voucher, Tiktok, ưu đãi, triân.`;

/**
 * Lấy hướng dẫn chi tiết về giọng đọc dựa trên nhãn lựa chọn.
 */
const getVoiceDetailedInstruction = (voiceLabel: string) => {
  const mapping: Record<string, string> = {
    "Giọng Bắc 20-40 tuổi": "20-40 tuổi, giọng miền Bắc, năng động, đối thoại tự nhiên. Dùng: nhé, ạ, cơ, nhỉ.",
    "Giọng Nam 20-40 tuổi": "20-40 tuổi, giọng miền Nam, trẻ trung. Dùng: nha, nè, hén, thiệt.",
    "Giọng Bắc 5-10 tuổi": "5-10 tuổi, giọng miền Bắc, trong trẻo, hồn nhiên, đối thoại tự nhiên. Dùng: nhé, ạ, cơ, nhỉ.",
    "Giọng Nam 5-10 tuổi": "5-10 tuổi, giọng miền Nam, dễ thương. Dùng: nha, nè, hén, thiệt.",
    "Giọng Bắc 50-60 tuổi": "50-60 tuổi, giọng miền Bắc, điềm đạm, tin cậy.",
    "Giọng Nam 50-60 tuổi": "50-60 tuổi, giọng miền Nam, ấm áp, kinh nghiệm.",
    "Giọng Bắc 60-80 tuổi": "60-80 tuổi, giọng miền Bắc, chân chất.",
    "Giọng Nam 60-80 tuổi": "60-80 tuổi, giọng miền Nam, hào sảng."
  };
  return mapping[voiceLabel] || voiceLabel;
};

/**
 * Tạo kịch bản ĐỐI THOẠI 2 NHÂN VẬT - PHÂN TÁCH LỜI THOẠI RIÊNG BIỆT MỖI CẢNH.
 */
export const generateDoiThoaiScript = async (
  imageParts: any[], 
  productName: string, 
  keyword: string, 
  sceneCount: number,
  charA: { gender: string, voice: string, addressing: string },
  charB: { gender: string, voice: string, addressing: string },
  userContent: string,
  backgroundNote: string = ""
): Promise<ScriptParts> => {
  const ai = getAiClient();
  
  const prompt = `
    Bạn là biên kịch TikTok chuyên gia. Nhiệm vụ của bạn là tạo kịch bản ĐỐI THOẠI viral giữa 2 nhân vật (A và B) cho sản phẩm "${productName}".

    Ý TƯỞNG NGƯỜI DÙNG: "${userContent || 'Tự do sáng tạo'}"
    ĐẶC ĐIỂM SẢN PHẨM: "${keyword}".
    BỐI CẢNH: "${backgroundNote || 'Trong đời sống hàng ngày'}"
    
    !!! QUY TẮC NỘI DUNG TỐI QUAN TRỌNG (CẤM TIỀN TỐ) !!!:
    1. Chia kịch bản thành đúng ${sceneCount} cảnh (v1..v${sceneCount}).
    2. MỖI CẢNH CHỈ CHỨA LỜI THOẠI THUẦN TÚY. 
    3. TUYỆT ĐỐI KHÔNG thêm tên nhân vật hay tiền tố "A:", "B:", "Nhân vật A:" vào nội dung kịch bản.
    4. Cần viết nội dung sao cho khi đọc xen kẽ sẽ tạo thành một cuộc hội thoại hoàn chỉnh.
    
    NHÂN VẬT & XƯNG HÔ:
    - NHÂN VẬT A: ${charA.gender}, ${getVoiceDetailedInstruction(charA.voice)}.
      Cách xưng hô của A: "${charA.addressing}" (Người nói - Người nghe).
    - NHÂN VẬT B: ${charB.gender}, ${getVoiceDetailedInstruction(charB.voice)}.
      Cách xưng hô của B: "${charB.addressing}" (Người nói - Người nghe).
    
    YÊU CẦU KỸ THUẬT:
    - ĐỘ DÀI: BẮT BUỘC TỪ 160 ĐẾN 180 KÝ TỰ mỗi cảnh. TUYỆT ĐỐI KHÔNG ĐƯỢC VƯỢT QUÁ 180 KÝ TỰ VÀ KHÔNG ĐƯỢC NGẮN HƠN 160 KÝ TỰ.
    - Không dùng từ cấm: ${FORBIDDEN_TERMS}
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
 * Tạo hình ảnh với TUYỆT ĐỐI ĐỒNG NHẤT NHÂN VẬT VÀ TRANG PHỤC CỦA TỪNG BÊN.
 * CẤM NHÌN VÀO CAMERA - TẠO CẢM GIÁC ĐỐI THOẠI.
 */
export const generateDoiThoaiImage = async (
  productParts: any[], 
  faceAPart: any | null, 
  faceBPart: any | null,
  outfitAPart: any | null,
  outfitBPart: any | null,
  productName: string,
  scriptPart: string, 
  imageStyle: 'Realistic' | '3D',
  activeChar: 'A' | 'B' | 'Both',
  genderA: string,
  genderB: string,
  pose: string,
  angle: string,
  shot: string,
  customNote: string,
  bgPart: any | null,
  backgroundNote: string = ""
): Promise<string> => {
  const ai = getAiClient();
  const is3D = imageStyle === '3D';
  
  // Thiết lập phong cách cơ bản (Chân thực hoặc 3D)
  const baseStyle = is3D 
    ? "Phong cách Hoạt hình 3D Pixar/Disney chất lượng cao, màu sắc rực rỡ nhưng tự nhiên, nhân vật biểu cảm, kết xuất CGI tinh xảo." 
    : "Ảnh RAW CHÂN THỰC, độ phân giải 8k, kết cấu da chân thực, ánh sáng tự nhiên mang tính điện ảnh nhưng vẫn thực tế.";

  // QUY TẮC CHI TIẾT (Ánh sáng, Da, Tóc, Vải) - Áp dụng từ KOC Review
  const skinRealismRule = is3D ? "" : `
    QUY TẮC THỰC TẾ DA QUAN TRỌNG: 
    - Giữ nguyên kết cấu da người chi tiết: thấy rõ lỗ chân lông, các nếp nhăn vi mô tự nhiên và các khuyết điểm thực tế của da.
    - TUYỆT ĐỐI KHÔNG làm mịn quá mức, KHÔNG làm mờ nhân tạo và KHÔNG tạo vẻ ngoài da "nhựa" hoặc giống búp bê.
    - Da phải thể hiện sự tán xạ ánh sáng tự nhiên để đạt độ chân thực tối đa.
  `;

  const lightingAndTextureRules = is3D ? "" : `
    !!! QUY TẮC KẾT CẤU & ÁNH SÁNG QUAN TRỌNG !!!:
    1. ÁNH SÁNG: Bóng đổ tương phản cao và điểm sáng rõ rệt (specular highlights) trên tóc và da.
    2. CHI TIẾT TÓC: Tóc phải có độ bóng tự nhiên, thấy rõ từng sợi tóc và kết cấu sợi mềm mại.
    3. CHI TIẾT VẢI: Chi tiết sắc nét trên quần áo, thấy rõ các đường dệt vải, kết cấu sợi mịn và nếp gấp vải chân thực với bóng đổ vi mô.
  `;

  const compositionRules = `
    !!! KHÓA TỶ LỆ & BỐ CỤC (SCALE AND COMPOSITION LOCK) !!!:
    1. KHUNG HÌNH (FRAMING): Mỗi hình ảnh PHẢI là "${shot || 'Medium Shot'}". Nhân vật chiếm khoảng 3/4 chiều cao khung hình đứng.
    2. TỶ LỆ SẢN PHẨM: Sản phẩm "${productName}" PHẢI duy trì kích thước thực tế và cố định so với nhân vật.
    3. TÍNH NHẤT QUÁN: Sản phẩm KHÔNG ĐƯỢC to ra hay nhỏ đi, bắt buộc tính tỷ lệ để đồng nhất giữa các cảnh khác nhau.
    4. KHÔNG BIẾN DẠNG: Sản phẩm là vật thể rắn, không bị méo mó. Tỷ lệ hình học phải khớp 1:1 với ảnh tham chiếu PRODUCT_REF.
  `;

  let identityRule = "";
  let outfitRule = "";

  // Thiết lập quy tắc nhân vật dựa trên cảnh quay (A, B hoặc Cả hai)
  if (activeChar === 'A') {
    identityRule = `!!! KHÓA DANH TÍNH MẶT A !!!: CHỈ có nhân vật trưởng thành A xuất hiện. Danh tính: Người Việt Nam trưởng thành ${genderA}. 
                    Sử dụng CHÍNH XÁC các đặc điểm khuôn mặt, kiểu tóc và cấu trúc xương từ ảnh FACE_A. 
                    ÁNH MẮT: Nhân vật A PHẢI nhìn hơi lệch sang phải, tránh nhìn thẳng vào ống kính, như đang nói chuyện với người ở ngoài khung hình. KHÔNG nhìn thẳng camera.`;
    if (outfitAPart) outfitRule = `!!! KHÓA TRANG PHỤC A !!!: Nhân vật A PHẢI mặc CHÍNH XÁC trang phục từ OUTFIT_A. Khớp 100% về hoa văn, màu sắc và chất liệu vải.`;
  } else if (activeChar === 'B') {
    identityRule = `!!! KHÓA DANH TÍNH MẶT B !!!: CHỈ có nhân vật trưởng thành B xuất hiện. Danh tính: Người Việt Nam trưởng thành ${genderB}. 
                    Sử dụng CHÍNH XÁC các đặc điểm khuôn mặt, kiểu tóc và cấu trúc xương từ ảnh FACE_B. 
                    ÁNH MẮT: Nhân vật B PHẢI nhìn hơi lệch sang trái, tránh nhìn thẳng vào ống kính, như đang nói chuyện với người ở ngoài khung hình. KHÔNG nhìn thẳng camera.`;
    if (outfitBPart) outfitRule = `!!! KHÓA TRANG PHỤC B !!!: Nhân vật B PHẢI mặc CHÍNH XÁC trang phục từ OUTFIT_B. Khớp 100% về hoa văn, màu sắc và chất liệu vải.`;
  } else {
    identityRule = `!!! KHÓA DANH TÍNH CẢ HAI !!!: Cả hai nhân vật trưởng thành (A và B) đều trong khung hình. Cả hai đều phải là người Việt Nam trưởng thành. 
                    Sử dụng FACE_A cho A và FACE_B cho B. Duy trì 100% đặc điểm nhận dạng.
                    ÁNH MẮT: Các nhân vật PHẢI nhìn nhau hoặc tương tác, TUYỆT ĐỐI KHÔNG ai nhìn vào camera.`;
    outfitRule = `!!! KHÓA TRANG PHỤC CẢ HAI !!!: Nhân vật A mặc OUTFIT_A. Nhân vật B mặc OUTFIT_B. KHÔNG ĐƯỢC HOÁN ĐỔI.`;
  }

  const visualRules = `
    !!! QUY TẮC THỊ GIÁC NGHIÊM NGẶT (BẮT BUỘC TUÂN THỦ) !!!:
    1. TUYỆT ĐỐI KHÔNG NHÌN TRỰC TIẾP CAMERA. Các nhân vật PHẢI KHÔNG nhìn vào ống kính. Họ nhìn sang hướng khác hoặc nhìn nhau để mô phỏng cuộc đối thoại tự nhiên.
    2. TUYỆT ĐỐI KHÔNG CÓ TRẺ EM, TRẺ SƠ SINH. Đối tượng PHẢI là người lớn.
    3. !!! QUAN TRỌNG: TUYỆT ĐỐI KHÔNG CÓ VĂN BẢN, CHỮ CÁI, SỐ, KÝ TỰ, PHỤ ĐỀ.
    4. TUYỆT ĐỐI KHÔNG CÓ LỚP PHỦ GIAO DIỆN, NÚT BẤM, BIỂU TƯỢNG, EMOJI.
    5. TUYỆT ĐỐI KHÔNG CÓ HIỆU ỨNG THỊ GIÁC LẠ, ĐƯỜNG PHÁT SÁNG, TIA SÁNG PHÉP THUẬT.
    6. Bối cảnh phải SẠCH SẼ và chuyên nghiệp, phù hợp với môi trường đời thực.
  `;

  const prompt = `
    ${baseStyle} Tỉ lệ 9:16.
    
    ${visualRules}
    ${skinRealismRule}
    ${lightingAndTextureRules}
    ${compositionRules}

    !!! KHÓA DANH TÍNH NHÂN VẬT & TRANG PHỤC !!!:
    ${identityRule}
    ${outfitRule}
    
    NỘI DUNG CẢNH QUAY: "${scriptPart}". 
    
    !!! KHÓA MÔI TRƯỜNG !!!:
    - BỐI CẢNH (BACKGROUND): ${backgroundNote || 'Môi trường tự nhiên'}.
    - KHÔNG GIAN CỐ ĐỊNH: Tất cả ảnh phải diễn ra trong CÙNG MỘT PHÒNG/KHÔNG GIAN để đảm bảo tính liên kết.
    - ${bgPart ? "BẮT BUỘC sử dụng bối cảnh và bố cục phối cảnh từ ảnh BACKGROUND_REF được cung cấp." : ""}
    
    THÔNG SỐ KỸ THUẬT:
    - TƯ THẾ (POSE): ${pose}. GÓC MÁY SẢN PHẨM (PRODUCT ANGLE): ${angle}. GÓC QUAY (SHOT): ${shot}.
    - SẢN PHẨM: "${productName}" phải xuất hiện rõ rệt và khớp tuyệt đối với PRODUCT_REF.
    - BẮT BUỘC: CHỈ ẢNH SẠCH. KHÔNG CHỮ. ${customNote}
  `;
  
  const contents: any[] = [{ text: prompt }];
  
  if (faceAPart) {
    contents.push({ text: "ẢNH THAM CHIẾU MẶT A (FACE_A):" });
    contents.push({ inlineData: faceAPart });
  }
  if (outfitAPart) {
    contents.push({ text: "ẢNH THAM CHIẾU TRANG PHỤC A (OUTFIT_A):" });
    contents.push({ inlineData: outfitAPart });
  }
  if (faceBPart) {
    contents.push({ text: "ẢNH THAM CHIẾU MẶT B (FACE_B):" });
    contents.push({ inlineData: faceBPart });
  }
  if (outfitBPart) {
    contents.push({ text: "ẢNH THAM CHIẾU TRANG PHỤC B (OUTFIT_B):" });
    contents.push({ inlineData: outfitBPart });
  }
  if (bgPart) {
    contents.push({ text: "ẢNH THAM CHIẾU BỐI CẢNH (BACKGROUND_REF):" });
    contents.push({ inlineData: bgPart });
  }
  if (productParts.length > 0) {
    contents.push({ text: "ẢNH THAM CHIẾU SẢN PHẨM (PRODUCT_REF):" });
    productParts.forEach(p => contents.push({ inlineData: p }));
  }

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

/**
 * Tạo prompt video chuyên nghiệp cho VEO-3 áp dụng quy tắc tương tác sản phẩm và nhất quán nhân vật.
 */
export const generateDoiThoaiVeoPrompt = async (
  productName: string,
  scriptText: string, 
  speakerLabel: string, // "Nhân vật A" hoặc "Nhân vật B" hoặc "Cả hai nhân vật"
  speakerDescription: string, // Mô tả ngoại hình của người đang nói
  gender: string,
  voice: string,
  imageStyle: string,
  scriptTone: string, // Giọng điệu kịch bản
  shot: string, // Góc quay (Wide/Medium/Close-up)
  backgroundNote: string = "",
  isNoProductRequested: boolean = false,
  generatedImageBase64?: string,
  productImageData?: string
): Promise<string> => {
  const ai = getAiClient();
  const is3D = imageStyle === '3D';
  const voiceDetail = getVoiceDetailedInstruction(voice);
  const voiceGender = gender === 'Nữ' ? 'Female' : 'Male';
  
  // Trích xuất độ tuổi từ nhãn giọng nói (VD: "20-40 tuổi")
  const ageMatch = voice.match(/\d+-\d+/);
  const ageDescription = ageMatch ? `trong độ tuổi ${ageMatch[0]}` : "trưởng thành";

  const productInteractionRule = isNoProductRequested
    ? `PHẦN 2: HÀNH ĐỘNG & TƯƠNG TÁC (QUAN TRỌNG):
      - TUYỆT ĐỐI KHÔNG xuất hiện sản phẩm "${productName}".
      - Cách nhân vật di chuyển, nói chuyện và tương tác phù hợp với kịch bản: "${scriptText}".`
    : `PHẦN 2: HÀNH ĐỘNG & TƯƠNG TÁC (QUAN TRỌNG):
      - Nhân vật đang cầm trên tay sản phẩm "${productName}".
      - Cách nhân vật di chuyển, nói chuyện và tương tác phù hợp với kịch bản: "${scriptText}".
      - [SẢN PHẨM PHẢI GIỐNG ẢNH THAM CHIẾU 100%, KHÔNG BIẾN DẠNG]`;

  const instructionPrompt = `
  Nhiệm vụ: Viết một lời nhắc (Prompt) chi tiết để tạo video AI (VEO-3) dài 8 giây cho video Review Đối Thoại.
  PHONG CÁCH VIDEO: ${is3D ? "3D Animation / CGI Style" : "Photorealistic / Real Life Style"}.
  
  XÁC ĐỊNH NGƯỜI NÓI:
  - NHÂN VẬT ĐANG NÓI CHÍNH: ${speakerLabel} (${gender}), độ tuổi: ${ageDescription}.
  - GIỌNG ĐIỆU SẢN PHẨM & KỊCH BẢN: ${scriptTone}.
  - MÔ TẢ NGOẠI HÌNH: ${speakerDescription || 'Một người Việt Nam trưởng thành.'}.
  
  !!! QUY TẮC NHẤT QUÁN QUAN TRỌNG !!!: Duy trì 100% khuôn mặt, kiểu tóc và TRANG PHỤC nhất quán với các ảnh tham chiếu được cung cấp cho ${speakerLabel}. 
  !!! HẠN CHẾ THỊ GIÁC !!!: TUYỆT ĐỐI KHÔNG CÓ TRẺ EM, TRẺ SƠ SINH. KHÔNG CHỮ, KHÔNG LỚP PHỦ. KHÔNG NHÌN TRỰC TIẾP VÀO CAMERA.

  CẤU TRÚC PROMPT:
  PHẦN 1: NHÂN VẬT & DIỆN MẠO (BẮT BUỘC NHẤT QUÁN). Tập trung vào ${speakerLabel} đang nói chuyện. Mô tả diện mạo: ${speakerDescription}. ÁNH MẮT: Nhân vật nhìn lệch camera, đang nói chuyện với đối tác.
  ${productInteractionRule}
  PHẦN 3: BỐI CẢNH & ÁNH SÁNG. Không gian đồng nhất với bối cảnh ảnh tham chiếu: ${backgroundNote || 'Môi trường tự nhiên'}.
  PHẦN 4: CHUYỂN ĐỘNG MÁY ẢNH (9:16). Chuyển động tiến (slow push-in) vào nhân vật. Góc quay: ${shot || 'Medium Shot'}. Tuyệt đối không thay đổi bối cảnh và trang phục. Các nhân vật tuyệt đối không rời khỏi khung hình.
  PHẦN 5: LỜI THOẠI & ĐỒNG BỘ GIỌNG NÓI (CỰC KỲ CHI TIẾT): 
  - Nhân vật đang nói: ${speakerLabel} (${voiceGender}).
  - Loại góc quay đang hiển thị: ${shot || 'Medium Shot'}.
  - Nhãn giọng nói: "${voice}".
  - Đặc điểm âm thanh chi tiết: "${voiceDetail}".
  - Nội dung kịch bản: "${scriptText}".
  => Yêu cầu: Khớp môi (lip-sync) hoàn hảo 100% với lời thoại.

  PHẦN 6: CHẤT LƯỢNG KỸ THUẬT: 4K, 60fps, Không có nhạc nền, Không hiệu ứng chuyển cảnh.

  YÊU CẦU: Trả về 1 dòng Tiếng Anh duy nhất (trừ phần lời thoại). Không xuống dòng.`;

  const contents: any[] = [{ text: instructionPrompt }];
  if (productImageData) {
    contents.push({ inlineData: { mimeType: 'image/png', data: productImageData.split(',')[1] || productImageData } });
  }
  if (generatedImageBase64) {
    contents.push({ inlineData: { mimeType: 'image/png', data: generatedImageBase64.split(',')[1] || generatedImageBase64 } });
  }

  try {
    const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents });
    return response.text?.trim().replace(/\n/g, ' ') || "";
  } catch (error) { return ""; }
};
