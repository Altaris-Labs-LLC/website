"use client";

import { useState } from "react";

type Props = {
  src: string;
  label: string;
  hint: string;
  className?: string;
};

export default function AscentArt({ src, label, hint, className }: Props) {
  const [missing, setMissing] = useState(false);

  return (
    <div className={`ascent-art ${className ?? ""}`}>
      {missing ? (
        <div className="ascent-art-fallback" role="img" aria-label={label}>
          <p className="ascent-art-name">{label}</p>
          <p className="ascent-art-hint">{hint}</p>
        </div>
      ) : (
        <img src={src} alt={label} onError={() => setMissing(true)} />
      )}
    </div>
  );
}
