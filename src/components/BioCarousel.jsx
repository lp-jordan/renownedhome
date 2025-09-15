import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ImageWithFallback from "./ImageWithFallback";

export default function BioCarousel({ bios = [] }) {
  if (!bios.length) {
    return <div>No bios available.</div>;
  }

  return (
    <div className="w-full p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {bios.map((bio) => (
          <Link key={bio.id} to={`/meet/${bio.id}`} className="block">
            <div
              className="rounded border bg-[var(--background)] overflow-hidden cursor-pointer"
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

