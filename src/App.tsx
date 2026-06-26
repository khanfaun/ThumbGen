import React, { useState, useEffect, useRef } from "react";
import {
  DriveFile,
  ImageItem,
  ProcessorConfig,
  ProcessingHistoryItem,
} from "./types";
import { generateThumbnail, convertTiffToPng } from "./utils/imageProcessor";

import Dropzone, { getCleanFolderNameFromFile } from "./components/Dropzone";
import FolderTree from "./components/FolderTree";
import LogoUploader from "./components/LogoUploader";
import ProcessingProgress from "./components/ProcessingProgress";
import ThumbnailPreview from "./components/ThumbnailPreview";
import HistoryPanel from "./components/HistoryPanel";
import TemplateDesigner, { SYSTEM_PRESETS } from "./components/TemplateDesigner";
import ExtensionFilterModal from "./components/ExtensionFilterModal";
import SettingsModal from "./components/SettingsModal";

import {
  Sparkles,
  Link as LinkIcon,
  Image as ImageIcon,
  Play,
  CheckCircle2,
  AlertTriangle,
  Bell,
  Cpu,
  Undo2,
  Redo2,
  Eye,
  Settings,
  Loader2,
  Key,
} from "lucide-react";

const DEFAULT_CONFIG: ProcessorConfig = {
  width: 1200,
  height: 1200,
  paddingPercent: 12,
  backgroundColor: "#ffffff",
  autoCenter: true,
  logoUrl: "/logos/JBL-logo.png",
  logoPosition: "bottom-right",
  logoScale: 15,
  logoPadding: 20,
  exportFormat: "png",
  exportQuality: 0.9,
  maxJpgSizeMB: 1,
  useCustomLayout: true,
  productLayout: { x: 15, y: 22, width: 70, height: 70, rotation: 0 },
  logoLayout: { x: 5, y: 5, width: 25, height: 25, rotation: 0 },
};

interface AppDriveFile extends DriveFile {
  useDirectUrl?: boolean;
}

