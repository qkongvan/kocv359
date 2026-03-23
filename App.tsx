
import React, { useState, useEffect, useRef } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import ErrorBoundary from './components/ErrorBoundary';
import KocReviewModule from './modules/KocReviewModule';
import KocReviewModule2 from './modules/KocReviewModule2';
import NonFaceReviewModule from './modules/NonFaceReviewModule';
import NonFaceReviewModule2 from './modules/NonFaceReviewModule2';
import Shopee8sModule from './modules/Shopee8sModule';
import CoverLinkModule from './modules/CoverLinkModule';
import CarouselModule from './modules/CarouselModule';
import VideoPovModule from './modules/VideoPovModule';
import Review1kModule from './modules/Review1kModule';
import PersonificationModule from './modules/PersonificationModule';
import Personification2Module from './modules/Personification2Module';
import Fashion16sModule from './modules/Fashion16sModule';
import FashionTrackingModule from './modules/FashionTrackingModule';
import VuaTvModule from './modules/VuaTvModule';
import DhbcModule from './modules/DhbcModule';
import TimelapseModule from './modules/TimelapseModule';
import ReviewDoiThoaiModule from './modules/ReviewDoiThoaiModule';
import FeatureIntroModule from './modules/FeatureIntroModule';
import ChatbotStudioModule from './modules/ChatbotStudioModule';
import { getStoredKeys, saveStoredKeys } from './services/keyService';
import { VALID_USERS } from './types';

