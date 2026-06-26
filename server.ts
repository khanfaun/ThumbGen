import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Extract PNG files from a public Google Drive folder
  app.post("/api/extract-drive-folder", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "Thiếu đường dẫn liên kết Google Drive" });
      }

      // Extract folder ID
      let folderId = url.trim();
      const folderIdMatch = url.match(/\/folders\/([a-zA-Z0-9_-]{25,})/);
      const queryIdMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
      
      if (folderIdMatch) {
        folderId = folderIdMatch[1];
      } else if (queryIdMatch) {
        folderId = queryIdMatch[1];
      }

      if (!/^[a-zA-Z0-9_-]{25,}$/.test(folderId)) {
        return res.status(400).json({ error: "Không tìm thấy Folder ID hợp lệ từ đường dẫn được nhập" });
      }

      console.log(`Extracting files recursively from folder: ${folderId}`);

      const files: { id: string; name: string; mimeType: string; relativePath?: string }[] = [];
      const seenIds = new Set<string>();
      const seenFolders = new Set<string>();

      // Helper function to decode individual object names and mime types (highly memory efficient)
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

      const imageExtensions = "png|jpe?g|jfif|webp|svg|gif|heic|heif|bmp|tiff?|raw|cr2|nef|arw|dng|psd|ai|eps|pdf";
      const fileExtRegex = new RegExp(`\\.(${imageExtensions})$`, "i");

      // Recursive extraction function
      const extractFolder = async (currentFolderId: string, currentPath: string = "") => {
        const driveUrl = `https://drive.google.com/drive/folders/${currentFolderId}`;
        const response = await fetch(driveUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
          },
        });

        if (!response.ok) {
          if (currentFolderId === folderId) {
             throw new Error(`Google Drive trả về mã trạng thái: ${response.status}`);
          }
          return; // skip if subfolder fetch fails
        }

        const html = await response.text();

        // Regex patterns matching raw HTML directly (no global decodeHtmlData, avoiding huge memory overhead)
        // 1. Hex-encoded objects (most common in public Drive HTML)
        const hexObjRegex = /\\x22([a-zA-Z0-9_-]{25,45})\\x22,\s*(?:\\x5b(?:\\x22([a-zA-Z0-9_-]{25,45})\\x22)?\\x5d|null)\s*,\s*\\x22(.*?)\\x22,\s*\\x22(.*?)\\x22/gi;

        // 2. Standard format (standard JSON syntax)
        const stdObjRegex = /\["([a-zA-Z0-9_-]{25,45})",\s*(?:\[\s*(?:"([a-zA-Z0-9_-]{25,45})")?\s*\]|null)\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"/gi;

        const subfolders: { id: string; name: string }[] = [];

        const processMatch = (id: string, parentId: string | undefined, rawName: string, rawMime: string) => {
          const name = unescapeDriveName(rawName);
          const mimeType = unescapeDriveName(rawMime);

          // If object is a subfolder
          if (mimeType === "application/vnd.google-apps.folder") {
            if (id !== currentFolderId && id !== folderId && !seenFolders.has(id) && id.length >= 25 && id.length <= 45) {
              seenFolders.add(id);
              subfolders.push({ id, name });
            }
          }
          // If object is an image file
          else if (mimeType.startsWith("image/") || fileExtRegex.test(name)) {
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
        // Process Hex-encoded matches
        while ((match = hexObjRegex.exec(html)) !== null) {
          processMatch(match[1], match[2], match[3], match[4]);
        }

        // Process Standard matches
        while ((match = stdObjRegex.exec(html)) !== null) {
          processMatch(match[1], match[2], match[3], match[4]);
        }

        // Process Subfolders recursively
        for (const sub of subfolders) {
          const subPath = currentPath ? `${currentPath}/${sub.name}` : sub.name;
          await extractFolder(sub.id, subPath);
        }
      };

      await extractFolder(folderId);

      console.log(`Extracted ${files.length} files from folder ${folderId}`);
      return res.json({
        success: true,
        folderId,
        files,
        count: files.length,
      });

    } catch (error: any) {
      console.error("Lỗi trích xuất folder Google Drive:", error);
      return res.status(500).json({
        error: "Không thể trích xuất dữ liệu từ Google Drive. Vui lòng đảm bảo thư mục đang ở chế độ công khai (Bất kỳ ai có liên kết đều có thể xem).",
        details: error.message,
      });
    }
  });

  // API Route: Proxy Google Drive image to avoid CORS and get original quality
  app.get("/api/proxy-image/:id", async (req, res) => {
    try {
      const id = req.params.id;
      if (!/^[a-zA-Z0-9_-]{25,}$/.test(id)) {
        return res.status(400).send("Invalid ID");
      }
      
      // Attempt 1: lh3 endpoint
      let driveUrl = `https://lh3.googleusercontent.com/d/${id}`;
      let response = await fetch(driveUrl);
      
      // Attempt 2: uc endpoint if lh3 fails
      if (!response.ok) {
        driveUrl = `https://drive.google.com/uc?export=download&id=${id}`;
        response = await fetch(driveUrl);
      }
      
      if (!response.ok) {
        return res.status(response.status).send("Failed to fetch image from Google Drive");
      }
      
      const contentType = response.headers.get("content-type") || "image/png";
      res.set("Content-Type", contentType);
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Cache-Control", "public, max-age=86400");
      
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error("Lỗi proxy ảnh:", err);
      res.status(500).send("Error proxying image");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
