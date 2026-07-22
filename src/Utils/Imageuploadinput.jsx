import { useState, useRef, useCallback } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../Firebase";
import {
  ArrowUp,
  TrashBin,
  CircleCheck,
  TriangleThunderbolt,
  ArrowRotateRight,
} from "@gravity-ui/icons";

// ── Convert any image file → WebP Blob (canvas-based, no deps) ───────────────
function convertToWebP(file, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img    = new Image();
    const objUrl = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      URL.revokeObjectURL(objUrl);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("WebP conversion failed."));
        },
        "image/webp",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error("Could not load image."));
    };

    img.src = objUrl;
  });
}

// ── Generate unique storage filename ─────────────────────────────────────────
const genName = () =>
  `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;

// ── Main component ────────────────────────────────────────────────────────────
/**
 * ImageUploadInput
 *
 * Props:
 *   value        – current URL string
 *   onChange     – (url: string) => void
 *   storagePath  – Firebase Storage folder, e.g. "companies/logos"
 *   placeholder  – input placeholder text
 *   disabled     – optional bool
 */
export default function ImageUploadInput({
  value,
  onChange,
  storagePath,
  placeholder = "https://example.com/image.webp",
  disabled = false,
}) {
  const fileRef  = useRef(null);
  const dragDepth = useRef(0);
  const [progress, setProgress]   = useState(null);   // null | 0-100
  const [status,   setStatus]     = useState("idle"); // idle | uploading | done | error
  const [errMsg,   setErrMsg]     = useState("");
  const [imgOk,    setImgOk]      = useState(false);  // preview load state
  const [isDragging, setIsDragging] = useState(false);

  // ── Validate, convert and upload either a picked or dropped file ──────────
  const uploadFile = useCallback(
    async (file) => {
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setErrMsg("Please select an image file.");
        setStatus("error");
        return;
      }

      setStatus("uploading");
      setProgress(0);
      setErrMsg("");
      setImgOk(false);

      try {
        // 1 — Convert to WebP
        const webpBlob = await convertToWebP(file);

        // 2 — Upload with progress tracking
        const storageRef  = ref(storage, `${storagePath}/${genName()}`);
        const uploadTask  = uploadBytesResumable(storageRef, webpBlob, {
          contentType: "image/webp",
        });

        await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snap) => {
              const pct = Math.round(
                (snap.bytesTransferred / snap.totalBytes) * 100
              );
              setProgress(pct);
            },
            (err) => reject(err),
            () => resolve()
          );
        });

        // 3 — Get public URL
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        onChange(url);
        setStatus("done");
        setProgress(null);

        // Reset "done" icon after 2s
        setTimeout(() => setStatus("idle"), 2000);
      } catch (err) {
        console.error("Upload error:", err);
        setErrMsg(err.message || "Upload failed. Please try again.");
        setStatus("error");
        setProgress(null);
      }
    },
    [storagePath, onChange]
  );

  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    uploadFile(file);
  }, [uploadFile]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || status === "uploading") return;
    dragDepth.current += 1;
    setIsDragging(true);
  }, [disabled, status]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = disabled ? "none" : "copy";
  }, [disabled]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);
    if (disabled || status === "uploading") return;
    uploadFile(e.dataTransfer.files?.[0]);
  }, [disabled, status, uploadFile]);

  // ── Clear field ───────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    onChange("");
    setStatus("idle");
    setErrMsg("");
    setImgOk(false);
  }, [onChange]);

  const isUploading = status === "uploading";

  return (
    <div
      className="flex flex-col gap-2"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >

      {/* ── Input row ── */}
      <div className="flex items-center gap-2">

        {/* URL text input */}
        <input
          type="url"
          value={value}
          onChange={(e) => { onChange(e.target.value); setStatus("idle"); setImgOk(false); }}
          placeholder={placeholder}
          disabled={disabled || isUploading}
          className="flex-1 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all disabled:opacity-60"
        />

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />

        {/* Upload button */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || isUploading}
          title="Upload image (auto-converts to WebP)"
          className={[
            "flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border transition-all",
            status === "done"
              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-500"
              : status === "error"
              ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-400"
              : "bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20",
            (disabled || isUploading) ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          ].join(" ")}
        >
          {isUploading ? (
            <ArrowRotateRight className="w-4 h-4 animate-spin" />
          ) : status === "done" ? (
            <CircleCheck className="w-4 h-4" />
          ) : status === "error" ? (
            <TriangleThunderbolt className="w-4 h-4" />
          ) : (
            <ArrowUp className="w-4 h-4" />
          )}
        </button>

        {/* Clear button — only when value exists */}
        {value && !isUploading && (
          <button
            type="button"
            onClick={handleClear}
            title="Clear URL"
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-500/30 transition-all"
          >
            <TrashBin className="w-4 h-4" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={disabled || isUploading}
        className={`w-full rounded-xl border-2 border-dashed px-4 py-3 text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          isDragging
            ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 scale-[1.01]"
            : "border-gray-200 dark:border-gray-700 text-gray-400 hover:border-violet-300 hover:bg-violet-50/50 dark:hover:bg-violet-500/5"
        }`}
      >
        {isDragging ? "Drop image to upload" : "Drag & drop image here, or click to browse"}
      </button>

      {/* ── Progress bar ── */}
      {isUploading && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-200"
              style={{ width: `${progress ?? 0}%` }}
            />
          </div>
          <span className="text-[11px] text-gray-400 tabular-nums flex-shrink-0 w-9 text-right">
            {progress ?? 0}%
          </span>
        </div>
      )}

      {/* ── Upload status text ── */}
      {isUploading && (
        <p className="text-[11px] text-violet-500 dark:text-violet-400">
          Converting to WebP &amp; uploading…
        </p>
      )}
      {status === "done" && (
        <p className="text-[11px] text-emerald-500 dark:text-emerald-400">
          ✓ Uploaded successfully as WebP
        </p>
      )}
      {status === "error" && errMsg && (
        <p className="text-[11px] text-red-500 dark:text-red-400">{errMsg}</p>
      )}

      {/* ── Image preview ── */}
      {value?.trim() && (
        <div className="relative w-full h-28 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
          <img
            key={value}
            src={value}
            alt="preview"
            onLoad={()  => setImgOk(true)}
            onError={() => setImgOk(false)}
            className={`h-full w-full object-contain transition-opacity duration-200 ${imgOk ? "opacity-100" : "opacity-0"}`}
          />
          {/* Spinner while preview loads */}
          {!imgOk && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="w-5 h-5 border-2 border-violet-300 border-t-violet-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
