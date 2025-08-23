import { useEffect, useState } from "react";

export default function ImageWithFallback({ src, alt, className = "", ...props }) {
  const [hasError, setHasError] = useState(typeof src !== "string" || !src);

  useEffect(() => {
    const invalidSrc = typeof src !== "string" || !src;
    if (typeof src !== "string") {
      console.warn("ImageWithFallback: expected src to be a string, received", src);
    }
    setHasError(invalidSrc);
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
