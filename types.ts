
export interface ScriptParts {
  [key: string]: string;
}

export interface GeneratedImage {
  url: string;
  loading: boolean;
  error?: string;
  customPrompt?: string;
  regenNote?: string;
  pose?: string;
}

export interface VideoPromptState {
  text: string;
  loading: boolean;
  visible: boolean;
  translatedText?: string;
  translating?: boolean;
}

export interface TimelapseContext {
  subject: string;
  processType: string;
  rawMaterial: string;
  toolsVisible: string;
}

export interface TimelapseSegment {
  id: number;
  content: string;
  image: GeneratedImage;
  videoPrompt: VideoPromptState;
}

export interface AnalyzedCharacter {
  name: string;
  description: string;
}

export interface Personification2Segment {
  id: number;
  content: string;
  characterIdea: string;
  speaker: string; 
  image: GeneratedImage;
  videoPrompt: VideoPromptState;
}

export interface FashionScenarioPart {
  id: number;
  outfitIndex: number;
  poseDescription: string;
  vibeDescription: string;
}

export interface FashionImageItem {
  id: string;
  outfitIndex: number;
  url: string;
  loading: boolean;
  error?: string;
  regenNote: string;
  videoPrompt: string;
  isPromptLoading: boolean;
  isPromptVisible: boolean;
  scenarioPart?: string;
}

export interface CarouselItem {
  id: number;
  content: string;
  imageUrl: string;
  loading: boolean;
  error?: string;
  regenerateNote: string;
  textPosition: 'Top' | 'Bottom' | 'Split';
  textColor: string;
  fontSize: number;
  videoPrompt?: VideoPromptState;
}

export interface PovScriptSegment {
  id: number;
  content: string;
  image: GeneratedImage;
  videoPrompt: VideoPromptState;
}

export interface User {
  u: string;
  p: string;
}

export const VALID_USERS: User[] = [
  { u: 'hvk1', p: '123456' },
  { u: 'hvk2', p: '123456' },
  { u: 'hvk3', p: '123456' },
  { u: 'inde', p: '123456' },
  { u: 'judy01', p: '123456' },
  { u: 'judy02', p: '123456' },
  { u: 'judy03', p: '123456' },
  { u: 'demotool', p: '123456' },
  { u: 'vantran', p: '123456' },
  { u: 'xuanluong', p: '1234567890' },
  { u: 'huenguyen', p: '1234567890' },
  { u: 'lananh.iedv@gmail.com', p: '1234567890' },
  { u: 'viengiaoduciedv@gmail.com', p: '1234567890' },
  { u: 'anhtuanvnpost', p: '1234567890' },
  { u: 'admin', p: 'zxczxc' }
];

export interface PersonificationSegment {
  id: number;
  content: string;
  image: GeneratedImage;
  videoPrompt: VideoPromptState;
}

export interface VideoPovState {
  videoFile: File | null;
  videoPreviewUrl: string | null;
  originalScriptInput: string;
  analysis: string;
  isAnalyzing: boolean;
  style: string;
  gender: string;
  voice: string;
  characterDescription: string;
  contextNote: string;
  segmentCount: number;
  faceFile: File | null;
  facePreviewUrl: string | null;
  isGeneratingScript: boolean;
  segments: PovScriptSegment[];
}

export type ScriptPartKey = string;

export interface Shopee8sProduct {
  id: number;
  name: string;
  usp: string;
  background: string;
  action: string;
  file: File | null;
  previewUrl: string | null;
  script: ScriptParts | null;
  images: { [key: string]: GeneratedImage };
  videoPrompts: { [key: string]: VideoPromptState };
  outfitImages: { [key: string]: { url: string; loading: boolean } };
  isLoading: boolean;
  isBulkImageLoading?: boolean;
  isBulkPromptLoading?: boolean;
}

export interface VuaTvState {
  puzzle: string;
  answer: string;
  headerTitle: string;
  headerColor: string;
  titleFontSize: number;
  puzzleFontSize: number;
  faceFile: File | null;
  facePreview: string | null;
  faceDescription: string;
  imageStyle: 'Realistic' | '3D';
  regenNote: string;
  generatedImageUrl: string;
  isLoading: boolean;
  videoPrompt: string;
  isVideoPromptLoading: boolean;
  isVideoPromptVisible: boolean;
}

export interface DhbcPhrase {
  phrase: string;
  hint: string;
}

export interface DhbcState {
  phrase: string;
  hint: string;
  headerTitle: string;
  headerColor: string;
  headerFontSize: number;
  footerColor: string;
  faceFile: File | null;
  facePreview: string | null;
  faceDescription: string;
  imageStyle: 'Realistic' | '3D';
  regenNote: string;
  generatedImageUrl: string;
  isLoading: boolean;
  videoPrompt: string;
  isVideoPromptLoading: boolean;
  isVideoPromptVisible: boolean;
  suggestedPhrases: DhbcPhrase[];
  isSuggesting: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  image?: string;
}

export interface ChatbotScene {
  id: number;
  content: string;
  action: string;
}

export interface ChatbotStudioState {
  messages: ChatMessage[];
  scenes: ChatbotScene[];
  isProcessing: boolean;
  attachedImage: string | null;
  attachedImages: string[];
  attachedVideo: string | null;
  attachedVideoType: string | null;
  videoPreviewUrl: string | null;
  mode: 'script' | 'image';
}
