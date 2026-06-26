import { ProcessorConfig } from "../types";
import UTIF from "utif";

/**
 * Converts a TIFF image URL (either Blob URL or Proxy URL) to a PNG Data URL
 */
export async function convertTiffToPng(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Không thể tải dữ liệu ảnh TIFF từ nguồn: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  
  const ifds = UTIF.decode(arrayBuffer);
  if (!ifds || ifds.length === 0) {
    throw new Error("Không thể giải mã tệp TIFF: Định dạng không hợp lệ hoặc dữ liệu trống.");
  }
  
  UTIF.decodeImage(arrayBuffer, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  
  const width = ifds[0].width;
  const height = ifds[0].height;
  
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Không thể tạo 2D context để chuyển đổi ảnh TIFF");
  }
  
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(rgba);
  ctx.putImageData(imageData, 0, 0);
  
  return canvas.toDataURL("image/png");
}

/**
 * Loads an image from URL and returns an HTMLImageElement
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error("Không thể tải ảnh. Có thể do lỗi mạng hoặc chặn CORS."));
    img.src = url;
  });
}

/**
 * Detects the bounding box of the actual product within an image.
 * Works for both transparency (Alpha channel) and solid white/black backgrounds.
 */
export function detectContentBoundingBox(
  img: HTMLImageElement,
  threshold: number = 10
): { x: number; y: number; width: number; height: number } {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = img.naturalWidth || img.width;
  tempCanvas.height = img.naturalHeight || img.height;
  const ctx = tempCanvas.getContext("2d");
  if (!ctx) {
    return { x: 0, y: 0, width: img.width, height: img.height };
  }

  // Draw original image onto temp canvas
  ctx.drawImage(img, 0, 0);
  const width = tempCanvas.width;
  const height = tempCanvas.height;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let hasContent = false;

  // 1. Detect if image has transparent pixels
  let hasTransparency = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) {
      hasTransparency = true;
      break;
    }
  }

  if (hasTransparency) {
    // Detect bounding box by looking for non-transparent pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        if (alpha > threshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          hasContent = true;
        }
      }
    }
  } else {
    // If fully opaque, we assume the top-left pixel is the background color.
    // We look for pixels that differ from this background color.
    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];
    const colorThreshold = 25; // Sensitivity to color differences

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const diff = Math.sqrt(
          Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2)
        );

        if (diff > colorThreshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          hasContent = true;
        }
      }
    }
  }

  if (!hasContent) {
    // Fallback if no content is found (empty image)
    return { x: 0, y: 0, width, height };
  }

  // Add 4px padding around bounding box to prevent clipping edge pixels
  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Main process to generate a high quality product thumbnail with logo positioning and auto-centering
 */
