export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  relativePath?: string;
}

export type ImageStatus = "pending" | "downloading" | "processing" | "completed" | "failed";

export interface ImageItem {
  id: string;
  name: string;
  source: "drive" | "upload";
  originalUrl: string; // Blob URL or Googleusercontent URL
  processedUrl: string | null; // DataURL or Blob URL of processed image
  status: ImageStatus;
  progress: number; // 0 to 100
  error?: string;
  width?: number;
  height?: number;
  selected?: boolean;
  relativePath?: string; // Webkit relative path for folder preservation
  rootFolderId?: string;   // ID duy nhất để phân biệt các thư mục chính
  rootFolderName?: string; // Tên hiển thị của thư mục chính (có thể đổi tên)
}

export type LogoPosition = 
  | "top-left" 
  | "top-right" 
  | "bottom-left" 
  | "bottom-right" 
  | "top-center" 
  | "bottom-center"
  | "center";

export interface ElementLayout {
  x: number;      // % of canvas width (0-100)
  y: number;      // % of canvas height (0-100)
  width: number;  // % of canvas width (1-100)
  height: number; // % of canvas height (1-100)
  rotation: number; // rotation in degrees (0-360)
}

export interface ProcessorConfig {
  width: number;
  height: number;
  paddingPercent: number; // percentage of content padding (e.g. 10%)
  backgroundColor: string; // e.g. "#ffffff" or "transparent"
  autoCenter: boolean; // Tự động track sản phẩm đưa vào giữa thumb
  logoUrl: string | null; // Brand logo
  logoPosition: LogoPosition;
  logoScale: number; // logo width as % of thumbnail size (e.g. 15%)
  logoPadding: number; // distance from canvas edges in px
  exportFormat: "png" | "jpeg";
  exportQuality: number; // 0.1 to 1.0
  maxJpgSizeMB?: number; // Dung lượng tối đa của file JPG tính bằng MB
  useCustomLayout?: boolean; // Sử dụng layout mẫu kéo thả thay vì tự động
  productLayout?: ElementLayout; // Cấu hình layout cho ảnh sản phẩm
  logoLayout?: ElementLayout; // Cấu hình layout cho logo thương hiệu
}

export interface LayoutPreset {
  id: string;
  name: string;
  isSystem?: boolean;
  productLayout: ElementLayout;
  logoLayout: ElementLayout;
  useCustomLayout: boolean;
}

export interface ProcessingHistoryItem {
  id: string;
  timestamp: string;
  folderName: string;
  totalImages: number;
  successfulImages: number;
  config: ProcessorConfig;
}
