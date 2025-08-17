import team from "../data/team";
import ImageWithFallback from "./ImageWithFallback";
import { motion } from "framer-motion";

export default function TeamCarousel({ selectedId, onSelect }) {
  const hideLabels = selectedId !== null;
  return (
    <div className="w-full overflow-x-auto touch-pan-x">
      <div className="flex space-x-6 p-4 justify-center">
        {team.map((member) => (
          <div
            key={member.id}
            className="flex flex-col items-center flex-shrink-0"
          >
            <div
              onClick={() => onSelect?.(member.id)}
              className={`w-32 h-32 rounded-full border overflow-hidden cursor-pointer transition-transform ${
                selectedId === member.id
                  ? "ring-2 ring-[var(--accent)] scale-105"
                  : "hover:scale-105"
              }`}
              style={{ borderColor: "var(--border)" }}
            >
              <ImageWithFallback
                src={member.image}
                alt={member.role}
                className="w-full h-full object-cover"
              />
            </div>
            <motion.p
              className="mt-2 text-center text-sm"
              initial={false}
              animate={{ opacity: hideLabels ? 0 : 1 }}
              transition={{ duration: 0.3 }}
            >
              {member.role}
            </motion.p>
          </div>
        ))}
      </div>
    </div>
  );
}
