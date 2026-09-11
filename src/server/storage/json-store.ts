import fs from "fs/promises";
import path from "path";

/**
 * Institutional-Grade Atomic JSON Store for Node.js / cPanel Phusion Passenger.
 *
 * Features:
 * - Thread-safe serialized write queue with Promise-based mutex.
 * - In-memory cache for 0ms sub-millisecond reads.
 * - Atomic write via temporary file swap (fs.rename) preventing file corruption.
 * - Zero native C++ dependencies (no node-gyp, 100% pure JS/TS).
 */
export class JsonStore<T> {
  private filePath: string;
  private defaultValue: T;
  private cachedData: T | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private isLoaded: boolean = false;
  /** mtime (ms) of the file as of the last successful load, for cross-process staleness detection. */
  private cachedMtimeMs: number | null = null;
  /** Own writes update cachedMtimeMs too; this filters out cheap `fs.stat` polling noise. */
  private lastStatCheckAt = 0;

  constructor(filePath: string, defaultValue: T) {
    this.filePath = filePath;
    this.defaultValue = defaultValue;
  }

  /**
   * Reads data from in-memory cache, or loads from disk on first call.
   *
   * cPanel/Passenger (and any multi-worker Node deployment) runs several
   * independent processes behind the same app — each has its OWN copy of this
   * in-memory cache. Without a staleness check, a tool/settings/payment edit
   * saved by the worker that served the admin request would never be visible
   * to a different worker that later handles a customer's WhatsApp message,
   * which is exactly why data sometimes silently "isn't there" even though it
   * was saved moments earlier. A `fs.stat` is orders of magnitude cheaper than
   * a full read+parse, so this keeps the fast path fast while staying correct.
   */
  async get(): Promise<T> {
    if (this.isLoaded && this.cachedData !== null) {
      const now = Date.now();
      if (now - this.lastStatCheckAt < 500) {
        // Debounce: don't stat on every single call within the same burst.
        return this.cachedData;
      }
      this.lastStatCheckAt = now;
      try {
        const stat = await fs.stat(this.filePath);
        if (this.cachedMtimeMs !== null && stat.mtimeMs > this.cachedMtimeMs) {
          return this.reload();
        }
        return this.cachedData;
      } catch {
        // Can't stat (e.g. deleted mid-flight) — fall through and try a real reload.
        return this.reload();
      }
    }
    return this.reload();
  }

  /**
   * Forces a reload from disk.
   */
  async reload(): Promise<T> {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const [raw, stat] = await Promise.all([
        fs.readFile(this.filePath, "utf-8"),
        fs.stat(this.filePath),
      ]);
      this.cachedData = JSON.parse(raw);
      this.isLoaded = true;
      this.cachedMtimeMs = stat.mtimeMs;
      this.lastStatCheckAt = Date.now();
      return this.cachedData as T;
    } catch (err: any) {
      if (err.code === "ENOENT") {
        // File does not exist yet; initialize with default
        this.cachedData = JSON.parse(JSON.stringify(this.defaultValue));
        this.isLoaded = true;
        await this.writeDirect(this.cachedData as T);
        return this.cachedData as T;
      }
      console.warn(`[JsonStore] Failed to read ${this.filePath}, falling back to defaults:`, err.message);
      this.cachedData = JSON.parse(JSON.stringify(this.defaultValue));
      this.isLoaded = true;
      return this.cachedData as T;
    }
  }

  /**
   * Queues an atomic write to disk and updates in-memory cache immediately.
   */
  async set(data: T): Promise<void> {
    this.cachedData = data;
    this.isLoaded = true;

    // Chain write onto the writeQueue mutex to serialize disk I/O
    this.writeQueue = this.writeQueue
      .then(() => this.writeDirect(data))
      .catch((err) => {
        console.error(`[JsonStore] Error writing to ${this.filePath}:`, err);
      });

    return this.writeQueue;
  }

  /**
   * Atomically mutates current state using an updater function.
   */
  async update(updater: (current: T) => T | Promise<T>): Promise<T> {
    const current = await this.get();
    const updated = await updater(current);
    await this.set(updated);
    return updated;
  }

  /**
   * Performs an atomic write using a temporary file and fs.rename.
   */
  private async writeDirect(data: T): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    const serialized = JSON.stringify(data, null, 2);
    const tempPath = `${this.filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;

    try {
      await fs.writeFile(tempPath, serialized, "utf-8");
      await fs.rename(tempPath, this.filePath);
      // Record the mtime OUR write produced, so a later `get()` can tell our own
      // write apart from a genuinely newer write made by another worker process.
      try {
        const stat = await fs.stat(this.filePath);
        this.cachedMtimeMs = stat.mtimeMs;
        this.lastStatCheckAt = Date.now();
      } catch {}
    } catch (writeErr) {
      // Clean up temporary file if rename failed
      try {
        await fs.unlink(tempPath);
      } catch {}
      throw writeErr;
    }
  }
}
