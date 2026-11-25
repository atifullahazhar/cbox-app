const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : '';
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData) && !headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = getCookie('cbox_csrf');
    if (csrf) {
      headers.set('X-CSRF-Token', csrf);
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

/**
 * Uploads multipart FormData with real upload progress tracking via XMLHttpRequest.
 */
export function apiUploadWithProgress<T>(
  path: string,
  formData: FormData,
  onProgress?: (percent: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}${path}`, true);
    xhr.withCredentials = true;

    const csrf = getCookie('cbox_csrf');
    if (csrf) {
      xhr.setRequestHeader('X-CSRF-Token', csrf);
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data as T);
        } else {
          reject(new ApiError(data?.error || `Upload failed (${xhr.status})`, xhr.status));
        }
      } catch {
        reject(new ApiError('Invalid server response during upload.', xhr.status));
      }
    };

    xhr.onerror = () => {
      reject(new ApiError('Network error during upload. Check your connection and retry.', 0));
    };

    xhr.send(formData);
  });
}
