// Сжатие изображений перед загрузкой в Supabase Storage.
//
// iPhone-фото обычно 4-8MB (HEIC/JPEG ~12 Мп). При плохом интернете в
// Telegram WebView это даёт долгий аплоад + жрёт квоту хранилища. Сжимаем
// до 1600px по длинной стороне в JPEG 80% — обычно 200-400 KB без потери
// читаемости документов / лиц.
//
// PDF и не-image файлы пропускаются как есть.
//
// Память: используем URL.createObjectURL вместо FileReader.readAsDataURL.
// dataURL даёт base64-строку 1.33× размера файла в JS-heap, что для
// 8MB HEIC = 11MB строка → может крашить Telegram WebView на iPhone.
// Object URL — это просто handle, реальные байты остаются в native памяти.

const MAX_DIM = 1600;
const QUALITY = 0.8;
const HARD_SIZE_LIMIT = 20 * 1024 * 1024; // 20 MB — выше WebView не вытягивает

export class ImageTooLargeError extends Error {
  constructor(public readonly sizeMB: number) {
    super(`Файл слишком большой (${sizeMB.toFixed(1)} MB). Максимум 20 MB.`);
    this.name = 'ImageTooLargeError';
  }
}

export async function compressImage(file: File): Promise<File> {
  // Hard limit: WebView Telegram'а на iPhone крашится на >20MB файлах при
  // попытке прочитать → выбрасываем явную ошибку, чтобы caller показал toast
  // вместо тихого зависания.
  if (file.size > HARD_SIZE_LIMIT) {
    throw new ImageTooLargeError(file.size / 1024 / 1024);
  }
  if (!file.type.startsWith('image/')) return file; // PDF и т.п. — без изменений
  if (file.type === 'image/gif') return file;       // GIF не имеет смысла пережимать
  if (file.size < 300_000) return file;             // <300 KB — уже компактно

  let objectUrl: string | null = null;
  try {
    objectUrl = URL.createObjectURL(file);
    const img = await loadImage(objectUrl);

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
    // Если сжатие провалилось (например HEIC, которое browser не понимает) —
    // пускаем оригинал. Лучше загрузить большой файл, чем потерять заявку.
    console.warn('[imageCompress] failed, using original:', e);
    return file;
  } finally {
    // Освобождаем object URL — не держим ссылку на байты в памяти
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch { /* noop */ }
    }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Таймаут 15 сек — если изображение не загрузилось (например HEIC которое
    // browser не понимает), не висим бесконечно
    const timer = setTimeout(() => reject(new Error('image load timeout')), 15000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('image load failed')); };
    img.src = src;
  });
}