export default function App() {
  // Config state with built-in Undo/Redo mechanism
  const [config, setConfigState] = useState<ProcessorConfig>(DEFAULT_CONFIG);
  
  const undoStack = useRef<ProcessorConfig[]>([]);
  const redoStack = useRef<ProcessorConfig[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUndoRedoAction = useRef(false);

  const setConfig = (newConfigOrFn: ProcessorConfig | ((prev: ProcessorConfig) => ProcessorConfig)) => {
    setConfigState((prev) => {
      const next = typeof newConfigOrFn === "function" ? newConfigOrFn(prev) : newConfigOrFn;
      
      if (!isUndoRedoAction.current) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        
        const prevState = prev;
        
        timeoutRef.current = setTimeout(() => {
          if (JSON.stringify(prevState) !== JSON.stringify(next)) {
            undoStack.current.push(prevState);
            if (undoStack.current.length > 50) {
              undoStack.current.shift();
            }
            redoStack.current = [];
          }
        }, 300); // 300ms debounce
      }
      return next;
    });
  };

  const handleUndo = () => {
    if (undoStack.current.length === 0) return;
    
    isUndoRedoAction.current = true;
    const previous = undoStack.current.pop()!;
    setConfigState((current) => {
      redoStack.current.push(current);
      return previous;
    });
    setTimeout(() => {
      isUndoRedoAction.current = false;
    }, 50);
  };

  const handleRedo = () => {
    if (redoStack.current.length === 0) return;
    
    isUndoRedoAction.current = true;
    const next = redoStack.current.pop()!;
    setConfigState((current) => {
      undoStack.current.push(current);
      return next;
    });
    setTimeout(() => {
      isUndoRedoAction.current = false;
    }, 50);
  };

  // Keyboard shortcut listener for Ctrl+Z and Ctrl+Shift+Z / Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" || 
        target.tagName === "TEXTAREA" || 
        target.isContentEditable
      ) {
        return;
      }

      const isZ = e.key.toLowerCase() === "z";
      const isY = e.key.toLowerCase() === "y";

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && isZ) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) && 
        ((e.shiftKey && isZ) || isY)
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Logo files and preloads
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  // Inputs
  const [googleDriveUrl, setGoogleDriveUrl] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStats, setExtractionStats] = useState<{ count: number; error?: string } | null>(null);

  // Drive Filter Modal States
  const [showDriveFilterModal, setShowDriveFilterModal] = useState(false);
  const [pendingDriveFiles, setPendingDriveFiles] = useState<AppDriveFile[]>([]);
  const [detectedDriveExtensions, setDetectedDriveExtensions] = useState<string[]>([]);
  const [selectedDriveExtensions, setSelectedDriveExtensions] = useState<string[]>([]);

  // Tên thư mục xuất chính (ZIP)
  const [mainFolderName, setMainFolderName] = useState<string>("JBL Clip 5");

  // Core processing state
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConvertingTiff, setIsConvertingTiff] = useState(false);

  const isProcessingRef = useRef(isProcessing);
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  // Job History
  const [history, setHistory] = useState<ProcessingHistoryItem[]>([]);

  // Modal for Results (Mục sản phẩm đã xử lý)
  const [showResultsModal, setShowResultsModal] = useState(false);
  
  const [appMode, setAppMode] = useState<"simple" | "advanced">("simple");
  const [selectedBrand, setSelectedBrand] = useState<"jbl" | "hk">("jbl");

  useEffect(() => {
    if (appMode === "simple") {
      const preset = SYSTEM_PRESETS.find((p) => p.id === `${selectedBrand}-thumb`);
      if (preset) {
        setConfig((prev) => ({
          ...prev,
          logoUrl: selectedBrand === "jbl" ? "/logos/JBL-logo.png" : "/logos/HK-logo.png",
          productLayout: { ...preset.productLayout },
          logoLayout: { ...preset.logoLayout },
          useCustomLayout: true,
        }));
        setLogoFile(null); // Clear custom logo if any
      }
    }
  }, [selectedBrand, appMode]);

  // Push notifications state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  // Load history from localStorage
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    const savedHistory = localStorage.getItem("thumbnail_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Lỗi đọc lịch sử:", e);
      }
    }
    
    const savedKey = localStorage.getItem("google_api_key");
    if (savedKey) {
      setGoogleApiKey(savedKey);
    }

    // Check browser notification permission
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Request Notification Permission
  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  // Watch logo file or brand selection and preload logo image
  useEffect(() => {
    let url: string | null = null;
    let isBlobUrl = false;

    if (logoFile) {
      url = URL.createObjectURL(logoFile);
      isBlobUrl = true;
    } else if (config.logoUrl) {
      url = config.logoUrl;
    }

    if (url) {
      setLogoPreviewUrl(url);

      const img = new Image();
      img.onload = () => {
        logoImgRef.current = img;
      };
      img.src = url;

      return () => {
        if (isBlobUrl && url) {
          URL.revokeObjectURL(url);
        }
        logoImgRef.current = null;
      };
    } else {
      setLogoPreviewUrl(null);
      logoImgRef.current = null;
    }
  }, [logoFile, config.logoUrl]);

  // Luôn lưu giữ danh sách ảnh mới nhất để tránh stale closure trong useEffect nén ảnh tự động
  const imageItemsRef = useRef(imageItems);
  useEffect(() => {
    imageItemsRef.current = imageItems;
  }, [imageItems]);

  // Tự động nén lại / tái tạo các ảnh kết quả thời gian thực khi cấu hình (định dạng, chất lượng, canvas, logo...) thay đổi
  useEffect(() => {
    if (isProcessing) return;

    const currentItems = imageItemsRef.current;
    const completedItems = currentItems.filter(item => item.status === "completed");
    if (completedItems.length === 0) return;

    let isMounted = true;

    const regenerate = async () => {
      const activeItems = imageItemsRef.current;
      const updatedItems = await Promise.all(
        activeItems.map(async (item) => {
          if (item.status !== "completed") return item;
          try {
            let productImgUrl = item.originalUrl;
            const processedDataUrl = await generateThumbnail(
              productImgUrl,
              config,
              logoImgRef.current
            );
            return { ...item, processedUrl: processedDataUrl };
          } catch (e) {
            console.error("Lỗi tự động tái tạo ảnh kết quả:", e);
            return item;
          }
        })
      );

      if (isMounted) {
        const currentActiveItems = imageItemsRef.current;
        const hasChanges = updatedItems.some((item, idx) => {
          const currentItem = currentActiveItems[idx];
          return currentItem && item.processedUrl !== currentItem.processedUrl;
        });
        if (hasChanges) {
          setImageItems(updatedItems);
        }
      }
    };

    const delayDebounceFn = setTimeout(() => {
      regenerate();
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(delayDebounceFn);
    };
  }, [
    isProcessing,
    config.exportFormat,
    config.exportQuality,
    config.maxJpgSizeMB,
    config.width,
    config.height,
    config.backgroundColor,
    config.autoCenter,
    config.useCustomLayout,
    config.logoUrl,
    config.logoScale,
    config.logoPosition,
    config.logoPadding,
    JSON.stringify(config.productLayout),
    JSON.stringify(config.logoLayout)
  ]);

  // Helper function to extract Drive folder on Client-side
  const extractDriveFolderClientSide = async (folderId: string): Promise<AppDriveFile[]> => {
    const files: AppDriveFile[] = [];
    const imageExtensions = "png|jpe?g|jfif|webp|svg|gif|heic|heif|bmp|tiff?|raw|cr2|nef|arw|dng|psd|ai|eps|pdf";
    const fileExtRegex = new RegExp(`\\.(${imageExtensions})$`, "i");

    // Nếu người dùng có nhập API Key
    if (googleApiKey) {
      console.log("Sử dụng Google Drive API chính thức với API Key...");
      try {
        const fetchPage = async (pageToken?: string) => {
          const query = `'${folderId}' in parents and trashed=false`;
          let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name,mimeType)&key=${googleApiKey}&pageSize=1000`;
          if (pageToken) url += `&pageToken=${pageToken}`;
          
          const res = await fetch(url);
          if (!res.ok) {
            let errorMsg = res.statusText;
            try {
              const errData = await res.json();
              if (errData && errData.error && errData.error.message) {
                errorMsg = errData.error.message;
              }
            } catch (e) {}
            throw new Error(`Google API phản hồi lỗi (${res.status}): ${errorMsg}`);
          }
          const data = await res.json();
          
          if (data.files && data.files.length > 0) {
            for (const f of data.files) {
              if (f.mimeType === "application/vnd.google-apps.folder") {
                // Không hỗ trợ đệ quy qua API tĩnh để tránh vượt giới hạn quota hoặc chậm, chỉ lấy trực tiếp.
              } else if (f.mimeType.startsWith("image/") || fileExtRegex.test(f.name)) {
                files.push({
                  id: f.id,
                  name: f.name,
                  mimeType: f.mimeType,
                  relativePath: f.name,
                  useDirectUrl: true,
                });
              }
            }
          }
          if (data.nextPageToken) {
            await fetchPage(data.nextPageToken);
          }
        };
        await fetchPage();
        
        // Nếu API Key quét thành công ra file thì trả về. Nếu = 0, có thể do lỗi scope của API key, chuyển sang proxy.
        if (files.length > 0) {
          return files;
        } else {
          console.warn("Google Drive API trả về 0 file. Có thể API Key không có quyền list public folder. Chuyển sang quét Proxy...");
        }
      } catch (err: any) {
        console.error("Lỗi khi dùng API Key:", err);
        console.warn("Chuyển sang quét Proxy do API Key lỗi...");
      }
    }

    // Dự phòng proxy
    const seenIds = new Set<string>();
    const seenFolders = new Set<string>();

    const unescapeDriveName = (str: string): string => {
      try {
        let result = str.replace(/\\x([0-9a-fA-F]{2})/g, (m, hex) => {
          return String.fromCharCode(parseInt(hex, 16));
        });
        result = result.replace(/\\u([0-9a-fA-F]{4})/g, (m, hex) => {
          return String.fromCharCode(parseInt(hex, 16));
        });
        result = result.replace(/\\"/g, '"')
                       .replace(/\\'/g, "'")
                       .replace(/\\\//g, '/')
                       .replace(/\\\\/g, '\\');
        return result;
      } catch (e) {
        return str;
      }
    };

    const fetchWithProxy = async (targetUrl: string): Promise<string> => {
      const proxies = [
        (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
      ];

      let lastError: any = null;
      for (const getProxyUrl of proxies) {
        try {
          const proxyUrl = getProxyUrl(targetUrl);
          console.log(`Trying fetch via proxy: ${proxyUrl}`);
          const response = await fetch(proxyUrl);
          if (response.ok) {
            const text = await response.text();
            if (text && text.length > 500) {
              return text;
            }
          }
        } catch (err) {
          console.warn(`Proxy failed:`, err);
          lastError = err;
        }
      }
      throw new Error("Tất cả CORS proxy đều bị chặn. Vui lòng chạy ứng dụng ở môi trường local hoặc cài đặt backend.");
    };

    const extractFolderRecursive = async (currentFolderId: string, currentPath: string = "") => {
      const url = `https://drive.google.com/drive/folders/${currentFolderId}`;
      const html = await fetchWithProxy(url);

      const hexObjRegex = /\\x22([a-zA-Z0-9_-]{25,45})\\x22,\s*(?:\\x5b(?:\\x22([a-zA-Z0-9_-]{25,45})\\x22)?\\x5d|null)\s*,\s*\\x22(.*?)\\x22,\s*\\x22(.*?)\\x22/gi;
      const stdObjRegex = /\["([a-zA-Z0-9_-]{25,45})",\s*(?:\[\s*(?:"([a-zA-Z0-9_-]{25,45})")?\s*\]|null)\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"/gi;

      const subfolders: { id: string; name: string }[] = [];

      const processMatch = (id: string, parentId: string | undefined, rawName: string, rawMime: string) => {
        const name = unescapeDriveName(rawName);
        const mimeType = unescapeDriveName(rawMime);

        if (mimeType === "application/vnd.google-apps.folder") {
          if (id !== currentFolderId && id !== folderId && !seenFolders.has(id) && id.length >= 25 && id.length <= 45) {
            seenFolders.add(id);
            subfolders.push({ id, name });
          }
        } else if (mimeType.startsWith("image/") || fileExtRegex.test(name)) {
          if (!seenIds.has(id) && id.length >= 25 && id.length <= 45 && !id.startsWith("http")) {
            seenIds.add(id);
            const ext = name.split('.').pop()?.toLowerCase() || "";
            let finalMime = mimeType;
            if (!finalMime.startsWith("image/")) {
              if (ext === "jpg" || ext === "jpeg") finalMime = "image/jpeg";
              else if (ext === "svg") finalMime = "image/svg+xml";
              else finalMime = `image/${ext}`;
            }

            files.push({
              id,
              name,
              mimeType: finalMime,
              relativePath: currentPath ? `${currentPath}/${name}` : name,
            });
          }
        }
      };

      let match;
      while ((match = hexObjRegex.exec(html)) !== null) {
        processMatch(match[1], match[2], match[3], match[4]);
      }
      while ((match = stdObjRegex.exec(html)) !== null) {
        processMatch(match[1], match[2], match[3], match[4]);
      }

      for (const sub of subfolders) {
        const subPath = currentPath ? `${currentPath}/${sub.name}` : sub.name;
        await extractFolderRecursive(sub.id, subPath);
      }
    };

    await extractFolderRecursive(folderId);
    return files;
  };

  // Load Drive files from API (with smart browser fallback)
  const handleExtractDriveFolder = async () => {
    if (!googleDriveUrl.trim()) return;

    setIsExtracting(true);
    setExtractionStats(null);
    setImageItems([]); // Clear old items

    let files: AppDriveFile[] = [];
    let usedFallback = false;

    try {
      console.log("Thử quét thư mục Google Drive qua máy chủ API...");
      const response = await fetch("/api/extract-drive-folder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: googleDriveUrl }),
      });

      const text = await response.text();
      let data;
      const isHtml = text.trim().startsWith("<");
      
      if (!response.ok || isHtml) {
        console.warn("Máy chủ API không sẵn sàng hoặc không phản hồi JSON đúng định dạng. Chuyển sang quét Client-side...");
        throw new Error("API_NOT_AVAILABLE");
      }

      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error("API_NOT_AVAILABLE");
      }

      files = data.files || [];
    } catch (apiError: any) {
      usedFallback = true;
      try {
        console.log("Đang bắt đầu cơ chế quét dự phòng trực tiếp trên trình duyệt (Client-side Fallback)...");
        let folderId = googleDriveUrl.trim();
        const folderIdMatch = googleDriveUrl.match(/\/folders\/([a-zA-Z0-9_-]{25,})/);
        const queryIdMatch = googleDriveUrl.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
        if (folderIdMatch) {
          folderId = folderIdMatch[1];
        } else if (queryIdMatch) {
          folderId = queryIdMatch[1];
        }

        if (!/^[a-zA-Z0-9_-]{25,}$/.test(folderId)) {
          throw new Error("Không tìm thấy Folder ID hợp lệ từ đường dẫn Google Drive được nhập.");
        }

        const clientFiles = await extractDriveFolderClientSide(folderId);
        files = clientFiles.map(f => ({ ...f, useDirectUrl: true }));
      } catch (fallbackError: any) {
        console.error("Lỗi cả khi quét qua Client-side:", fallbackError);
        setExtractionStats({ 
          count: 0, 
          error: `Không thể tải thư mục. Vui lòng đảm bảo thư mục Google Drive ở chế độ công khai. Chi tiết lỗi: ${fallbackError.message}` 
        });
        setIsExtracting(false);
        return;
      }
    }

    if (files.length === 0) {
      setExtractionStats({ count: 0, error: "Thư mục không có ảnh hoặc không công khai" });
      setIsExtracting(false);
      return;
    }

    const extMap: { [key: string]: number } = {};
    files.forEach(f => {
      const match = f.name.toLowerCase().match(/\.([a-z0-9]+)$/);
      const ext = match ? match[1].toUpperCase() : "";
      if (ext) extMap[ext] = (extMap[ext] || 0) + 1;
    });

    const uniqueExts = Object.keys(extMap).sort();
    setPendingDriveFiles(files);
    setDetectedDriveExtensions(uniqueExts);

    const itemWithPath = files.find(item => item.relativePath && item.relativePath.includes("/"));
    if (itemWithPath && itemWithPath.relativePath) {
      const firstSegment = itemWithPath.relativePath.split("/")[0];
      if (firstSegment) {
        setMainFolderName(firstSegment);
      }
    } else if (files.length > 0) {
      const cleanName = getCleanFolderNameFromFile(files[0].name);
      setMainFolderName(cleanName);
    }

    if (uniqueExts.includes("PNG")) {
      setSelectedDriveExtensions(["PNG"]);
    } else {
      setSelectedDriveExtensions([]);
    }

    setShowDriveFilterModal(true);
    setIsExtracting(false);
  };

  const handleConfirmDriveUpload = async () => {
    const filtered = pendingDriveFiles.filter((file) => {
      const match = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
      const ext = match ? match[1].toUpperCase() : "";
      return selectedDriveExtensions.includes(ext);
    });

    const hasTiff = filtered.some((file) => {
      if (file.useDirectUrl) return false; // Không cần convert TIFF nếu dùng thumbnail trực tiếp
      return file.name.toLowerCase().endsWith(".tif") || file.name.toLowerCase().endsWith(".tiff");
    });
    
    if (hasTiff) {
      setIsConvertingTiff(true);
    }

    try {
      const folderIdMap = new Map<string, string>();

      const newItems: ImageItem[] = await Promise.all(
        filtered.map(async (file) => {
          const isTiff = file.name.toLowerCase().endsWith(".tif") || file.name.toLowerCase().endsWith(".tiff");
          
          // Sử dụng API key nếu có, nếu không thì dùng proxy ảnh miễn phí wsrv.nl chuyên dụng (không dùng Netlify function vì lỗi giới hạn)
          let originalUrl = googleApiKey 
            ? `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${googleApiKey}` 
            : `https://wsrv.nl/?url=${encodeURIComponent(`https://drive.google.com/thumbnail?sz=w1600&id=${file.id}`)}&we&w=1600`;
            
          let status: ImageItem["status"] = "pending";
          let errorMsg: string | undefined = undefined;

          // Trên môi trường tĩnh (Netlify / GitHub Pages)
          // Endpoint Google Drive thumbnail tự động kết xuất ảnh TIFF/các ảnh khác thành JPG/PNG chất lượng cao và hỗ trợ CORS tuyệt đối.
          
          // Tuy nhiên, đối với TIFF, có thể cần xử lý nếu thumbnail không đủ tốt, nhưng thumbnail thường là đã chuyển đổi rồi!
          // Nên không cần convertTiffToPng nữa, vì URL trả về từ thumbnail endpoint là hình ảnh JPG/PNG.

          // Xác định tên thư mục chính gốc và cập nhật nếu có chỉnh sửa
          let originRootName = "";
          let relativePath = file.relativePath || undefined;

          if (file.relativePath && file.relativePath.includes("/")) {
            const parts = file.relativePath.split("/");
            const originalRoot = parts[0];
            if (mainFolderName && mainFolderName !== originalRoot) {
              parts[0] = mainFolderName;
              relativePath = parts.join("/");
              originRootName = mainFolderName;
            } else {
              originRootName = originalRoot;
            }
          } else {
            originRootName = mainFolderName || "Google Drive Folder";
          }

          // Tìm xem đã tồn tại rootFolderId của cùng thư mục chính trong imageItems chưa để gộp chung
          let rootId = "";
          const existingItem = imageItems.find((item) => item.rootFolderName === originRootName);
          if (existingItem) {
            rootId = existingItem.rootFolderId || "";
          }

          if (!rootId) {
            rootId = folderIdMap.get(originRootName) || "";
          }

          if (!rootId) {
            rootId = `${originRootName}_${Math.random().toString(36).substring(2, 9)}`;
            folderIdMap.set(originRootName, rootId);
          }

          return {
            id: file.id,
            name: file.name,
            source: "drive",
            originalUrl,
            processedUrl: null,
            status,
            progress: 0,
            selected: true,
            relativePath,
            rootFolderId: rootId,
            rootFolderName: originRootName,
            error: errorMsg,
          };
        })
      );

      setImageItems(newItems);
      setExtractionStats({ count: filtered.length });
      showNotification("Đã tìm thấy ảnh!", `Đã trích xuất được ${filtered.length} ảnh từ thư mục Google Drive.`);
    } finally {
      setIsConvertingTiff(false);
      setShowDriveFilterModal(false);
      setPendingDriveFiles([]);
      setDetectedDriveExtensions([]);
      setSelectedDriveExtensions([]);
    }
  };

  // Handle local files uploaded directly via Dropzone
  const handleLocalFilesSelected = async (files: File[]) => {
    setExtractionStats(null);
    const hasTiff = files.some((file) => file.name.toLowerCase().endsWith(".tif") || file.name.toLowerCase().endsWith(".tiff"));
    if (hasTiff) {
      setIsConvertingTiff(true);
    }

    try {
      const folderIdMap = new Map<string, string>();

      const newItems: ImageItem[] = await Promise.all(
        files.map(async (file) => {
          const isTiff = file.name.toLowerCase().endsWith(".tif") || file.name.toLowerCase().endsWith(".tiff");
          let originalUrl = URL.createObjectURL(file);
          let status: ImageItem["status"] = "pending";
          let errorMsg: string | undefined = undefined;

          if (isTiff) {
            try {
              originalUrl = await convertTiffToPng(originalUrl);
            } catch (err: any) {
              console.error("Lỗi chuyển đổi TIFF cục bộ:", err);
              status = "failed";
              errorMsg = `Lỗi chuyển đổi tệp TIFF: ${err.message}`;
            }
          }

          // Xác định tên thư mục chính gốc và cập nhật nếu có chỉnh sửa
          let originRootName = "";
          let relativePath = file.webkitRelativePath || undefined;

          if (file.webkitRelativePath && file.webkitRelativePath.includes("/")) {
            const parts = file.webkitRelativePath.split("/");
            const originalRoot = parts[0];
            if (mainFolderName && mainFolderName !== originalRoot) {
              parts[0] = mainFolderName;
              relativePath = parts.join("/");
              originRootName = mainFolderName;
            } else {
              originRootName = originalRoot;
            }
          } else {
            originRootName = mainFolderName || "Tệp tải lẻ";
          }

          // Tìm xem đã tồn tại rootFolderId của cùng thư mục chính trong imageItems chưa để gộp chung
          let rootId = "";
          const existingItem = imageItems.find((item) => item.rootFolderName === originRootName);
          if (existingItem) {
            rootId = existingItem.rootFolderId || "";
          }

          if (!rootId) {
            rootId = folderIdMap.get(originRootName) || "";
          }

          if (!rootId) {
            rootId = `${originRootName}_${Math.random().toString(36).substring(2, 9)}`;
            folderIdMap.set(originRootName, rootId);
          }

          return {
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            source: "upload",
            originalUrl,
            processedUrl: null,
            status,
            progress: 0,
            selected: status !== "failed",
            relativePath,
            rootFolderId: rootId,
            rootFolderName: originRootName,
            error: errorMsg,
          };
        })
      );

      setImageItems((prev) => [...prev, ...newItems]);
    } finally {
      setIsConvertingTiff(false);
    }
  };

  // Core Processing Loop
  const handleStartProcessing = async () => {
    if (imageItems.length === 0) return;
    setIsProcessing(true);
    isProcessingRef.current = true;

    const itemsToProcess = [...imageItems];
    const total = itemsToProcess.length;
    let completedCount = 0;
    let failedCount = 0;

    const CONCURRENCY_LIMIT = 3;

    const processItem = async (index: number) => {
      if (!isProcessingRef.current) return;
      const item = itemsToProcess[index];
      if (item.status === "completed") {
        completedCount++;
        return;
      }

      setImageItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "downloading", progress: 20 } : i))
      );

      try {
        let productImgUrl = item.originalUrl;

        if (!isProcessingRef.current) return;

        setImageItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "processing", progress: 60 } : i))
        );

        const processedDataUrl = await generateThumbnail(
          productImgUrl,
          config,
          logoImgRef.current
        );

        if (!isProcessingRef.current) return;

        setImageItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: "completed",
                  processedUrl: processedDataUrl,
                  progress: 100,
                  selected: true,
                }
              : i
          )
        );
        completedCount++;
      } catch (err: any) {
        if (!isProcessingRef.current) return;
        console.error(`Lỗi xử lý file ${item.name}:`, err);
        
        setImageItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: "failed",
                  error: err.message || "Lỗi nạp ảnh hoặc xử lý Canvas",
                  progress: 0,
                }
              : i
          )
        );
        failedCount++;
      }
    };

    let currentIdx = 0;
    const worker = async () => {
      while (currentIdx < total) {
        if (!isProcessingRef.current) break;
        const nextIdx = currentIdx++;
        await processItem(nextIdx);
      }
    };

    const workers = Array(Math.min(CONCURRENCY_LIMIT, total))
      .fill(null)
      .map(() => worker());

    await Promise.all(workers);

    setIsProcessing(false);

    // Save job to history only if there is any completed images
    if (completedCount > 0) {
      const historyItem: ProcessingHistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        folderName: googleDriveUrl ? "Từ link Google Drive" : "Tải lên trực tiếp từ máy",
        totalImages: total,
        successfulImages: completedCount,
        config: config,
      };

      const newHistory = [historyItem, ...history].slice(0, 30);
      setHistory(newHistory);
      localStorage.setItem("thumbnail_history", JSON.stringify(newHistory));
    }

    showNotification(
      isProcessingRef.current ? "Đã xử lý xong!" : "Đã dừng xử lý!",
      isProcessingRef.current 
        ? `Hoàn thành tạo ${completedCount} thumbnail sản phẩm thành công (${failedCount} lỗi).`
        : `Đã dừng tạo. Có ${completedCount} ảnh đã được tạo thành công.`
    );
  };

  const showNotification = (title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: logoPreviewUrl || undefined,
      });
    }
  };

  const handleToggleSelect = (id: string) => {
    setImageItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setImageItems((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  const handleSelectImages = (ids: string[], select: boolean) => {
    setImageItems((prev) =>
      prev.map((item) => (ids.includes(item.id) ? { ...item, selected: select } : item))
    );
  };

  const handleRenameRootFolder = (rootFolderId: string, newName: string) => {
    setImageItems((prev) =>
      prev.map((item) => {
        if (item.rootFolderId === rootFolderId) {
          let updatedRelativePath = item.relativePath;
          if (item.relativePath && item.relativePath.includes("/")) {
            const parts = item.relativePath.split("/");
            parts[0] = newName;
            updatedRelativePath = parts.join("/");
          } else {
            updatedRelativePath = `${newName}/${item.name}`;
          }
          return {
            ...item,
            rootFolderName: newName,
            relativePath: updatedRelativePath,
          };
        }
        return item;
      })
    );
  };

  const handleClearPending = () => {
    setImageItems((prev) => prev.filter((item) => item.status !== "pending"));
  };

  const handleRemoveItem = (id: string) => {
    setImageItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDeleteItems = (ids: string[]) => {
    setImageItems((prev) => prev.filter((item) => !ids.includes(item.id)));
  };

  const handleClearResults = (ids: string[]) => {
    setImageItems((prev) =>
      prev.map((item) =>
        ids.includes(item.id)
          ? {
              ...item,
              status: "pending",
              processedUrl: null,
              progress: 0,
            }
          : item
      )
    );
  };

  const handleApplyConfig = (oldConfig: ProcessorConfig) => {
    setConfig(oldConfig);
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("thumbnail_history");
  };

  const firstProductUrl = imageItems.length > 0 ? imageItems[0].originalUrl : null;

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-200 font-sans flex flex-col p-4 sm:p-6 select-none overflow-x-hidden">
      
      {isConvertingTiff && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-md w-full text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto" />
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Đang giải mã ảnh TIFF</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Hệ thống đang tự động tối ưu hóa và chuyển đổi các tệp ảnh TIFF sang định dạng PNG chất lượng cao để hiển thị mượt mà trên Canvas. Vui lòng đợi trong giây lát...
            </p>
          </div>
        </div>
      )}
      
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white uppercase">THUMB GEN v2.0</h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-widest">STATIC_HOSTING_OPTIMIZED</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white border border-slate-800 hover:border-slate-600 rounded-xl transition-all cursor-pointer bg-slate-900"
            title="Cài đặt Google API Key"
          >
            <Key className="w-3.5 h-3.5" />
            Cài đặt
          </button>
          {appMode === "advanced" && (
            <button
              onClick={() => setAppMode("simple")}
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white border border-slate-800 hover:border-slate-600 rounded-xl transition-all cursor-pointer bg-slate-900"
            >
              Về trang chính
            </button>
          )}
        </div>
      </header>

      {/* View Logic */}
      {appMode === "simple" ? (
        <div className="w-full max-w-6xl mx-auto space-y-6 py-4 flex-grow animate-in fade-in duration-300">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Cột trái: Chọn thương hiệu và Nạp tài nguyên (gọn gàng, tối ưu) */}
            <div className="lg:col-span-6 space-y-4">
              
              {/* Brand Selection Card */}
              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="space-y-1">
                  <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest">1. Chọn thương hiệu</h2>
                  <p className="text-[10px] text-slate-500">Mẫu logo sẽ được tự động đè lên góc của sản phẩm</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    type="button" 
                    onClick={() => setSelectedBrand("jbl")}
                    className={`relative py-3 px-4 rounded-xl border-2 flex items-center justify-center transition-all bg-white ${selectedBrand === 'jbl' ? 'border-indigo-500 shadow-md' : 'border-slate-800 hover:border-slate-700'}`}
                  >
                    <img src="/logos/JBL-logo.png" alt="JBL" className="max-h-7 object-contain pointer-events-none mx-auto" />
                    {selectedBrand === 'jbl' && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </button>

                  <button 
                    type="button" 
                    onClick={() => setSelectedBrand("hk")}
                    className={`relative py-3 px-4 rounded-xl border-2 flex items-center justify-center transition-all bg-white ${selectedBrand === 'hk' ? 'border-indigo-500 shadow-md' : 'border-slate-800 hover:border-slate-700'}`}
                  >
                    <img src="/logos/HK-logo.png" alt="Harman Kardon" className="max-h-7 object-contain pointer-events-none mx-auto" />
                    {selectedBrand === 'hk' && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Upload Resources Card (Link Drive & Dropzone song song 2 cột) */}
              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
                <div className="space-y-1 border-b border-slate-800/80 pb-2">
                  <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest">2. Nạp tài nguyên ảnh</h2>
                  <p className="text-[10px] text-slate-500">Kết nối Google Drive hoặc Tải lên cục bộ</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Cột trái: Drive Link Input */}
                  <div className="space-y-2.5 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <LinkIcon className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Quét qua Google Drive</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Dán link thư mục Google Drive..."
                          value={googleDriveUrl}
                          onChange={(e) => setGoogleDriveUrl(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-indigo-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleExtractDriveFolder}
                          disabled={isExtracting || !googleDriveUrl.trim()}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-lg cursor-pointer transition-all shrink-0"
                        >
                          {isExtracting ? "..." : "Quét"}
                        </button>
                      </div>
                    </div>

                    {extractionStats && (
                      <div className={`p-2 rounded-lg border flex gap-1.5 text-[10px] font-sans ${
                        extractionStats.error 
                          ? "bg-rose-950/20 border-rose-900/40 text-rose-300" 
                          : "bg-emerald-950/20 border-emerald-900/40 text-emerald-300"
                      }`}>
                        {extractionStats.error ? (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <p className="font-bold truncate">Lỗi: {extractionStats.error}</p>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <p className="font-bold">Phát hiện <b>{extractionStats.count}</b> ảnh.</p>
                          </>
                        )}
                      </div>
                    )}

                    <div className="p-2.5 bg-slate-950/40 border border-slate-800/50 rounded-xl space-y-1 text-[9px] text-slate-500">
                      <p className="font-bold text-slate-400 uppercase tracking-wider">CHÚ Ý DRIVE CÔNG KHAI:</p>
                      <ul className="list-disc pl-3 space-y-0.5">
                        <li>Thư mục cài ở chế độ công khai chia sẻ.</li>
                        <li>Tự quét toàn bộ ảnh của các thư mục con.</li>
                      </ul>
                    </div>
                  </div>

                  {/* Cột phải: Local dropzone */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Tải lên từ máy</span>
                    </div>
                    <Dropzone 
                      onFilesSelected={handleLocalFilesSelected} 
                      mainFolderName={mainFolderName}
                      onChangeMainFolderName={setMainFolderName}
                      compact={true}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons Area */}
              <div className="space-y-3">
                {imageItems.length > 0 && (
                  <div className="p-4 bg-slate-900/50 border border-slate-800/60 rounded-2xl text-center space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <p className="text-xs text-emerald-400 font-bold">
                      Đã nạp {imageItems.length} ảnh ({imageItems.filter(i => i.selected).length} ảnh được chọn tạo)
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (isProcessing) {
                            setIsProcessing(false);
                          } else {
                            setShowResultsModal(true);
                            handleStartProcessing();
                          }
                        }}
                        disabled={!isProcessing && imageItems.filter(i => i.selected).length === 0}
                        className={`py-3 text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all ${
                          isProcessing 
                            ? "bg-rose-600 hover:bg-rose-500 shadow-[0_0_25px_-8px_rgba(239,68,68,0.4)]" 
                            : "bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_25px_-8px_rgba(16,185,129,0.4)]"
                        }`}
                      >
                        {isProcessing ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                            Dừng tạo
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-white shrink-0" /> Bắt đầu tạo
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowResultsModal(true);
                        }}
                        className="py-3 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> Xem Kết quả
                      </button>
                    </div>
                  </div>
                )}

                {/* Switch Mode Button */}
                <div className="flex justify-center">
                  <button 
                    type="button" 
                    onClick={() => setAppMode("advanced")}
                    className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-white border border-slate-800 hover:border-slate-600 rounded-xl transition-all cursor-pointer bg-slate-900/40"
                  >
                    <Settings className="w-3.5 h-3.5" /> Chuyển sang Nâng cao (Tùy chỉnh Canvas)
                  </button>
                </div>
              </div>

            </div>

            {/* Cột phải: Cây cấu trúc thư mục & Ảnh (chiều cao khớp hoàn hảo với cột trái) */}
            <div className="lg:col-span-6 h-full">
              <FolderTree 
                items={imageItems}
                onSelectImages={handleSelectImages}
                defaultMainFolder={mainFolderName}
                onRenameFolder={handleRenameRootFolder}
                heightClass="h-[520px] lg:h-[590px]"
                onDeleteItems={handleDeleteItems}
              />
            </div>

          </div>

        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow">
        
        {/* Left Control Column (Span 5) */}
        <section className="lg:col-span-5 space-y-6 flex flex-col justify-between">
          <div className="space-y-6 flex-grow">
            {/* 2. Template Designer (Layout mẫu) */}
            <TemplateDesigner
              config={config}
              onChange={setConfig}
              logoPreviewUrl={logoPreviewUrl}
              productPreviewUrl={firstProductUrl}
              onLogoFileChange={setLogoFile}
            />
          </div>

          {/* E. History Panel (Hoán đổi sang cột trái) */}
          <HistoryPanel
            history={history}
            onApplyConfig={handleApplyConfig}
            onClearHistory={handleClearHistory}
            heightClass="max-h-[350px]"
          />
        </section>

        {/* Right Preview & History Column (Span 7) */}
        <section className="lg:col-span-7 space-y-6 flex flex-col justify-between">
          <div className="space-y-6 flex-grow flex flex-col">
            {/* Action trigger button (Cụm Đã nạp X sản phẩm dời lên trên cùng) */}
            {imageItems.length > 0 && (
              <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-200">
                <div>
                  <p className="text-sm font-bold text-white uppercase tracking-wider">
                    {isProcessing ? "Đang tạo ảnh hàng loạt..." : `Đã nạp ${imageItems.length} sản phẩm`}
                  </p>
                  <p className="text-[11px] text-slate-400 font-sans">
                    {isProcessing ? "Quá trình tự động hóa Canvas đang diễn ra." : "Nhấn bắt đầu để tiến hành căn lề, cắt viền và đè logo tự động."}
                  </p>
                </div>
                 <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (isProcessing) {
                        setIsProcessing(false);
                      } else {
                        setShowResultsModal(true);
                        handleStartProcessing();
                      }
                    }}
                    disabled={!isProcessing && imageItems.filter(i => i.selected).length === 0}
                    className={`px-5 py-2.5 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all shrink-0 text-white ${
                      isProcessing 
                        ? "bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-950/50" 
                        : "bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-950/50"
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                        Dừng tạo
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white shrink-0" /> Bắt đầu tạo Thumbnail
                      </>
                    )}
                  </button>
                  
                  {imageItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowResultsModal(true)}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all shrink-0"
                    >
                      <Eye className="w-4 h-4" /> Kết quả / Tiến độ
                    </button>
                  )}
                </div>
              </div>
            )}



            {/* Gộp cụm tải lên & logo lớn để tiết kiệm diện tích, chiều cao co giãn tự động để bao gọn */}
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
              <div>
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-3">
                  <Cpu className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Nạp tài nguyên (Ảnh & Logo)</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Cột trái: Google Drive và Tải lên trực tiếp */}
                  <div className="space-y-3 md:border-r md:border-slate-800/60 md:pr-4">
                    {/* Google Drive */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="w-4 h-4 text-indigo-400" />
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Liên kết Google Drive</h3>
                      </div>
                      
                      <p className="text-[10px] text-slate-500 font-sans">
                        Nhập liên kết công khai đến thư mục chứa ảnh.
                      </p>

                      <div className="space-y-1.5">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Dán link Google Drive..."
                            value={googleDriveUrl}
                            onChange={(e) => setGoogleDriveUrl(e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-indigo-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                          />
                          <button
                            type="button"
                            onClick={handleExtractDriveFolder}
                            disabled={isExtracting || !googleDriveUrl.trim()}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all shrink-0"
                          >
                            {isExtracting ? "..." : "Quét"}
                          </button>
                        </div>

                        {extractionStats && (
                          <div className={`p-2 rounded-xl border flex gap-2 text-[10px] font-sans ${
                            extractionStats.error 
                              ? "bg-rose-950/20 border-rose-900/40 text-rose-300" 
                              : "bg-emerald-950/20 border-emerald-900/40 text-emerald-300"
                          }`}>
                            {extractionStats.error ? (
                              <>
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                <div className="truncate">
                                  <p className="font-bold">Lỗi trích xuất!</p>
                                </div>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <div>
                                  <p className="font-bold">Phát hiện <b>{extractionStats.count}</b> ảnh hợp lệ.</p>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="h-[1px] bg-slate-800/30" />

                    {/* Dropzone */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-indigo-400" />
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tải lên trực tiếp hoặc Folder</h3>
                      </div>
                      <Dropzone 
                        onFilesSelected={handleLocalFilesSelected} 
                        mainFolderName={mainFolderName}
                        onChangeMainFolderName={setMainFolderName}
                        compact={true}
                      />
                    </div>
                  </div>

                  {/* Cột phải: Logo thương hiệu */}
                  <div>
                    <LogoUploader
                      config={config}
                      onChange={setConfig}
                      logoFile={logoFile}
                      onLogoChange={setLogoFile}
                      logoPreviewUrl={logoPreviewUrl}
                      noCardStyle={true}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* D. Progress Status Indicator (Hoán đổi sang cột phải và tăng chiều cao lên lấp chỗ trống) */}
          <ProcessingProgress
            items={imageItems}
            isProcessing={isProcessing}
            onCancel={() => setIsProcessing(false)}
            onClearPending={handleClearPending}
            onRemoveItem={handleRemoveItem}
            onSelectImages={handleSelectImages}
            onRenameFolder={handleRenameRootFolder}
            defaultMainFolder={mainFolderName}
            heightClass="h-[520px] lg:h-[820px]"
            onDeleteItems={handleDeleteItems}
          />
        </section>

      </div>
      )}

      {/* Drive Filter Modal */}
      <ExtensionFilterModal
        isOpen={showDriveFilterModal}
        files={pendingDriveFiles}
        detectedExtensions={detectedDriveExtensions}
        selectedExtensions={selectedDriveExtensions}
        onToggleExtension={(ext) => {
          setSelectedDriveExtensions((prev) =>
            prev.includes(ext) ? prev.filter((e) => e !== ext) : [...prev, ext]
          );
        }}
        onCancel={() => {
          setShowDriveFilterModal(false);
          setPendingDriveFiles([]);
          setDetectedDriveExtensions([]);
          setSelectedDriveExtensions([]);
          setExtractionStats({ count: 0, error: "Đã hủy thao tác lấy ảnh" });
        }}
        onConfirm={handleConfirmDriveUpload}
        mainFolderName={mainFolderName}
        onChangeMainFolderName={setMainFolderName}
      />

      {/* Results modal popup */}
      {showResultsModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-[1400px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Mục sản phẩm đã xử lý</h3>
                <p className="text-[10px] text-slate-400">Xem, so sánh và xuất tệp ZIP các sản phẩm đã hoàn tất</p>
              </div>
              <button
                type="button"
                onClick={() => setShowResultsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Đóng
              </button>
            </div>
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-950/30">
              <ThumbnailPreview
                items={imageItems}
                config={config}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onDeleteItems={handleClearResults}
                onChange={setConfig}
                mainFolderName={mainFolderName}
                onChangeMainFolderName={setMainFolderName}
                isProcessing={isProcessing}
                onCancelProcessing={() => setIsProcessing(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Status Bar / Realistic Footer */}
      <footer className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-500 font-mono bg-slate-900/40 px-4 py-2.5 rounded-xl border border-slate-800">
        <div className="flex flex-wrap gap-x-6 gap-y-1 justify-center sm:justify-start">
          <span className="flex items-center gap-1"><Cpu className="w-3 h-3 text-indigo-500" /> SYSTEM_ENGINE: WEB_CANVAS_V3</span>
          <span>RAM: {isProcessing ? "512MB / 16GB" : "180MB / 16GB"}</span>
          <span>SPEED: {isProcessing ? "24.8 IMG/S" : "0.0 IMG/S"}</span>
        </div>
        <div className="flex gap-4">
          <span>CORES: MULTI_THREADED</span>
          <span className="text-indigo-400">NOTIF_AGENT: ACTIVE</span>
        </div>
      </footer>

      <SettingsModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)}
        apiKey={googleApiKey}
        onSave={(key) => {
          setGoogleApiKey(key);
          localStorage.setItem("google_api_key", key);
        }}
      />
    </div>
  );
}
