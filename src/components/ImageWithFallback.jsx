import { useState } from "react";

const FALLBACK_SRC = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4c+YMAATMAmU5mmUsAAAAAElFTkSuQmCC";

export default function ImageWithFallback({ src, alt, className = "", ...props }) {
  const [imgSrc, setImgSrc] = useState(src);

  const handleError = () => {
    setImgSrc(FALLBACK_SRC);
  };

  return (
    <img
      src={imgSrc}
      onError={handleError}
      alt={alt}
      className={className}
      {...props}
    />
  );
}

