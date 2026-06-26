exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const { url } = body;
    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Thiếu đường dẫn liên kết Google Drive",
        }),
      };
    }

    let folderId = url.trim();
    const folderIdMatch = url.match(/\/folders\/([a-zA-Z0-9_-]{25,})/);
    const queryIdMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);

    if (folderIdMatch) folderId = folderIdMatch[1];
    else if (queryIdMatch) folderId = queryIdMatch[1];

    if (!/^[a-zA-Z0-9_-]{25,}$/.test(folderId)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Không tìm thấy Folder ID hợp lệ từ đường dẫn được nhập",
        }),
      };
    }

    const files = [];
    const seenIds = new Set();
    const seenFolders = new Set();

    const unescapeDriveName = (str) => {
      try {
        let result = str.replace(/\\x([0-9a-fA-F]{2})/g, (m, hex) =>
          String.fromCharCode(parseInt(hex, 16)),
        );
        result = result.replace(/\\u([0-9a-fA-F]{4})/g, (m, hex) =>
          String.fromCharCode(parseInt(hex, 16)),
        );
        result = result
          .replace(/\\"/g, '"')
          .replace(/\\'/g, "'")
          .replace(/\\\//g, "/")
          .replace(/\\\\/g, "\\");
        return result;
      } catch (e) {
        return str;
      }
    };

    const imageExtensions =
      "png|jpe?g|jfif|webp|svg|gif|heic|heif|bmp|tiff?|raw|cr2|nef|arw|dng|psd|ai|eps|pdf";
    const fileExtRegex = new RegExp(`\\.(${imageExtensions})$`, "i");

    const extractFolder = async (currentFolderId, currentPath = "") => {
      const driveUrl = `https://drive.google.com/drive/folders/${currentFolderId}`;
      const response = await fetch(driveUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      });

      if (!response.ok) {
        if (currentFolderId === folderId)
          throw new Error(`Google Drive API trả về ${response.status}`);
        return;
      }

      const html = await response.text();
      const hexObjRegex =
        /\\x22([a-zA-Z0-9_-]{25,45})\\x22,\s*(?:\\x5b(?:\\x22([a-zA-Z0-9_-]{25,45})\\x22)?\\x5d|null)\s*,\s*\\x22(.*?)\\x22,\s*\\x22(.*?)\\x22/gi;
      const stdObjRegex =
        /\["([a-zA-Z0-9_-]{25,45})",\s*(?:\[\s*(?:"([a-zA-Z0-9_-]{25,45})")?\s*\]|null)\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"/gi;

      const subfolders = [];

      const processMatch = (id, parentId, rawName, rawMime) => {
        const name = unescapeDriveName(rawName);
        const mimeType = unescapeDriveName(rawMime);

        if (mimeType === "application/vnd.google-apps.folder") {
          if (
            id !== currentFolderId &&
            id !== folderId &&
            !seenFolders.has(id) &&
            id.length >= 25 &&
            id.length <= 45
          ) {
            seenFolders.add(id);
            subfolders.push({ id, name });
          }
        } else if (mimeType.startsWith("image/") || fileExtRegex.test(name)) {
          if (
            !seenIds.has(id) &&
            id.length >= 25 &&
            id.length <= 45 &&
            !id.startsWith("http")
          ) {
            seenIds.add(id);
            const ext = name.split(".").pop()?.toLowerCase() || "";
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
        await extractFolder(sub.id, subPath);
      }
    };

    await extractFolder(folderId);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        folderId,
        files,
        count: files.length,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error:
          "Không thể trích xuất dữ liệu từ Google Drive. Vui lòng đảm bảo thư mục đang ở chế độ công khai (Bất kỳ ai có liên kết đều có thể xem).",
        details: error.message,
      }),
    };
  }
};
