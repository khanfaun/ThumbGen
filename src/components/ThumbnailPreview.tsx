import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { ImageItem, ProcessorConfig } from "../types";
import { Download, FileDown, CheckSquare, Square, Eye, Grid, List, Trash2, AlertTriangle } from "lucide-react";
import JSZip from "jszip";

const getFriendlySize = (dataUrl?: string) => {
  if (!dataUrl) return "--- KB";
  const base64Index = dataUrl.indexOf(',');
  if (base64Index === -1) return "--- KB";
  const bytes = (dataUrl.length - (base64Index + 1)) * 0.75;
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface ThumbnailPreviewProps {
  items: ImageItem[];
  config: ProcessorConfig;
  onToggleSelect: (id: string) => void;
  onSelectAll: (select: boolean) => void;
  onDeleteItems?: (ids: string[]) => void;
  onChange?: (config: ProcessorConfig) => void;
  mainFolderName: string;
  onChangeMainFolderName: (name: string) => void;
  isProcessing?: boolean;
  onCancelProcessing?: () => void;
}

export default function ThumbnailPreview({
  items,
  config,
  onToggleSelect,
  onSelectAll,
  onDeleteItems,
  onChange,
  mainFolderName,
  onChangeMainFolderName,
  isProcessing,
  onCancelProcessing,
}: ThumbnailPreviewProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [lightboxItem, setLightboxItem] = useState<ImageItem | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "single" | "bulk"; id?: string } | null>(null);

  // Tiến trình tạo ảnh preview (processing progress)
  const totalItems = items.length;
  const processedCount = items.filter((item) => item.status === "completed" || item.status === "failed").length;
  const failedCount = items.filter((item) => item.status === "failed").length;
  const processPercent = totalItems > 0 ? Math.round((processedCount / totalItems) * 100) : 0;

  // Quản lý trạng thái chỉnh sửa thư mục chính
  const [isEditingMainFolder, setIsEditingMainFolder] = useState<boolean>(false);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (onDeleteItems) {
      if (deleteTarget.type === "single" && deleteTarget.id) {
        onDeleteItems([deleteTarget.id]);
      } else if (deleteTarget.type === "bulk") {
        onDeleteItems(selectedItems.map((item) => item.id));
      }
    }
    setDeleteTarget(null);
  };

  const completedItems = items.filter((item) => item.status === "completed" && item.processedUrl);
  const selectedItems = completedItems.filter((item) => item.selected);

  // Tách đường dẫn thư mục con (ví dụ: "JBL Clip 5/Black/img.png" -> "Black")
  const getSubfolderPath = (relativePath?: string) => {
    if (!relativePath || !relativePath.includes("/")) return "";
    const parts = relativePath.split("/");
    if (parts.length <= 2) return ""; // Root/file.png -> không có thư mục con
    return parts.slice(1, -1).join("/"); // Trả về "Black" hoặc "Black/Sub"
  };

  // Lấy tất cả các thư mục chính duy nhất hiện tại
  const activeRootNames = useMemo(() => {
    const names = new Set<string>();
    items.forEach((item) => {
      if (item.rootFolderName) {
        names.add(item.rootFolderName);
      }
    });
    const arr = Array.from(names);
    if (arr.length === 0) {
      return [mainFolderName];
    }
    return arr;
  }, [items, mainFolderName]);

  const zipRootName = useMemo(() => {
    if (activeRootNames.length <= 1) {
      return activeRootNames[0] || mainFolderName;
    }
    return activeRootNames.join(" + ");
  }, [activeRootNames, mainFolderName]);

  // Gom nhóm sản phẩm đã hoàn thành theo thư mục chính và thư mục con
  const groupedItems = useMemo(() => {
    const groups: {
      [groupKey: string]: {
        rootFolderName: string;
        rootFolderId: string;
        subPath: string;
        items: ImageItem[];
      };
    } = {};

    for (const item of completedItems) {
      const rId = item.rootFolderId || "default_root";
      const rName = item.rootFolderName || mainFolderName || "Thư mục chính";
      const sub = getSubfolderPath(item.relativePath);
      const groupKey = `${rId}::${sub}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          rootFolderName: rName,
          rootFolderId: rId,
          subPath: sub,
          items: [],
        };
      }
      groups[groupKey].items.push(item);
    }
    return groups;
  }, [completedItems, mainFolderName]);

  // Download a single item
  const handleSingleDownload = (item: ImageItem) => {
    if (!item.processedUrl) return;
    const link = document.createElement("a");
    link.href = item.processedUrl;
    const ext = config.exportFormat === "png" ? "png" : "jpg";
    const baseName = item.name.substring(0, item.name.lastIndexOf(".")) || item.name;
    link.download = `${baseName}_thumb.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export selected items as a ZIP file preserving structure and custom main folder
  const handleBatchExport = async () => {
    const itemsToExport = selectedItems;
    if (itemsToExport.length === 0) return;

    setIsExporting(true);
    setExportProgress(5);

    try {
      const zip = new JSZip();
      const ext = config.exportFormat === "png" ? "png" : "jpg";

      for (let i = 0; i < itemsToExport.length; i++) {
        const item = itemsToExport[i];
        if (!item.processedUrl) continue;

        let zipFilePath = "";
        const originalFileName = item.name;
        const baseName = originalFileName.substring(0, originalFileName.lastIndexOf(".")) || originalFileName;
        const newFileName = `${baseName}_thumb.${ext}`;

        if (item.relativePath && item.relativePath.includes("/")) {
          const parts = item.relativePath.split("/");
          // Giữ nguyên cấu trúc thư mục chính của từng file thay vì ép đổi tất cả thành mainFolderName
          // Chỉ thay tên file bằng tên mới có đuôi phù hợp
          parts[parts.length - 1] = newFileName;
          zipFilePath = parts.join("/");
        } else {
          // Nếu không có cấu trúc thư mục sẵn, xếp trực tiếp vào thư mục chính mặc định của item
          const folderName = item.rootFolderName || mainFolderName;
          zipFilePath = `${folderName}/${newFileName}`;
        }

        const base64Data = item.processedUrl.split(",")[1];
        zip.file(zipFilePath, base64Data, { base64: true });

        setExportProgress(Math.round(5 + (i / itemsToExport.length) * 85));
      }

      setExportProgress(90);
      const content = await zip.generateAsync({ type: "blob" }, (metadata) => {
        setExportProgress(Math.round(90 + metadata.percent * 0.1));
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      
      let zipName = "thumbnails_export";
      if (activeRootNames.length > 0) {
        zipName = activeRootNames.map(name => name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_")).join("_");
      }
      link.download = `${zipName}.zip`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Đã xuất xong!", {
          body: `Đã đóng gói và tải về thành công ${itemsToExport.length} ảnh thumbnail vào thư mục ${zipRootName}.`,
        });
      }
    } catch (err) {
      console.error("Lỗi đóng gói file ZIP:", err);
      alert("Đã xảy ra lỗi khi đóng gói file ZIP: " + err);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  if (items.length === 0) return null;

  const allSelected = completedItems.length > 0 && completedItems.every((item) => item.selected);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" id="preview-panel">
      {/* Cột Trái: Danh sách hình ảnh */}
      <div className="lg:col-span-8 space-y-6 bg-slate-900/40 p-5 rounded-3xl border border-slate-800/80">
        {/* Header and Bulk actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-white text-base uppercase tracking-wider flex items-center gap-2">
              <span>Sản phẩm đã xử lý ({completedItems.length})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Bản xem trước sản phẩm đã chèn logo thương hiệu tự động.</p>
          </div>

          {/* Action Controls */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Select Buttons */}
            <button
              type="button"
              onClick={() => onSelectAll(!allSelected)}
              className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-950 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {allSelected ? <Square className="w-3.5 h-3.5 text-indigo-400" /> : <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />}
              {allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>

            {/* Bulk Delete Button */}
            {selectedItems.length > 0 && (
              <button
                type="button"
                onClick={() => setDeleteTarget({ type: "bulk" })}
                className="px-3 py-1.5 rounded-xl border border-rose-900 bg-rose-950/20 hover:bg-rose-900/40 text-xs font-semibold text-rose-300 hover:text-rose-200 flex items-center gap-1.5 cursor-pointer transition-colors animate-in fade-in duration-150"
                title="Xóa tất cả kết quả đã chọn"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                Xóa đã chọn ({selectedItems.length})
              </button>
            )}

            {/* Grid/List View switcher */}
            <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-800">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === "grid" ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-300"}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === "list" ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-300"}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      {/* Hiển thị sắp xếp theo cấu trúc thư mục */}
      <div className="space-y-6">
        {completedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 bg-slate-950/40 rounded-2xl border border-slate-800/40">
            <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <div>
              <p className="text-sm font-bold text-white uppercase tracking-wider">Đang khởi tạo & tạo ảnh preview...</p>
              <p className="text-xs text-slate-400 mt-1">Hệ thống đang tự động căn chỉnh vị trí, xóa viền và ghép logo thương hiệu.</p>
              <p className="text-[10px] text-slate-500 font-mono mt-3">TIẾN TRÌNH: {processedCount} / {totalItems} ẢNH</p>
            </div>
          </div>
        ) : (
          (Object.values(groupedItems) as Array<{
            rootFolderName: string;
            rootFolderId: string;
            subPath: string;
            items: ImageItem[];
          }>).map((groupData) => {
            const { rootFolderName, rootFolderId, subPath, items: subItems } = groupData;
            const groupKey = `${rootFolderId}::${subPath}`;
            if (subItems.length === 0) return null;
            return (
              <div key={groupKey} className="space-y-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60 animate-in fade-in duration-200">
                {/* Folder Header */}
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <span className="text-amber-500 text-sm">📁</span>
                    <span className="font-mono text-indigo-300">
                      {subPath ? `${rootFolderName} / ${subPath}` : `${rootFolderName} (Thư mục gốc)`}
                    </span>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 font-normal">
                      {subItems.length} ảnh
                    </span>
                  </div>
                </div>

              {/* Grid Mode or List Mode for this subfolder */}
              {viewMode === "grid" ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {subItems.map((item) => (
                    <div
                      key={item.id}
                      className={`group relative rounded-2xl border transition-all overflow-hidden bg-slate-950 flex flex-col ${
                        item.selected ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {/* Image Preview Container */}
                      <div className="aspect-square relative flex items-center justify-center overflow-hidden bg-slate-900/50 p-2">
                        {/* Inspect/Zoom Trigger (Overlay) */}
                        <button
                          type="button"
                          onClick={() => setLightboxItem(item)}
                          className="absolute top-2.5 right-2.5 z-10 p-1.5 rounded-lg bg-slate-950/90 border border-slate-800 text-slate-400 hover:text-indigo-400 hover:scale-105 transition-all shadow-md cursor-pointer opacity-0 group-hover:opacity-100"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Processed Thumbnail Image */}
                        {item.processedUrl && (
                          <img
                            src={item.processedUrl}
                            alt={item.name}
                            className="w-full h-full object-contain max-h-full max-w-full transition-transform group-hover:scale-[1.02]"
                          />
                        )}
                      </div>

                      {/* Info & Footer Actions */}
                      <div className="p-3 bg-slate-900 border-t border-slate-800 flex-1 flex flex-col justify-between">
                        <div className="flex items-start gap-2 mb-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => onToggleSelect(item.id)}
                            className="mt-0.5 text-slate-500 hover:text-indigo-400 transition-colors shrink-0 cursor-pointer"
                            title={item.selected ? "Bỏ chọn" : "Chọn ảnh này"}
                          >
                            {item.selected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-200 truncate" title={item.name}>
                              {item.name}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {config.width}x{config.height} • {config.exportFormat.toUpperCase()} • {getFriendlySize(item.processedUrl)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => handleSingleDownload(item)}
                            className="flex-1 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-white flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <Download className="w-3.5 h-3.5 text-indigo-400" /> Tải về
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ type: "single", id: item.id })}
                            className="p-1.5 bg-slate-950 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900 rounded-xl text-slate-500 hover:text-rose-400 cursor-pointer transition-colors shrink-0"
                            title="Xóa kết quả này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800 bg-slate-950/40">
                  {subItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 transition-colors ${
                        item.selected ? "bg-indigo-500/5" : "hover:bg-slate-900/30"
                      }`}
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        {/* Checkbox */}
                        <button type="button" onClick={() => onToggleSelect(item.id)} className="cursor-pointer">
                          {item.selected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </button>

                        {/* Thumbnail Tiny Preview */}
                        <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex items-center justify-center p-1">
                          {item.processedUrl && (
                            <img src={item.processedUrl} alt={item.name} className="max-w-full max-h-full object-contain" />
                          )}
                        </div>

                        {/* Detail */}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {config.exportFormat.toUpperCase()} • {config.width}x{config.height}px • {getFriendlySize(item.processedUrl)}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setLightboxItem(item)}
                          className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                          title="So sánh ảnh trước/sau"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSingleDownload(item)}
                          className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                          title="Tải về"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ type: "single", id: item.id })}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-lg cursor-pointer transition-colors"
                          title="Xóa kết quả này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
       )}
      </div>
    </div>

      {/* Cột Phải: Cấu hình xuất và Tiến trình */}
      <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-5 lg:sticky lg:top-4 shadow-xl animate-in fade-in slide-in-from-right-3 duration-350">
        {/* 1. Thư mục xuất chính */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <span className="text-base">📁</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Thư mục xuất chính</span>
                <span className="text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-1.5 py-0.2 rounded font-mono uppercase font-bold">ZIP ROOT</span>
              </div>
              {isEditingMainFolder && activeRootNames.length <= 1 ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={mainFolderName}
                    onChange={(e) => onChangeMainFolderName(e.target.value)}
                    className="w-full px-2.5 py-1 bg-slate-900 border border-indigo-500 text-white rounded-lg text-xs font-bold focus:outline-none"
                    placeholder="Tên thư mục chính..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setIsEditingMainFolder(false);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingMainFolder(false)}
                    className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded cursor-pointer transition-colors"
                  >
                    Lưu
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-extrabold text-indigo-300 truncate font-mono" title={zipRootName}>{zipRootName}</span>
                  {activeRootNames.length <= 1 && (
                    <button
                      type="button"
                      onClick={() => setIsEditingMainFolder(true)}
                      className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer font-semibold"
                    >
                      Sửa
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="text-[10px] text-slate-400 font-mono flex justify-between border-t border-slate-800/60 pt-2">
            <div>TỔNG CỘNG: <span className="text-white font-bold">{completedItems.length} tệp đã xử lý</span></div>
            <div>THƯ MỤC CON: <span className="text-indigo-400 font-bold">{Object.keys(groupedItems).filter(k => k !== "").length}</span></div>
          </div>
        </div>

        {/* 2. Cụm định dạng và dung lượng */}
        {onChange && (
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col gap-2 border-b border-slate-800/60 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Định dạng & Dung lượng xuất</span>
              <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800 w-full">
                <button
                  type="button"
                  onClick={() => onChange({ ...config, exportFormat: "png" })}
                  className={`flex-1 py-1.5 text-[10px] md:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    config.exportFormat === "png"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  PNG (Gốc)
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...config, exportFormat: "jpeg" })}
                  className={`flex-1 py-1.5 text-[10px] md:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    config.exportFormat === "jpeg"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  JPG (Nén)
                </button>
              </div>
            </div>

            {config.exportFormat === "jpeg" && (
              <div className="space-y-3 pt-1">
                {/* Quality slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-400 font-semibold">
                    <span>Chất lượng hình ảnh</span>
                    <span className="font-mono text-indigo-400">{Math.round(config.exportQuality * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={config.exportQuality}
                    onChange={(e) => onChange({ ...config, exportQuality: parseFloat(e.target.value) })}
                    className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Max file size (Dung lượng tối đa) */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-400 font-semibold">
                    <span>Giới hạn dung lượng tối đa</span>
                    <span className="font-mono text-emerald-400">{config.maxJpgSizeMB || 1} MB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0.1"
                      max="10"
                      step="0.1"
                      value={config.maxJpgSizeMB || 1}
                      onChange={(e) => onChange({ ...config, maxJpgSizeMB: parseFloat(e.target.value) || 1 })}
                      className="flex-1 px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-indigo-300 font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">MB</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Tiến trình xử lý */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${processPercent === 100 ? "bg-emerald-500" : "bg-indigo-500 animate-pulse"}`}></span>
              <span className="font-bold uppercase tracking-wider text-slate-300">Tiến trình xử lý</span>
            </div>
            <span className="font-mono text-indigo-400 font-bold">{processPercent}% ({processedCount}/{totalItems})</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
            <div 
              className="bg-indigo-600 h-full rounded-full transition-all duration-300 relative overflow-hidden"
              style={{ width: `${processPercent}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" style={{ backgroundSize: '200% 100%' }}></div>
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>Trạng thái: {processPercent === 100 ? "Đã xong" : "Đang tạo ảnh..."}</span>
            {failedCount > 0 && <span className="text-rose-400 font-semibold">{failedCount} lỗi</span>}
          </div>
        </div>

        {/* 4. Nút xuất ZIP */}
        <div className="space-y-2">
          {isProcessing ? (
            <button
              type="button"
              onClick={onCancelProcessing}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-rose-950/30 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
              DỪNG TẠO
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBatchExport}
              disabled={isExporting || processPercent < 100 || selectedItems.length === 0}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-850 disabled:text-slate-500 disabled:cursor-not-allowed disabled:border disabled:border-slate-800 text-white font-bold text-sm uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/30 cursor-pointer transition-all"
            >
              {isExporting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang nén ZIP ({exportProgress}%)
                </>
              ) : (
                <>
                  <FileDown className="w-5 h-5" />
                  XUẤT ZIP ({selectedItems.length} ảnh)
                </>
              )}
            </button>
          )}

          {/* Trạng thái giải thích vì sao bị disable */}
          {!isProcessing && processPercent < 100 && (
            <p className="text-[10px] text-amber-500/90 text-center font-bold uppercase tracking-wider animate-pulse">
              ⚠️ Đang chờ xử lý tạo ảnh hoàn tất...
            </p>
          )}
          {!isProcessing && processPercent === 100 && selectedItems.length === 0 && (
            <p className="text-[10px] text-rose-400 text-center font-bold uppercase tracking-wider">
              ❌ Hãy chọn ít nhất 1 ảnh để tải ZIP
            </p>
          )}
        </div>
      </div>
    </div>

      {/* Lightbox / Compare Dialog */}
      {lightboxItem && createPortal(
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div>
                <h4 className="font-bold text-white text-base">{lightboxItem.name}</h4>
                <p className="text-xs text-slate-400">So sánh hình ảnh gốc với thumbnail kết quả</p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full cursor-pointer transition-colors font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Compare Content */}
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/30">
              {/* Original Box */}
              <div className="flex flex-col space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">1. Ảnh Gốc</p>
                <div className="border border-slate-800 rounded-2xl bg-slate-950 p-4 h-[350px] flex items-center justify-center relative overflow-hidden">
                  <div
                    className="absolute inset-0 opacity-[0.02]"
                    style={{
                      backgroundImage: "radial-gradient(#ffffff 1.5px, transparent 1.5px)",
                      backgroundSize: "16px 16px",
                    }}
                  />
                  <img
                    src={lightboxItem.originalUrl}
                    alt="Original"
                    className="max-h-full max-w-full object-contain relative z-10"
                  />
                </div>
              </div>

              {/* Processed Box */}
              <div className="flex flex-col space-y-2">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono">2. Thumbnail Gắn Logo ({config.width}x{config.height})</p>
                <div className="border border-indigo-900/40 rounded-2xl bg-slate-950 p-4 h-[350px] flex items-center justify-center relative overflow-hidden ring-4 ring-indigo-500/5">
                  {lightboxItem.processedUrl && (
                    <img
                      src={lightboxItem.processedUrl}
                      alt="Processed"
                      className="max-h-full max-w-full object-contain relative z-10"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="px-6 py-4 border-t border-slate-800 flex justify-between items-center bg-slate-950/50">
              <span className="text-xs text-slate-400 font-mono">
                SIZE: {config.width} x {config.height} px • {config.exportFormat.toUpperCase()} • {getFriendlySize(lightboxItem.processedUrl)}
              </span>
              <button
                type="button"
                onClick={() => {
                  handleSingleDownload(lightboxItem);
                  setLightboxItem(null);
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-950/40 cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4" /> TẢI VỀ ẢNH NÀY
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Delete Confirmation Modal (Bỏ qua window.confirm) */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-950 flex items-center justify-center border border-rose-900 shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="font-bold text-white text-sm uppercase tracking-wider">Xác nhận xóa</h4>
                <p className="text-xs text-slate-400 font-sans leading-relaxed">
                  {deleteTarget.type === "single"
                    ? "Bạn có chắc chắn muốn xóa hình ảnh kết quả này? Hành động này không thể hoàn tác."
                    : `Bạn có chắc chắn muốn xóa ${selectedItems.length} hình ảnh đã chọn? Hành động này không thể hoàn tác.`}
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white cursor-pointer transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/30 cursor-pointer transition-colors"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