export async function generateThumbnail(
  productImgUrl: string,
  config: ProcessorConfig,
  logoImgElement: HTMLImageElement | null
): Promise<string> {
  // Load product image
  const productImg = await loadImage(productImgUrl);
  
  // Create target canvas
  const canvas = document.createElement("canvas");
  canvas.width = config.width;
  canvas.height = config.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Không thể khởi tạo Canvas 2D context");
  }

  // Draw background
  if (config.backgroundColor === "transparent") {
    ctx.clearRect(0, 0, config.width, config.height);
  } else {
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, config.width, config.height);
  }

  // Enable image smoothing for high quality resizing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  let sourceX = 0;
  let sourceY = 0;
  let sourceW = productImg.naturalWidth || productImg.width;
  let sourceH = productImg.naturalHeight || productImg.height;

  if (config.autoCenter) {
    // 1. Auto-track and crop to product bounding box
    const bbox = detectContentBoundingBox(productImg);
    sourceX = bbox.x;
    sourceY = bbox.y;
    sourceW = bbox.width;
    sourceH = bbox.height;
  }

  // Draw product
  if (config.useCustomLayout && config.productLayout) {
    const pLayout = config.productLayout;
    // Map percentages (0-100) to actual canvas pixels
    const destW = (pLayout.width / 100) * config.width;
    const destH = (pLayout.height / 100) * config.height;
    const destX = (pLayout.x / 100) * config.width;
    const destY = (pLayout.y / 100) * config.height;

    const centerX = destX + destW / 2;
    const centerY = destY + destH / 2;

    // Proportionally scale product image to contain inside the custom layout box
    const scale = Math.min(destW / sourceW, destH / sourceH);
    const fitW = sourceW * scale;
    const fitH = sourceH * scale;

    ctx.save();
    ctx.translate(centerX, centerY);
    if (pLayout.rotation) {
      ctx.rotate((pLayout.rotation * Math.PI) / 180);
    }
    ctx.drawImage(
      productImg,
      sourceX,
      sourceY,
      sourceW,
      sourceH,
      -fitW / 2,
      -fitH / 2,
      fitW,
      fitH
    );
    ctx.restore();
  } else {
    // Normal auto layout
    const paddingX = config.width * (config.paddingPercent / 100);
    const paddingY = config.height * (config.paddingPercent / 100);
    const contentW = config.width - paddingX * 2;
    const contentH = config.height - paddingY * 2;

    const scale = Math.min(contentW / sourceW, contentH / sourceH);
    const destW = sourceW * scale;
    const destH = sourceH * scale;

    const destX = (config.width - destW) / 2;
    const destY = (config.height - destH) / 2;

    ctx.drawImage(
      productImg,
      sourceX,
      sourceY,
      sourceW,
      sourceH,
      destX,
      destY,
      destW,
      destH
    );
  }

  // 4. Overlap Brand Logo if available
  if (logoImgElement) {
    if (config.useCustomLayout && config.logoLayout) {
      const lLayout = config.logoLayout;
      // Map percentages to pixels
      const destW = (lLayout.width / 100) * config.width;
      const destH = (lLayout.height / 100) * config.height;
      const destX = (lLayout.x / 100) * config.width;
      const destY = (lLayout.y / 100) * config.height;

      const centerX = destX + destW / 2;
      const centerY = destY + destH / 2;

      const logoW = logoImgElement.naturalWidth || logoImgElement.width;
      const logoH = logoImgElement.naturalHeight || logoImgElement.height;
      const scale = Math.min(destW / logoW, destH / logoH);
      const fitW = logoW * scale;
      const fitH = logoH * scale;

      ctx.save();
      ctx.translate(centerX, centerY);
      if (lLayout.rotation) {
        ctx.rotate((lLayout.rotation * Math.PI) / 180);
      }
      ctx.drawImage(
        logoImgElement,
        -fitW / 2,
        -fitH / 2,
        fitW,
        fitH
      );
      ctx.restore();
    } else {
      const logoW = config.width * (config.logoScale / 100);
      // Keep aspect ratio
      const logoAspect = logoImgElement.naturalHeight / logoImgElement.naturalWidth;
      const logoH = logoW * logoAspect;

      let logoX = config.logoPadding;
      let logoY = config.logoPadding;

      switch (config.logoPosition) {
        case "top-left":
          logoX = config.logoPadding;
          logoY = config.logoPadding;
          break;
        case "top-right":
          logoX = config.width - logoW - config.logoPadding;
          logoY = config.logoPadding;
          break;
        case "bottom-left":
          logoX = config.logoPadding;
          logoY = config.height - logoH - config.logoPadding;
          break;
        case "bottom-right":
          logoX = config.width - logoW - config.logoPadding;
          logoY = config.height - logoH - config.logoPadding;
          break;
        case "top-center":
          logoX = (config.width - logoW) / 2;
          logoY = config.logoPadding;
          break;
        case "bottom-center":
          logoX = (config.width - logoW) / 2;
          logoY = config.height - logoH - config.logoPadding;
          break;
        case "center":
          logoX = (config.width - logoW) / 2;
          logoY = (config.height - logoH) / 2;
          break;
      }

      ctx.drawImage(logoImgElement, logoX, logoY, logoW, logoH);
    }
  }

  // Export to Data URL based on desired format
  if (config.exportFormat === "jpeg" && config.maxJpgSizeMB) {
    const maxSizeBytes = config.maxJpgSizeMB * 1024 * 1024;
    let quality = config.exportQuality || 0.9;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    let estimatedSize = (dataUrl.length - (dataUrl.indexOf(',') + 1)) * 0.75;

    while (estimatedSize > maxSizeBytes && quality > 0.1) {
      quality -= 0.05;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
      estimatedSize = (dataUrl.length - (dataUrl.indexOf(',') + 1)) * 0.75;
    }
    return dataUrl;
  }

  if (config.exportFormat === "png") {
    return canvas.toDataURL("image/png");
  }
  return canvas.toDataURL("image/jpeg", config.exportQuality);
}
