import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ImageWithFallback from "./ImageWithFallback";

export default function BioCarousel({ bios = [] }) {
  if (!bios.length) {
    return <div>No bios available.</div>;
  }

  return (
    <div className="w-full overflow-x-auto touch-pan-x">
      <div className="flex space-x-4 p-4">
        {bios.map((bio) => (
          <Link key={bio.id} to={`/meet/${bio.id}`} className="block">
            <div
              className={[
                "flex-shrink-0 rounded border bg-[var(--background)] overflow-hidden",
                "w-[150px] sm:w-[200px] cursor-pointer",
              ].join(" ")}
              style={{ borderColor: "var(--border)" }}
            >
              <motion.div layoutId={`bio-image-${bio.id}`} className="w-full aspect-square">
                <ImageWithFallback
                  src={bio.image}
                  alt={bio.name}
                  className="w-full h-full object-cover"
                />
              </motion.div>
              <div className="p-2 text-center">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {bio.name}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

