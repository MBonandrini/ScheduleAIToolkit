/**
 * Browser Web Worker client helpers for CPU-heavy schedule/risk operations.
 */
import {
  uid
} from "../core/utils.js";
import {
  parseScheduleFile
} from "../parsers/index.js";
function workerSupported() {
  return typeof Worker!=="undefined" && typeof URL!=="undefined"
}
async function callWorker(url, type, payload) {
  return await new Promise((resolve, reject) => {
    const w = new Worker(url, {
      type: "module"
    }), id = uid("worker"); const done = () => {
      try {
        w.terminate()
      } catch {
      }
    }; w.onmessage = e => {
      if (e.data?.id!==id)return; done(); e.data.ok? resolve(e.data.result): reject(new Error(e.data.error))
    }; w.onerror = e => {
      done(); reject(e.error || new Error(e.message || "Worker failed"))
    }; w.postMessage( {
      id, type, payload
    });
  });
}
export async function parseScheduleOffThread(file, { onProgress = null } = {}) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  onProgress?.({ detail: `Reading ${file.name}`, percent: 12 });
  if (workerSupported() && ext==="xer") {
    try {
      const text = await file.text();
      onProgress?.({ detail: `Parsing XER tables · ${file.name}`, percent: 38 });
      const result = await callWorker(new URL("./schedule-worker.js", import.meta.url), "parse-xer", { text, name: file.name });
      onProgress?.({ detail: `Normalising activities, WBS, logic and resources · ${file.name}`, percent: 86 });
      return result;
    } catch (error) {
      console.warn("Worker XER parse failed; falling back to main thread", error);
      onProgress?.({ detail: `Worker fallback · ${file.name}`, percent: 42 });
    }
  }
  onProgress?.({ detail: `${ext.toUpperCase()} parser · ${file.name}`, percent: 45 });
  const result = await parseScheduleFile(file);
  onProgress?.({ detail: `Normalising schedule · ${file.name}`, percent: 86 });
  return result;
}
export async function compareOffThread(previous, current) {
  if (workerSupported()) {
    try {
      return await callWorker(new URL("./schedule-worker.js", import.meta.url), "compare", {
        previous, current
      })
    } catch (error) {
      console.warn("Worker comparison failed; falling back to caller", error)
    }
  }
  return null;
}
