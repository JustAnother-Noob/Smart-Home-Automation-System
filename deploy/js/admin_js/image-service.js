
;(function(root){
  const ImageService = {
    createObjectUrl(file) {
      try { return URL.createObjectURL(file); } catch { return null; }
    },
    revokeObjectUrl(url) {
      try { URL.revokeObjectURL(url); } catch {}
    },
    async compress(file, { maxWidth = 1600, maxHeight = 1600, quality = 0.85 } = {}) {
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio; height *= ratio;
          }
          canvas.width = width; canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          if (canvas.toBlob) {
            canvas.toBlob(resolve, file.type, quality);
          } else {
            try {
              const dataUrl = canvas.toDataURL(file.type, quality);
              const byteString = atob(dataUrl.split(',')[1]);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
              resolve(new Blob([ab], { type: file.type }));
            } catch { resolve(file); }
          }
        };
        img.onerror = () => resolve(file);
        img.src = this.createObjectUrl(file);
      });
    }
  };
  root.AdminImageService = ImageService;
})(window);

