import React, { useState, useEffect } from "react";
import { 
  Folder, 
  FolderOpen, 
  ChevronDown, 
  ChevronRight, 
  FileImage, 
  CheckSquare2, 
  Square, 
  MinusSquare,
  FolderTree as TreeIcon,
  Check,
  X,
  Edit2,
  Trash2
} from "lucide-react";
import { ImageItem } from "../types";

// Định nghĩa cấu trúc Node
interface TreeFileNode {
  id: string;
  name: string;
  item: ImageItem;
}

interface TreeFolderNode {
  id: string; // Có thể là rootFolderId hoặc đường dẫn con
  name: string;
  path: string; // Đường dẫn tuyệt đối trong cây
  subfolders: Map<string, TreeFolderNode>;
  files: TreeFileNode[];
  isRoot: boolean;
}

interface FolderTreeProps {
  items: ImageItem[];
  onSelectImages: (ids: string[], select: boolean) => void;
  defaultMainFolder: string;
  onRenameFolder?: (rootFolderId: string, newName: string) => void;
  title?: string;
  heightClass?: string; // Tùy chọn chiều cao cố định hoặc linh hoạt
  onDeleteItems?: (ids: string[]) => void;
}

// Hàm xây dựng cây thư mục đệ quy từ danh sách phẳng
function buildFolderTree(items: ImageItem[]): TreeFolderNode[] {
  const rootFolders = new Map<string, TreeFolderNode>(); // key là rootFolderId

  items.forEach((item) => {
    const rId = item.rootFolderId || "default_root";
    const rName = item.rootFolderName || "Thư mục tải lẻ";

    let currentFolder = rootFolders.get(rId);
    if (!currentFolder) {
      currentFolder = {
        id: rId,
        name: rName,
        path: rId,
        subfolders: new Map(),
        files: [],
        isRoot: true
      };
      rootFolders.set(rId, currentFolder);
    }

    // Xử lý các thư mục con dựa trên relativePath
    let pathParts: string[] = [];
    if (item.relativePath) {
      pathParts = item.relativePath.split("/").filter(Boolean);
    }

    if (pathParts.length > 1) {
      // Bỏ qua phần tử đầu tiên (vì phần tử đầu là tên thư mục gốc, đã được đại diện bởi rId và rName)
      let currentPath = rId;
      for (let i = 1; i < pathParts.length - 1; i++) {
        const subName = pathParts[i];
        currentPath = `${currentPath}/${subName}`;
        let subFolder = currentFolder.subfolders.get(subName);
        if (!subFolder) {
          subFolder = {
            id: currentPath,
            name: subName,
            path: currentPath,
            subfolders: new Map(),
            files: [],
            isRoot: false
          };
          currentFolder.subfolders.set(subName, subFolder);
        }
        currentFolder = subFolder;
      }
    }

    currentFolder.files.push({
      id: item.id,
      name: item.name,
      item,
    });
  });

  return Array.from(rootFolders.values());
}

// Lấy tất cả các ID ảnh nằm sâu bên trong một folder node
function getAllImageIdsInFolder(folder: TreeFolderNode): string[] {
  const ids: string[] = [];
  folder.files.forEach(f => ids.push(f.id));
  folder.subfolders.forEach(sub => {
    ids.push(...getAllImageIdsInFolder(sub));
  });
  return ids;
}

// Lấy tất cả các ImageItem nằm sâu bên trong một folder node
function getAllImagesInFolder(folder: TreeFolderNode): ImageItem[] {
  const images: ImageItem[] = [];
  folder.files.forEach(f => images.push(f.item));
  folder.subfolders.forEach(sub => {
    images.push(...getAllImagesInFolder(sub));
  });
  return images;
}

