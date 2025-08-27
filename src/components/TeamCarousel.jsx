import useSupabaseMedia from "../hooks/useSupabaseMedia";
import ImageWithFallback from "./ImageWithFallback";
import { motion } from "framer-motion";

export default function TeamCarousel({ selectedId, onSelect }) {
  const { media, loading, error } = useSupabaseMedia();
  const hideLabels = selectedId !== null;

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error loading media.</div>;
  }

  const team = media.map((m) => ({
    id: m.id,
    role: m.title?.rendered || "Member",
    image: m.media_details?.sizes?.medium?.source_url || m.source_url,
    bio: m.caption?.rendered || "",
  }));

  const selectedIndex = team.findIndex((m) => m.id === selectedId);

  // When a member is selected, enlarge it and push the others to the sides
  if (selectedId !== null && selectedIndex !== -1) {
    return (
      <div className="relative w-full h-60">
        {team.map((member, index) => {
          const isSelected = index === selectedIndex;
          const positionClass = isSelected
            ? "left-1/2 -translate-x-1/2 z-10"
            : index < selectedIndex
            ? "left-1/4 -translate-x-1/2"
            : "left-3/4 -translate-x-1/2";
          const sizeClass = isSelected ? "w-48 h-48" : "w-24 h-24";
          return (
            <div
              key={member.id}
              className={`absolute top-1/2 -translate-y-1/2 ${positionClass} flex flex-col items-center transition-all duration-300`}
            >
              <div
                onClick={() => onSelect?.(member.id)}
                className={`${sizeClass} rounded-full border overflow-hidden cursor-pointer ${
                  isSelected ? "ring-2 ring-[var(--accent)]" : ""
                }`}
                style={{ borderColor: "var(--border)" }}
              >
                <ImageWithFallback
                  src={member.image}
                  alt={member.role}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

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
