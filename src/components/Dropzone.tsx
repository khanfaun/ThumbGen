import React, { useState, useRef } from "react";
import { UploadCloud, FolderOpen } from "lucide-react";
import ExtensionFilterModal from "./ExtensionFilterModal";

export function getCleanFolderNameFromFile(fileName: string): string {
  // Loại bỏ phần đuôi mở rộng (.png, .jpg, ...)
  let name = fileName.replace(/\.[a-zA-Z0-9]+$/, "");
  
  // Loại bỏ số thứ tự đứng đầu như "01. ", "02- "
  name = name.replace(/^\d+[\s.-]*/, "");
  
  // Thay thế dấu gạch dưới và gạch ngang bằng dấu cách để trông sạch sẽ hơn
  name = name.replace(/[_-]/g, " ");
  
  // Loại bỏ các từ mô tả ảnh thông thường (không phân biệt chữ hoa chữ thường)
  const wordsToRemove = [
    /\bfront\b/gi, /\bback\b/gi, /\bside\b/gi, /\bleft\b/gi, /\bright\b/gi, 
    /\bhero\b/gi, /\bdetail\b/gi, /\baccessories\b/gi, /\bbox\b/gi,
    /\bproduct\b/gi, /\bimage\b/gi, /\bcushion\b/gi, /\bbuttons\b/gi,
    /\bboxside\b/gi, /\bdetail\b/gi
  ];
  
  wordsToRemove.forEach(regex => {
    name = name.replace(regex, "");
  });

  // Dọn dẹp khoảng trắng dư thừa
  name = name.replace(/\s+/g, " ").trim();

  return name || "Thư mục xuất";
}

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  mainFolderName: string;
  onChangeMainFolderName: (name: string) => void;
  compact?: boolean;
}

