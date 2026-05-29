// ══════════════════════════════════════════════════════════
//  মেস মিল ট্র্যাকার — js/compress.js
//  Canvas দিয়ে image compress করে — 8MB → ~200KB
// ══════════════════════════════════════════════════════════

/**
 * @param {File} file - original image file
 * @param {number} maxSizeKB - target max size in KB (default 300)
 * @param {number} maxDim - max width/height in pixels (default 800)
 * @returns {Promise<Blob>} compressed image blob
 */
export async function compressImage(file, maxSizeKB = 300, maxDim = 800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if too large
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width  = maxDim;
        } else {
          width  = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas  = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Binary search for best quality
      let quality = 0.8;
      let lo = 0.1, hi = 0.95;
      const targetBytes = maxSizeKB * 1024;

      const tryQuality = (q) =>
        new Promise(res => canvas.toBlob(res, 'image/jpeg', q));

      (async () => {
        for (let i = 0; i < 6; i++) {
          const blob = await tryQuality(quality);
          if (!blob) break;
          if (blob.size <= targetBytes || hi - lo < 0.05) {
            return resolve(blob);
          }
          if (blob.size > targetBytes) {
            hi = quality;
            quality = (lo + hi) / 2;
          } else {
            lo = quality;
            quality = (lo + hi) / 2;
          }
        }
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
      })().catch(reject);
    };

    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}
