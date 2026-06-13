const CACHE_TTL_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 90_000;

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

  try {
    return {
      data: await refreshJson<T>(path, timeoutMs),
      fromCache: false,
      refresh: null,
    };
  } catch (error) {
    if (cached) {
      logBizboxCache("Using stale cached response after fetch failure", {
        path,
        error,
      });

      return {
        data: cached.data as T,
        fromCache: true,
        refresh: null,
      };
    }

    throw error;
  }
}

async function refreshJson<T>(path: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const key = cacheKey(path);
  const pending = pendingRequests.get(key);

  if (pending) return pending as Promise<T>;

  const slowTimerId = window.setTimeout(() => {
    logBizboxCache("bizBox request is still pending", {
      path,
      timeoutMs,
    });
  }, timeoutMs);

  const request = fetch(path, {
    cache: "no-store",
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
      window.clearTimeout(slowTimerId);
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, request);
  return request;
}

function logBizboxCache(message: string, meta: unknown) {
  if (process.env.NODE_ENV !== "development") return;
  console.warn(`[bizboxDataCache] ${message}`, meta);
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
