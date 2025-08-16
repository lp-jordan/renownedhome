import { useEffect, useState } from "react";

export default function ImageWithFallback({ src, alt, className = "", ...props }) {
  const [hasError, setHasError] = useState(!src);

  useEffect(() => {
    setHasError(!src);
  }, [src]);

  if (hasError) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`bg-gray-400 ${className}`}
        {...props}
      />
    );
  }

  return (
    <img
      src={src}
      onError={() => setHasError(true)}
      alt={alt}
      className={className}
      {...props}
    />
  );
}