export default function FolderTree({
  items,
  onSelectImages,
  defaultMainFolder,
  onRenameFolder,
  title = "Cấu trúc cây thư mục",
  heightClass = "h-[580px]",
  onDeleteItems,
}: FolderTreeProps) {
  // Xây dựng cây thư mục từ items
  const folderTree = buildFolderTree(items);

  // Lưu trạng thái mở/rộng của các folder (sử dụng đường dẫn path làm key)
  const [expandedFolders, setExpandedFolders] = useState<{ [key: string]: boolean }>({});

  // Lưu trạng thái chỉnh sửa tên inline của thư mục chính
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState<string>("");

  // Mặc định tự động mở rộng tất cả các thư mục khi mới có dữ liệu nạp vào
  useEffect(() => {
    if (items.length > 0) {
      const newExpanded: { [key: string]: boolean } = { ...expandedFolders };
      const autoExpand = (nodes: TreeFolderNode[]) => {
        nodes.forEach(node => {
          if (newExpanded[node.path] === undefined) {
            newExpanded[node.path] = true;
          }
          autoExpand(Array.from(node.subfolders.values()));
        });
      };
      autoExpand(folderTree);
      setExpandedFolders(newExpanded);
    }
  }, [items.length]);

  const toggleExpand = (path: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const handleStartEditing = (folderId: string, currentName: string) => {
    setEditingFolderId(folderId);
    setEditingNameValue(currentName);
  };

  const handleSaveRename = (folderId: string) => {
    if (editingNameValue.trim() && onRenameFolder) {
      onRenameFolder(folderId, editingNameValue.trim());
    }
    setEditingFolderId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, folderId: string) => {
    if (e.key === "Enter") {
      handleSaveRename(folderId);
    } else if (e.key === "Escape") {
      setEditingFolderId(null);
    }
  };

  // Tính toán trạng thái "Tick All" trên toàn hệ thống
  const allImages = items;
  const selectedCount = allImages.filter(img => img.selected).length;
  const isAllChecked = allImages.length > 0 && selectedCount === allImages.length;
  const isAnyChecked = selectedCount > 0;
  const isMasterIndeterminate = isAnyChecked && !isAllChecked;

  const handleMasterCheckboxChange = () => {
    if (isAllChecked) {
      // Bỏ chọn tất cả
      onSelectImages(allImages.map(img => img.id), false);
    } else {
      // Chọn tất cả
      onSelectImages(allImages.map(img => img.id), true);
    }
  };

  // Render một folder đệ quy
  const renderFolderNode = (folder: TreeFolderNode, depth: number = 0) => {
    const isExpanded = !!expandedFolders[folder.path];
    const folderImages = getAllImagesInFolder(folder);
    const folderImageIds = folderImages.map(img => img.id);
    
    const totalCount = folderImages.length;
    const selectedInFolderCount = folderImages.filter(img => img.selected).length;
    
    const isChecked = totalCount > 0 && selectedInFolderCount === totalCount;
    const isIndeterminate = selectedInFolderCount > 0 && selectedInFolderCount < totalCount;

    const handleFolderCheckboxChange = () => {
      onSelectImages(folderImageIds, !isChecked);
    };

    const isEditingThis = editingFolderId === folder.id;

    return (
      <div key={folder.path} className="select-none">
        {/* Folder Header Row */}
        <div 
          className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-800/40 rounded-lg group transition-colors duration-150 text-slate-300 text-xs"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Collapse/Expand trigger icon */}
            <button
              type="button"
              onClick={() => toggleExpand(folder.path)}
              className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300 focus:outline-none transition-colors shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Checkbox */}
            <button
              type="button"
              onClick={handleFolderCheckboxChange}
              className="p-1 text-slate-400 hover:text-indigo-400 transition-colors shrink-0"
            >
              {isChecked ? (
                <CheckSquare2 className="w-4 h-4 text-indigo-500" />
              ) : isIndeterminate ? (
                <MinusSquare className="w-4 h-4 text-indigo-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* Folder Icon & Name / Inline Editor */}
            <div className="flex items-center gap-1.5 cursor-pointer truncate flex-grow min-w-0">
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-amber-400 shrink-0" />
              )}

              {isEditingThis ? (
                <div className="flex items-center gap-1 flex-grow">
                  <input
                    type="text"
                    value={editingNameValue}
                    onChange={(e) => setEditingNameValue(e.target.value)}
                    onBlur={() => handleSaveRename(folder.id)}
                    onKeyDown={(e) => handleKeyDown(e, folder.id)}
                    className="px-2 py-0.5 bg-slate-950 border border-indigo-500 rounded text-xs text-white focus:outline-none w-full max-w-[200px]"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveRename(folder.id);
                    }}
                    className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-500"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFolderId(null);
                    }}
                    className="p-1 bg-slate-800 text-slate-400 rounded hover:bg-slate-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => toggleExpand(folder.path)}
                  className="flex items-center gap-1.5 truncate flex-grow group/title min-w-0"
                >
                  <span className="font-medium text-slate-200 truncate">{folder.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">({selectedInFolderCount}/{totalCount})</span>
                  
                  {folder.isRoot && onRenameFolder && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEditing(folder.id, folder.name);
                      }}
                      className="p-1 text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded opacity-0 group-hover/title:opacity-100 transition-opacity ml-1 shrink-0"
                      title="Sửa tên thư mục xuất"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Folder Children (Subfolders & Files) */}
        {isExpanded && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Render subfolders first */}
            {Array.from(folder.subfolders.values()).map(sub => renderFolderNode(sub, depth + 1))}

            {/* Render files in this folder */}
            {folder.files.map(file => {
              const isImgSelected = file.item.selected;
              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between py-1 px-2 hover:bg-slate-800/20 rounded-lg group transition-colors duration-150 text-slate-400 text-[11px]"
                  style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Checkbox for image */}
                    <button
                      type="button"
                      onClick={() => onSelectImages([file.id], !isImgSelected)}
                      className="p-1 text-slate-500 hover:text-indigo-400 transition-colors shrink-0"
                    >
                      {isImgSelected ? (
                        <CheckSquare2 className="w-3.5 h-3.5 text-indigo-500" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-700" />
                      )}
                    </button>

                    {/* File icon and name */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-grow">
                      {file.item.originalUrl ? (
                        <img 
                          src={file.item.originalUrl} 
                          alt="" 
                          referrerPolicy="no-referrer"
                          className="w-4 h-4 rounded bg-slate-900 border border-slate-800/60 object-contain shrink-0"
                        />
                      ) : (
                        <FileImage className="w-3.5 h-3.5 text-indigo-400/80 shrink-0" />
                      )}
                      <span className="truncate text-slate-300">{file.name}</span>
                    </div>

                    {/* Status indicator on tree */}
                    <span className={`text-[9px] font-mono shrink-0 px-1.5 py-0.5 rounded-full ${
                      file.item.status === "completed" ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40" :
                      file.item.status === "failed" ? "bg-rose-950/40 text-rose-400 border border-rose-900/40" :
                      file.item.status === "processing" ? "bg-indigo-950/40 text-indigo-400 border border-indigo-900/40 animate-pulse" :
                      "bg-slate-950/40 text-slate-500 border border-slate-800"
                    }`}>
                      {file.item.status === "completed" && "Xong"}
                      {file.item.status === "failed" && "Lỗi"}
                      {file.item.status === "processing" && "Đang xử lý"}
                      {file.item.status === "downloading" && "Tải..."}
                      {file.item.status === "pending" && "Chờ"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col ${heightClass} bg-slate-950/60 rounded-2xl border border-slate-800 overflow-hidden shadow-inner`}>
      {/* Cây thư mục Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/40 shrink-0">
        <div className="flex items-center gap-2">
          <TreeIcon className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">{title}</span>
        </div>
        <div className="flex items-center gap-2.5">
          {onDeleteItems && selectedCount > 0 && (
            <button
              type="button"
              onClick={() => {
                const selectedIds = allImages.filter(img => img.selected).map(img => img.id);
                onDeleteItems(selectedIds);
              }}
              className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 border border-rose-900/60 text-rose-300 hover:text-rose-200 text-[10px] font-bold uppercase transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              Xóa đã chọn
            </button>
          )}
          <span className="text-[10px] text-slate-500 font-mono">{selectedCount} / {allImages.length} được chọn</span>
        </div>
      </div>

      {/* "Tick All" Master Row */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800/50 bg-slate-900/20 text-xs shrink-0">
        <button
          type="button"
          onClick={handleMasterCheckboxChange}
          className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
          disabled={allImages.length === 0}
        >
          {isAllChecked ? (
            <CheckSquare2 className="w-4 h-4 text-indigo-500" />
          ) : isMasterIndeterminate ? (
            <MinusSquare className="w-4 h-4 text-indigo-400" />
          ) : (
            <Square className="w-4 h-4 text-slate-700" />
          )}
        </button>
        <span 
          onClick={handleMasterCheckboxChange}
          className="font-bold text-slate-300 uppercase tracking-widest cursor-pointer hover:text-white"
        >
          Chọn tất cả (Tick All)
        </span>
      </div>

      {/* Cây thư mục Content - Chiều cao co giãn tự động có thanh trượt */}
      <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-1">
        {allImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center space-y-2">
            <Folder className="w-8 h-8 text-slate-700 stroke-[1.5]" />
            <p className="text-xs text-slate-500 font-medium">Chưa có thư mục nào được nạp</p>
            <p className="text-[10px] text-slate-600 leading-normal max-w-[200px]">
              Tải thư mục lên hoặc dán link Google Drive bên trái để tự động lập cây cấu trúc thư mục.
            </p>
          </div>
        ) : (
          folderTree.map(node => renderFolderNode(node))
        )}
      </div>
    </div>
  );
}
