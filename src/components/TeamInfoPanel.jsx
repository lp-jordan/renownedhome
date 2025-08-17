import { motion } from "framer-motion";
import team from "../data/team";
import ImageWithFallback from "./ImageWithFallback";

export default function TeamInfoPanel({ memberId }) {
  const member = team.find((m) => m.id === memberId);

  if (!member) {
    return null;
  }

  return (
    <motion.div
      key={member.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex flex-col items-center gap-4 p-4 mt-4 border rounded bg-[var(--background)]"
      style={{ borderColor: "var(--border)" }}
    >
      <ImageWithFallback
        src={member.image}
        alt={member.name}
        className="w-full max-w-sm rounded"
      />
      <div className="text-center">
        <h2 className="text-2xl font-bold">{member.name}</h2>
        <h3 className="text-lg text-gray-500">{member.role}</h3>
      </div>
      {member.bio && <p className="max-w-xl text-center">{member.bio}</p>}
    </motion.div>
  );
}