type ModuleTab = 'intro' | 'koc' | 'koc2' | 'nonface' | 'nonface2' | 'shopee8s' | 'review1k' | 'videopov' | 'carousel' | 'fashion16s' | 'fashiontracking' | 'personification' | 'personification2' | 'coverlink' | 'dhbc' | 'vuatv' | 'timelapse' | 'reviewdoithoai' | 'chatbot';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('koc_studio_auth') === 'true';
  });
  const [loggedInUser, setLoggedInUser] = useState<string | null>(() => {
    return sessionStorage.getItem('koc_studio_user');
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentTab, setCurrentTab] = useState<ModuleTab>('chatbot');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [tempKeys, setTempKeys] = useState(getStoredKeys().join('\n'));
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 15));

  const handleLogout = () => {
    sessionStorage.removeItem('koc_studio_auth');
    sessionStorage.removeItem('koc_studio_user');
    setIsAuthenticated(false);
    setLoggedInUser(null);
    window.location.reload();
  };

  useEffect(() => {
    // Sign in anonymously for Firestore access
    signInAnonymously(auth).then(() => {
      setAuthError(null);
    }).catch(err => {
      if (err.code === 'auth/admin-restricted-operation') {
        setAuthError("Firebase Anonymous Auth is disabled. Please enable it in the Firebase Console (Authentication > Sign-in method > Anonymous).");
      } else {
        setAuthError(`Firebase Auth Error: ${err.message}`);
      }
    });
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (isAuthenticated && loggedInUser) {
      const sessionDocRef = doc(db, 'sessions', loggedInUser);
      
      unsubscribe = onSnapshot(sessionDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.sessionId !== sessionId.current) {
            alert('Tài khoản của bạn đã được đăng nhập ở nơi khác. Bạn sẽ bị đăng xuất.');
            handleLogout();
          }
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `sessions/${loggedInUser}`);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated, loggedInUser]);

  useEffect(() => {
    const handleExportReady = (e: any) => {
      const { data, moduleName } = e.detail;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${moduleName}_export_${new Date().getTime()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    };

    const handleImportProgress = (e: any) => {
      const { percent, complete } = e.detail;
      setImportProgress(percent);
      if (percent > 0 && !complete) {
        setIsImporting(true);
      }
      if (complete) {
        setTimeout(() => {
          setIsImporting(false);
          setImportProgress(0);
        }, 800);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) {
        setIsCategoryMenuOpen(false);
      }
    };

    window.addEventListener('EXPORT_DATA_READY', handleExportReady);
    window.addEventListener('IMPORT_DATA_PROGRESS', handleImportProgress);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('EXPORT_DATA_READY', handleExportReady);
      window.removeEventListener('IMPORT_DATA_PROGRESS', handleImportProgress);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const triggerExport = () => {
    window.dispatchEvent(new CustomEvent('REQUEST_EXPORT_DATA'));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target?.result as string);
        setIsImporting(true);
        setImportProgress(0);
        window.dispatchEvent(new CustomEvent('REQUEST_IMPORT_DATA', { detail: jsonData }));
      } catch (err) {
        alert("File JSON không đúng định dạng!");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = VALID_USERS.find(u => u.u === username.trim() && u.p === password);
    if (user) {
      try {
        // Update session in Firestore
        const sessionDocRef = doc(db, 'sessions', user.u);
        await setDoc(sessionDocRef, {
          sessionId: sessionId.current,
          lastUpdated: new Date().toISOString(),
          username: user.u
        });

        setIsAuthenticated(true);
        setLoggedInUser(user.u);
        sessionStorage.setItem('koc_studio_auth', 'true');
        sessionStorage.setItem('koc_studio_user', user.u);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `sessions/${user.u}`);
      }
    } else {
      alert('Tên đăng nhập hoặc mật khẩu không chính xác!');
    }
  };

  const saveKeys = () => {
    saveStoredKeys(tempKeys);
    setShowKeyModal(false);
    alert('Đã cập nhật danh sách API Key!');
  };

  const renderActiveModule = () => {
    switch(currentTab) {
      case 'intro': return <FeatureIntroModule />;
      case 'koc': return <KocReviewModule />;
      case 'koc2': return <KocReviewModule2 />;
      case 'nonface': return <NonFaceReviewModule />;
      case 'nonface2': return <NonFaceReviewModule2 />;
      case 'shopee8s': return <Shopee8sModule />;
      case 'review1k': return <Review1kModule />;
      case 'videopov': return <VideoPovModule />;
      case 'carousel': return <CarouselModule />;
      case 'fashion16s': return <Fashion16sModule />;
      case 'fashiontracking': return <FashionTrackingModule />;
      case 'personification': return <PersonificationModule />;
      case 'personification2': return <Personification2Module />;
      case 'coverlink': return <CoverLinkModule />;
      case 'dhbc': return <DhbcModule />;
      case 'vuatv': return <VuaTvModule />;
      case 'timelapse': return <TimelapseModule />;
      case 'reviewdoithoai': return <ReviewDoiThoaiModule />;
      case 'chatbot': return <ChatbotStudioModule onTabChange={setCurrentTab} />;
      default: return <KocReviewModule2 />;
    }
  };

  const tabs: { id: ModuleTab; label: string; icon: React.ReactNode }[] = [
    { id: 'intro', label: 'Giới thiệu tính năng', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { id: 'chatbot', label: 'Chatbot Studio', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg> },
    { id: 'koc2', label: 'KOC Review (Viral Hook)', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
    { id: 'nonface', label: 'Review (Non-face)', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
    { id: 'reviewdoithoai', label: 'Review Đối Thoại', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg> },
    { id: 'nonface2', label: 'Review Cận Chân', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 v2M7 7h10" /></svg> },
    { id: 'videopov', label: 'StoryTelling (POV)', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { id: 'carousel', label: 'Ảnh Cuộn Tiktok', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { id: 'personification', label: 'Nhân Hóa Review', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
    { id: 'personification2', label: 'Nhân Hóa (Kiến thức)', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
    { id: 'fashiontracking', label: 'Fashion Tracking', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 4L9 7" /></svg> },
    { id: 'timelapse', label: 'Timelapse (Tua nhanh)', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { id: 'shopee8s', label: 'Shopee Video', icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66-1.34-3-3-3zm7 17H5V8h14v12zm-7-8c-1.66 0-3-1.34-3-3H9c0 1.66 1.34 3 3 3s3-1.34 3-3h-2c0 1.66-1.34-3-3 3z"/></svg> },
    { id: 'coverlink', label: 'Cover Link Shopee', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 00(5.656) 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg> },
    { id: 'dhbc', label: 'Đuổi Hình Bắt Chữ', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a2 2 0 002 2h1a2 2 0 110 4h-1a2 2 0 00-2 2v1a2 2 0 11-4 0V11a2 2 0 11-4 0V11a2 2 0 00-2-2H7a2 2 0 110-4h1a2 2 0 110-4h1a2 2 0 002-2V4z" /></svg> },
    { id: 'vuatv', label: 'Vua Tiếng Việt', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
  ];
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start p-6 relative overflow-hidden">
        {authError && (
          <div className="w-full max-w-md mb-4 bg-red-50 border border-red-200 p-4 rounded-2xl z-20 animate-fadeIn">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div className="text-xs font-bold text-red-700 leading-relaxed">
                {authError}
                <div className="mt-2">
                  <a 
                    href="https://console.firebase.google.com/project/gen-lang-client-0478053248/authentication/providers" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline hover:text-red-900"
                  >
                    Mở Firebase Console để bật →
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="absolute top-[-10%] left-[-10%] w-80 h-80 bg-orange-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-blue-600/5 rounded-full blur-[120px] animate-pulse delay-700"></div>
        <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 !mt-[50px] shadow-2xl relative z-10 border border-slate-200 transform transition-all">
          <div className="flex flex-col items-center mb-10">
            <div className="relative w-20 h-16 flex items-center justify-center mb-6">
                <div className="absolute left-0 top-1 w-12 h-12 bg-[#EE4D2D] rounded-2xl flex items-center justify-center shadow-lg transform -rotate-12 border border-orange-400/20">
                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66-1.34-3-3-3zm7 17H5V8h14v12zm-7-8c-1.66 0-3-1.34-3-3H9c0 1.66 1.34 3 3 3s3-1.34 3-3h-2c0 1.66-1.34-3-3 3z"/></svg>
                </div>
                <div className="absolute left-6 top-0 w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-xl border border-slate-700 transform rotate-12 z-10">
                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.59-1.01V14c0 1.39-.24 2.77-.92 4-1.14 2.1-3.41 3.52-5.76 3.75-2.29.23-4.73-.61-6.22-2.39-1.48-1.78-1.89-4.38-1.04-6.52.85-2.14 2.92-3.71 5.21-3.95v4c-.81.14-1.61.64-2 1.38-.4.75-.41 1.7-.1 2.47.33.82 1.05 1.48 1.93 1.66 1.01.21 2.15-.12 2.8-.93.38-.47.56-1.07.56-1.67V.02z"/></svg>
                </div>
            </div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">KOC <span className="text-orange-600">STUDIO</span></h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">AI Creative Engine</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tên đăng nhập</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></span>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nhập tên người dùng..." className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-500 transition-all placeholder:text-slate-300" required autoFocus />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mật khẩu</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nhập mật khẩu..." className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-500 transition-all placeholder:text-slate-300" required />
              </div>
            </div>
            <button type="submit" className="w-full py-5 bg-orange-600 text-white font-black rounded-2xl shadow-xl shadow-orange-100 hover:bg-orange-700 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest mt-4">ĐĂNG NHẬP</button>
          </form>
          <div className="mt-10 text-center"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Security Gate Powered by<br/> KÔNG VĂN STUDIO</p></div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex flex-col relative font-['Inter']">
        <nav className="bg-white border-b border-slate-100 sticky top-0 z-[100] h-20 flex items-center shadow-sm">
          <div className="max-w-7xl mx-auto w-full px-6 flex items-center justify-between">
              <div className="flex items-center gap-4 shrink-0">
                  <div className="relative w-14 h-12 flex items-center">
                      <div className="absolute left-0 top-1 w-9 h-9 bg-[#EE4D2D] rounded-xl flex items-center justify-center shadow-lg transform -rotate-12 border border-orange-400/20">
                          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66-1.34-3-3-3zm7 17H5V8h14v12zm-7-8c-1.66 0-3-1.34-3-3H9c0 1.66 1.34 3 3 3s3-1.34 3-3h-2c0 1.66-1.34-3-3 3z"/></svg>
                      </div>
                      <div className="absolute left-5 top-0 w-9 h-9 bg-black rounded-xl flex items-center justify-center shadow-xl border border-slate-700 transform rotate-12 z-10 transition-transform hover:rotate-0 duration-500">
                          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.59-1.01V14c0 1.39-.24 2.77-.92 4-1.14 2.1-3.41 3.52-5.76 3.75-2.29.23-4.73-.61-6.22-2.39-1.48-1.78-1.89-4.38-1.04-6.52.85-2.14 2.92-3.71 5.21-3.95v4c-.81.14-1.61.64-2 1.38-.4.75-.41 1.7-.1 2.47.33.82 1.05 1.48 1.93 1.66 1.01.21 2.15-.12 2.8-.93.38-.47.56-1.07.56-1.67V.02z"/></svg>
                      </div>
                  </div>
                  <div className="flex flex-col leading-none">
                      <span className="text-slate-800 font-black text-2xl tracking-tighter uppercase whitespace-nowrap">KOC <span className="text-orange-600">STUDIO</span></span>
                      <span className="text-slate-400 font-bold text-[10px] tracking-[0.25em] uppercase mt-0.5 whitespace-nowrap">AI FOR AFFILIATE</span>
                  </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative" ref={categoryMenuRef}>
                    <button 
                      onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
                      className="h-12 px-6 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-all flex items-center gap-3 shadow-sm group active:scale-95"
                    >
                      <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      <span className="text-slate-800 font-black text-xs uppercase tracking-wider">MENU DANH MỤC</span>
                    </button>

                    {isCategoryMenuOpen && (
                      <div className="absolute right-0 mt-3 w-[640px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[110] animate-fadeIn p-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Kênh Review & Story</div>
                            {tabs.slice(0, 8).map((t) => (
                              <button 
                                key={t.id} 
                                onClick={() => {
                                  setCurrentTab(t.id);
                                  setIsCategoryMenuOpen(false);
                                }} 
                                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-3 ${currentTab === t.id ? 'bg-orange-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                              >
                                <span className={`${currentTab === t.id ? 'text-white' : 'text-slate-400'}`}>
                                  {t.icon}
                                </span>
                                {t.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Sáng tạo & Công cụ</div>
                            {tabs.slice(8).map((t) => (
                              <button 
                                key={t.id} 
                                onClick={() => {
                                  setCurrentTab(t.id);
                                  setIsCategoryMenuOpen(false);
                                }} 
                                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-tight transition-all flex items-center gap-3 ${currentTab === t.id ? 'bg-orange-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                              >
                                <span className={`${currentTab === t.id ? 'text-white' : 'text-slate-400'}`}>
                                  {t.icon}
                                </span>
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                </div>

                <button 
                  onClick={() => setShowKeyModal(true)} 
                  className="p-2 text-slate-400 hover:text-orange-600 transition-colors group flex flex-col items-center"
                  title="Cấu hình API Key"
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1-1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </button>

                <button 
                  onClick={handleLogout} 
                  className="p-2 text-slate-400 hover:text-red-600 transition-colors group flex flex-col items-center"
                  title="Đăng xuất"
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
          </div>
        </nav>

        {currentTab !== 'intro' && currentTab !== 'chatbot' && (
          <div className="max-w-7xl mx-auto w-full px-6 pt-6">
            <div className="bg-white rounded-2xl border border-slate-100 py-3 px-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 border border-slate-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                </div>
                <div className="leading-tight">
                  <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Quản lý Dữ liệu</h4>
                  <p className="text-[9px] text-slate-300 font-bold uppercase tracking-tighter">Import / Export JSON</p>
                </div>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 text-[9px] font-black rounded-xl hover:bg-slate-200 transition-all active:scale-95 uppercase tracking-widest border border-slate-200"
                >
                  Tải Data (Import)
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="application/json" />
                
                <button 
                  onClick={triggerExport}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white text-[9px] font-black rounded-xl hover:bg-orange-700 transition-all shadow-md active:scale-95 uppercase tracking-widest"
                >
                  Xuất file JSON
                </button>
              </div>
            </div>
          </div>
        )}
        
        <main className="flex-1 pb-32 text-[14px]">
          {renderActiveModule()}
        </main>

        <footer className="bg-white border-t border-slate-200 py-4 fixed bottom-0 left-0 right-0 z-[60]">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-center">
            <div className="text-[#64748b] font-bold text-[12px] tracking-tight uppercase">@COPYRIGHT KÔNG VĂN - 0923.200.820</div>
          </div>
        </footer>

        {isImporting && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-md">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border border-slate-100 animate-fadeIn">
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-orange-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Đang nạp dữ liệu...</h3>
              <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden mb-4 border border-slate-200">
                <div className="absolute top-0 left-0 h-full bg-orange-500 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(249,115,22,0.3)]" style={{ width: `${importProgress}%` }} />
              </div>
              <span className="text-3xl font-black text-orange-600 tabular-nums">{importProgress}%</span>
            </div>
          </div>
        )}

        {showKeyModal && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowKeyModal(false)}></div>
            <div className="relative bg-white w-full max-w-lg rounded-[2rem] p-8 !mt-[50px] shadow-2xl border border-slate-200 animate-fadeIn">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">QUẢN LÝ API KEY</h3>
                </div>
                <button onClick={() => setShowKeyModal(false)} className="p-2 text-slate-300 hover:text-slate-500 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="space-y-4">
                <textarea value={tempKeys} onChange={(e) => setTempKeys(e.target.value)} placeholder="Paste danh sách API Key tại đây..." className="w-full h-64 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono focus:ring-4 focus:ring-orange-50 outline-none resize-none" />
                <div className="flex gap-3">
                  <button onClick={() => setShowKeyModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">HỦY BỔ</button>
                  <button onClick={saveKeys} className="flex-1 py-4 bg-orange-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">LƯU DANH SÁCH</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
