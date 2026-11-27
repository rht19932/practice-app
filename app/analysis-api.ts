export type Tag = { key: string; value: string };
export type Study = {
  id: string;
  name: string;
  description: string;
  tags: Tag[];
  occurrenceCount: number;
};
export type Image = {
  id: string;
  position: number;
  url: string;
  tags: Tag[];
  time: string | null;
  originalName: string;
};
export type Thought = {
  id: string;
  imageId: string;
  stageSnapshot: string;
  text: string;
  createdAt: string;
};
export type Occurrence = {
  id: string;
  studyId: string;
  title: string;
  date: string | null;
  notes: string;
  tags: Tag[];
  study: Study;
  imageCount: number;
  coverImage: Image;
  images?: Image[];
  thoughts?: Thought[];
};
export type Scope = 'study' | 'occurrence' | 'image';
export type Filter =
  | {
      type: 'rule';
      scope: Scope;
      key: string;
      test: 'is' | 'is-not' | 'has' | 'missing';
      value?: string;
    }
  | { type: 'group'; join: 'and' | 'or'; children: Filter[] }
  | { type: 'not' | 'image-match'; child: Filter };
export type GroupBy =
  { type: 'study' | 'date' | 'month' } | { type: 'tag'; scope: Scope; key: string };
export type SearchResult = {
  items: Occurrence[];
  groups: { path: (string | null)[]; count: number }[];
  total: number;
  page: number;
  pageSize: number;
  counts: { occurrences: number; images: number; tradingDays: number };
};
export const apiBase = (
  process.env.NEXT_PUBLIC_ANALYSIS_API_URL || 'http://localhost:4000/analysis'
).replace(/\/$/, '');
export const imageUrl = (url: string) => `${apiBase.replace(/\/analysis$/, '')}${url}`;
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export function upload(
  path: string,
  metadata: unknown,
  files: File[],
  onProgress: (value: number) => void
): Promise<Occurrence> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${apiBase}${path}`);
    const body = new FormData();
    body.append('metadata', JSON.stringify(metadata));
    files.forEach((file) => body.append('files', file));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () =>
      reject(new Error('Cannot reach the backend. Check that it is running.'));
    request.onload = () => {
      try {
        const result = JSON.parse(request.responseText);
        if (request.status >= 200 && request.status < 300) resolve(result);
        else reject(new Error(result.message || 'Upload failed'));
      } catch {
        reject(new Error('Invalid response from backend'));
      }
    };
    request.send(body);
  });
}
export const norm = (value: string) => value.normalize('NFKC').trim().toLowerCase();
export const stage = (image: Image) =>
  image.tags.find((tag) => norm(tag.key) === 'stage')?.value || `Image ${image.position + 1}`;
