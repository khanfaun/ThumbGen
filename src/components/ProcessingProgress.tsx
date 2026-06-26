import React from "react";
import { ImageItem } from "../types";
import { Loader2, CheckCircle2, AlertTriangle, Activity, Trash2 } from "lucide-react";
import FolderTree from "./FolderTree";

interface ProcessingProgressProps {
  items: ImageItem[];
  isProcessing: boolean;
  onCancel?: () => void;
  onClearPending?: () => void;
  onRemoveItem?: (id: string) => void;
  onSelectImages: (ids: string[], select: boolean) => void;
  onRenameFolder?: (rootFolderId: string, newName: string) => void;
  defaultMainFolder: string;
  heightClass?: string;
  onDeleteItems?: (ids: string[]) => void;
}

export default function ProcessingProgress({
  items,
  isProcessing,
  onCancel,
  onClearPending,
  onRemoveItem,
  onSelectImages,
  onRenameFolder,
  defaultMainFolder,
  heightClass = "h-[320px]",
  onDeleteItems,
}: ProcessingProgressProps) {
  if (items.length === 0) return null;

  const total = items.length;
  const completed = items.filter((item) => item.status === "completed").length;
  const failed = items.filter((item) => item.status === "failed").length;
  const pending = items.filter((item) => item.status === "pending").length;
  const active = total - completed - failed - pending;

  const progressPercent = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-xl border border-slate-800 p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-250" id="progress-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className={`w-5 h-5 ${isProcessing ? "text-indigo-400 animate-pulse" : "text-slate-500"}`} />
          <h3 className="font-bold text-white text-sm uppercase tracking-wider">Trạng thái xử lý hàng loạt</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-full bg-indigo-950/80 border border-indigo-900/40 text-indigo-300">
            {completed + failed} / {total} HOÀN TẤT
          </span>
          {pending > 0 && onClearPending && (
            <button
              onClick={onClearPending}
              className="text-xs text-rose-400 hover:text-rose-300 font-bold px-2.5 py-1 hover:bg-rose-950/40 border border-rose-900/30 rounded-lg transition-colors cursor-pointer"
            >
              Xóa chờ ({pending})
            </button>
          )}
          {isProcessing && onCancel && (
            <button
              onClick={onCancel}
              className="text-xs text-rose-400 hover:text-rose-300 font-bold px-2.5 py-1 hover:bg-rose-950/40 border border-rose-900/30 rounded-lg transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
          <span>TIẾN TRÌNH CHUNG</span>
          <span className="text-indigo-400">{progressPercent}%</span>
        </div>
        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
          <div
            className="bg-indigo-500 h-full rounded-full transition-all duration-300 shadow-md shadow-indigo-500/20"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Stats Breakdown */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
        <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tổng số</p>
          <p className="font-bold text-slate-200 text-sm mt-0.5">{total}</p>
        </div>
        <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
          <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Đang xử lý</p>
          <p className="font-bold text-indigo-300 text-sm mt-0.5">{active}</p>
        </div>
        <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Thành công</p>
          <p className="font-bold text-emerald-300 text-sm mt-0.5">{completed}</p>
        </div>
        <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
          <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Lỗi</p>
          <p className="font-bold text-rose-300 text-sm mt-0.5">{failed}</p>
        </div>
      </div>

      {/* Cây cấu trúc thư mục tích hợp trạng thái xử lý */}
      <div className="mt-2">
        <FolderTree 
          items={items}
          onSelectImages={onSelectImages}
          defaultMainFolder={defaultMainFolder}
          onRenameFolder={onRenameFolder}
          title="Trạng thái xử lý theo cấu trúc cây"
          heightClass={heightClass}
          onDeleteItems={onDeleteItems}
        />
      </div>
    </div>
  );
}
