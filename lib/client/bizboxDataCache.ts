const CACHE_TTL_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 15_000;

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

type InboxData<TDocument> = {
  success: boolean;
  documents?: TDocument[];
  raw?: unknown;
  metadata?: {
    enrichedCount?: number;
  };
  message?: string;
};

type SentData<TDocument> = {
  success: boolean;
  documents?: TDocument[];
  raw?: unknown;
  message?: string;
};

const responseCache = new Map<string, CacheEntry<unknown>>();
const pendingRequests = new Map<string, Promise<unknown>>();

function isFresh(entry: CacheEntry<unknown> | undefined) {
  return Boolean(entry && Date.now() - entry.timestamp <= CACHE_TTL_MS);
}

function cacheKey(path: string) {
  return path;
}

async function fetchJsonWithTimeout<T>(path: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const key = cacheKey(path);
  const cached = responseCache.get(key);

  if (isFresh(cached)) {
    return {
      data: cached?.data as T,
      fromCache: true,
      refresh: refreshJson<T>(path, timeoutMs).catch(() => null),
    };
  }

  return {
    data: await refreshJson<T>(path, timeoutMs),
    fromCache: false,
    refresh: null,
  };
}

async function refreshJson<T>(path: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const key = cacheKey(path);
  const pending = pendingRequests.get(key);

  if (pending) return pending as Promise<T>;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  const request = fetch(path, {
    cache: "no-store",
    signal: controller.signal,
  })
    .then(async (response) => {
      const data = (await response.json()) as T;
      responseCache.set(key, {
        data,
        timestamp: Date.now(),
      });
      return data;
    })
    .finally(() => {
      window.clearTimeout(timeoutId);
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, request);
  return request;
}

export function getCachedBizboxData<T>(path: string) {
  const cached = responseCache.get(cacheKey(path));
  return isFresh(cached) ? (cached?.data as T) : null;
}

export async function getInboxData<TDocument>({
  taxNumber,
  includeMetadata = false,
  limit,
  timeoutMs,
}: {
  taxNumber: string;
  includeMetadata?: boolean;
  limit?: number;
  timeoutMs?: number;
}) {
  const params = new URLSearchParams({
    taxNumber,
  });

  if (includeMetadata) params.set("includeMetadata", "true");
  if (limit) params.set("limit", String(limit));

  return fetchJsonWithTimeout<InboxData<TDocument>>(
    `/api/bizbox/inbox?${params.toString()}`,
    timeoutMs
  );
}

export async function getSentData<TDocument>({
  taxNumber,
  limit,
  timeoutMs,
}: {
  taxNumber: string;
  limit?: number;
  timeoutMs?: number;
}) {
  const params = new URLSearchParams({
    taxNumber,
  });

  if (limit) params.set("limit", String(limit));

  return fetchJsonWithTimeout<SentData<TDocument>>(
    `/api/bizbox/sent?${params.toString()}`,
    timeoutMs
  );
}

export function getCachedInboxData<TDocument>(options: {
  taxNumber: string;
  includeMetadata?: boolean;
  limit?: number;
}) {
  const params = new URLSearchParams({
    taxNumber: options.taxNumber,
  });

  if (options.includeMetadata) params.set("includeMetadata", "true");
  if (options.limit) params.set("limit", String(options.limit));

  return getCachedBizboxData<InboxData<TDocument>>(
    `/api/bizbox/inbox?${params.toString()}`
  );
}

export function getCachedSentData<TDocument>(options: {
  taxNumber: string;
  limit?: number;
}) {
  const params = new URLSearchParams({
    taxNumber: options.taxNumber,
  });

  if (options.limit) params.set("limit", String(options.limit));

  return getCachedBizboxData<SentData<TDocument>>(
    `/api/bizbox/sent?${params.toString()}`
  );
}
