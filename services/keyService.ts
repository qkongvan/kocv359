
import { GoogleGenAI } from "@google/genai";
import { decryptKey } from "../utils/crypto";

const STORAGE_KEY = 'koc_studio_api_keys';
const INDEX_KEY = 'koc_studio_current_key_index';

export const getStoredKeys = (): string[] => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];
  return saved.split('\n').map(k => k.trim()).filter(k => k.length > 0);
};

export const saveStoredKeys = (keysString: string) => {
  localStorage.setItem(STORAGE_KEY, keysString);
};

export const getAiClient = (): GoogleGenAI => {
  const keys = getStoredKeys();
  
  if (keys.length === 0) {
    // Fallback về process.env.API_KEY nếu không có key thủ công
    return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  // Lấy index hiện tại từ sessionStorage để xoay vòng trong phiên làm việc
  let currentIndex = parseInt(sessionStorage.getItem(INDEX_KEY) || '0');
  if (currentIndex >= keys.length) currentIndex = 0;

  // Giải mã key trước khi sử dụng (nếu nó được mã hóa)
  const apiKey = decryptKey(keys[currentIndex]);

  // Tăng index cho lần gọi tiếp theo
  sessionStorage.setItem(INDEX_KEY, ((currentIndex + 1) % keys.length).toString());

  console.debug(`Using API Key #${currentIndex + 1} of ${keys.length} (Decrypted: ${apiKey.startsWith('AIza')})`);
  return new GoogleGenAI({ apiKey });
};