export default function Dropzone({
  onFilesSelected,
  mainFolderName,
  onChangeMainFolderName,
  compact = false,
}: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Modal states for folder selection
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [detectedExtensions, setDetectedExtensions] = useState<string[]>([]);
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>([]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const processFiles = (files: File[], isFolder: boolean = false) => {
    const filesArray = Array.from(files);
    
    // Danh sách toàn bộ các định dạng đuôi file hình ảnh được hỗ trợ
    const SUPPORTED_EXTS = [
      "PNG", "JPG", "JPEG", "JFIF", "WEBP", "SVG", "GIF", 
      "HEIC", "HEIF", "BMP", "TIFF", "TIF", "RAW", "CR2", 
      "NEF", "ARW", "DNG", "PSD", "AI", "EPS", "PDF"
    ];

    // Trích xuất các định dạng đuôi file hợp lệ
    const extMap: { [key: string]: number } = {};
    const validFiles: File[] = [];

    filesArray.forEach((file) => {
      const nameLower = file.name.toLowerCase();
      const match = nameLower.match(/\.([a-z0-9]+)$/);
      const ext = match ? match[1].toUpperCase() : "";
      
      if (ext && SUPPORTED_EXTS.includes(ext)) {
        extMap[ext] = (extMap[ext] || 0) + 1;
        validFiles.push(file);
      }
    });

    const uniqueExts = Object.keys(extMap).sort();

    if (validFiles.length === 0) return;

    // Tự động nhận diện tên thư mục chính khi tải lên cả folder hoặc file trực tiếp
    const itemWithPath = validFiles.find(item => item.webkitRelativePath && item.webkitRelativePath.includes("/"));
    if (itemWithPath && itemWithPath.webkitRelativePath) {
      const firstSegment = itemWithPath.webkitRelativePath.split("/")[0];
      if (firstSegment) {
        onChangeMainFolderName(firstSegment);
      }
    } else if (validFiles.length > 0) {
      // Nếu tải lên trực tiếp (không có cấu trúc thư mục), lấy tên của file đầu tiên làm gợi ý tên thư mục chính
      const cleanName = getCleanFolderNameFromFile(validFiles[0].name);
      onChangeMainFolderName(cleanName);
    }

    // Chỉ khi người dùng chọn chế độ tải lên cả thư mục (isFolder === true) mới hiển thị Modal lọc đuôi file
    if (isFolder) {
      setPendingFiles(validFiles);
      setDetectedExtensions(uniqueExts);
      
      // Chỉ chọn sẵn PNG nếu có, các đuôi khác không tự chọn sẵn theo yêu cầu
      if (uniqueExts.includes("PNG")) {
        setSelectedExtensions(["PNG"]);
      } else {
        setSelectedExtensions([]);
      }
      
      setShowFilterModal(true);
    } else {
      // Nếu tải trực tiếp các tệp tin, nạp toàn bộ các file ảnh hợp lệ ngay lập tức
      onFilesSelected(validFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files), false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isFolder: boolean) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files), isFolder);
      // Reset input value so same files can be selected again if needed
      e.target.value = "";
    }
  };

  const toggleExtension = (ext: string) => {
    if (selectedExtensions.includes(ext)) {
      setSelectedExtensions(selectedExtensions.filter((e) => e !== ext));
    } else {
      setSelectedExtensions([...selectedExtensions, ext]);
    }
  };

  const handleConfirmUpload = () => {
    const filtered = pendingFiles.filter((file) => {
      const match = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
      const ext = match ? match[1].toUpperCase() : "";
      return selectedExtensions.includes(ext);
    });

    onFilesSelected(filtered);
    setShowFilterModal(false);
    setPendingFiles([]);
    setDetectedExtensions([]);
    setSelectedExtensions([]);
  };

  return (
    <div className={compact ? "space-y-2.5" : "space-y-4"}>
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
          compact ? "p-4 min-h-[120px]" : "p-8 min-h-[180px]"
        } ${
          isDragActive
            ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
            : "border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/80"
        }`}
        id="dropzone-container"
      >
        <UploadCloud className={`${compact ? "w-8 h-8 mb-1.5" : "w-10 h-10 mb-3"} transition-colors ${isDragActive ? "text-indigo-400 animate-bounce" : "text-slate-500"}`} />
        
        <p className={`${compact ? "text-xs" : "text-sm"} font-semibold text-slate-200`}>Kéo thả ảnh sản phẩm vào đây</p>
        <p className={`${compact ? "text-[10px]" : "text-xs"} text-slate-500 mt-1`}>Hoặc bấm để duyệt ảnh từ máy tính</p>
        
        {!compact && (
          <p className="text-[10px] text-indigo-400 mt-3.5 bg-indigo-950/60 border border-indigo-900/30 px-3 py-1 rounded-full font-mono">
            SUPPORT: PNG, JPG, WEBP, TIFF
          </p>
        )}
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFileChange(e, false)}
          multiple
          accept="image/*, .tif, .tiff"
          className="hidden"
        />
      </div>

      <div className={`flex items-center justify-center ${compact ? "gap-2" : "gap-3"}`}>
        {!compact && <span className="text-xs text-slate-600 font-mono">HOẶC</span>}
        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          className={`${compact ? "px-3 py-1.5 text-[10px]" : "px-4 py-2 text-xs"} border border-slate-800 bg-slate-950/40 hover:bg-slate-950 hover:border-slate-700 rounded-xl font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer w-full`}
        >
          <FolderOpen className={compact ? "w-3.5 h-3.5 text-indigo-400" : "w-4 h-4 text-indigo-400"} />
          Chọn cả Thư mục ảnh (Folder)
        </button>
        <input
          type="file"
          ref={folderInputRef}
          onChange={(e) => handleFileChange(e, true)}
          multiple
          className="hidden"
          {...{ webkitdirectory: "", directory: "" } as any}
        />
      </div>

      {/* Popup Modal for filtering extensions */}
      <ExtensionFilterModal
        isOpen={showFilterModal}
        files={pendingFiles}
        detectedExtensions={detectedExtensions}
        selectedExtensions={selectedExtensions}
        onToggleExtension={toggleExtension}
        onCancel={() => {
          setShowFilterModal(false);
          setPendingFiles([]);
          setDetectedExtensions([]);
          setSelectedExtensions([]);
        }}
        onConfirm={handleConfirmUpload}
        mainFolderName={mainFolderName}
        onChangeMainFolderName={onChangeMainFolderName}
      />
    </div>
  );
}
