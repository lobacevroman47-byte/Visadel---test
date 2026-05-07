// Сжатие изображений перед загрузкой в Supabase Storage.
//
// iPhone-фото обычно 4-8MB (HEIC/JPEG ~12 Мп). При плохом интернете в
// Telegram WebView это даёт долгий аплоад + жрёт квоту хранилища. Сжимаем
// до 1600px по длинной стороне в JPEG 80% — обычно 200-400 KB без потери
// читаемости документов / лиц.
//
// PDF и не-image файлы пропускаются как есть.

const MAX_DIM = 1600;
const QUALITY = 0.8;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file; // PDF и т.п. — без изменений
  if (file.type === 'image/gif') return file;       // GIF не имеет смысла пережимать
  if (file.size < 300_000) return file;             // <300 KB — уже компактно

  try {
    const dataUrl = await readAsDataUrl(file);
    const img = await loadImage(dataUrl);

    let { width, height } = img;
    if (width > MAX_DIM || height > MAX_DIM) {
      if (width >= height) {
        height = Math.round((height * MAX_DIM) / width);
        width = MAX_DIM;
      } else {
        width = Math.round((width * MAX_DIM) / height);
        height = MAX_DIM;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob: Blob | null = await new Promise(res =>
      canvas.toBlob(b => res(b), 'image/jpeg', QUALITY),
    );
    if (!blob) return file;

    // Заменяем расширение на .jpg чтобы соответствовало MIME
    const baseName = file.name.replace(/\.(heic|heif|jpe?g|png|webp)$/i, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch (e) {
    // Если сжатие провалилось — пускаем оригинал. Не хотим терять заявку
    // из-за ошибки в canvas/блобе.
    console.warn('[imageCompress] failed, using original:', e);
    return file;
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
