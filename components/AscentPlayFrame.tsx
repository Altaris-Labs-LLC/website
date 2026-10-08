"use client";

import { useEffect, useRef } from "react";

import {
  ASCENT_AUTH_CHANGED,
  notifyAscentAuthChanged,
} from "@/lib/ascent-auth-client";

export default function AscentPlayFrame() {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data !== "ascent-auth-changed") return;
      notifyAscentAuthChanged();
    }
    function onAuth() {
      frame.current?.contentWindow?.postMessage(
        "ascent-auth-changed",
        window.location.origin,
      );
    }
    window.addEventListener("message", onMessage);
    window.addEventListener(ASCENT_AUTH_CHANGED, onAuth);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener(ASCENT_AUTH_CHANGED, onAuth);
    };
  }, []);

  return (
    <iframe
      ref={frame}
      className="ascent-play-frame"
      src="/play/chess/index.html?v=20260929c"
      title="Chess Ascent"
    />
  );
}
