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

const MAX_DURATION_S = 18;

const genName = (file) => {
  const ext = file.name.split(".").pop() || "mp4";
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
};

function checkVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video metadata."));
    };
    video.src = url;
  });
}

export default function VideoUploadInput({
  value,
  onChange,
  storagePath,
  placeholder = "Paste video URL or click ↑ to upload",
  disabled = false,
}) {
  const fileRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState("idle");
  const [errMsg, setErrMsg] = useState("");

  const handleFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      if (!file.type.startsWith("video/")) {
        setErrMsg("Please select a video file.");
        setStatus("error");
        return;
      }

      setStatus("uploading");
      setProgress(0);
      setErrMsg("");

      try {
        const duration = await checkVideoDuration(file);
        if (duration > MAX_DURATION_S) {
          setErrMsg(
            `Video is ${Math.ceil(duration)}s — max allowed is ${MAX_DURATION_S}s.`
          );
          setStatus("error");
          setProgress(null);
          return;
        }

        const storageRef = ref(storage, `${storagePath}/${genName(file)}`);
        const uploadTask = uploadBytesResumable(storageRef, file, {
          contentType: file.type,
        });

        await new Promise((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snap) =>
              setProgress(
                Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
              ),
            reject,
            resolve
          );
        });

        const url = await getDownloadURL(uploadTask.snapshot.ref);
        onChange(url);
        setStatus("done");
        setProgress(null);
        setTimeout(() => setStatus("idle"), 2000);
      } catch (err) {
        console.error("Video upload error:", err);
        setErrMsg(err.message || "Upload failed. Please try again.");
        setStatus("error");
        setProgress(null);
      }
    },
    [storagePath, onChange]
  );

  const handleClear = useCallback(() => {
    onChange("");
    setStatus("idle");
    setErrMsg("");
  }, [onChange]);

  const isUploading = status === "uploading";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setStatus("idle");
            setErrMsg("");
          }}
          placeholder={placeholder}
          disabled={disabled || isUploading}
          className="flex-1 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition-all disabled:opacity-60"
        />

        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFile}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || isUploading}
          title={`Upload video (max ${MAX_DURATION_S}s)`}
          className={[
            "flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border transition-all",
            status === "done"
              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-500"
              : status === "error"
              ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-400"
              : "bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20",
            disabled || isUploading
              ? "opacity-50 cursor-not-allowed"
              : "cursor-pointer",
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

        {value && !isUploading && (
          <button
            type="button"
            onClick={handleClear}
            title="Clear video"
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-500/30 transition-all"
          >
            <TrashBin className="w-4 h-4" />
          </button>
        )}
      </div>

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

      {isUploading && (
        <p className="text-[11px] text-violet-500 dark:text-violet-400">
          Uploading video…
        </p>
      )}
      {status === "done" && (
        <p className="text-[11px] text-emerald-500 dark:text-emerald-400">
          ✓ Video uploaded successfully
        </p>
      )}
      {status === "error" && errMsg && (
        <p className="text-[11px] text-red-500 dark:text-red-400">{errMsg}</p>
      )}
      {status === "idle" && !errMsg && (
        <p className="text-[11px] text-gray-400">
          Max {MAX_DURATION_S}s · Upload or paste a direct video URL
        </p>
      )}

      {value?.trim() && (
        <video
          key={value}
          src={value}
          controls
          muted
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 max-h-32 object-contain"
        />
      )}
    </div>
  );
}
