import { motion } from "framer-motion";
import useWordPressMedia from "../hooks/useWordPressMedia";
import ImageWithFallback from "./ImageWithFallback";

export default function TeamInfoPanel({ memberId }) {
  const { media, loading, error } = useWordPressMedia();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error loading media.</div>;
  }

  const team = media.map((m) => ({
    id: m.id,
    role: m.title?.rendered || "Member",
    name: m.title?.rendered || "Member",
    image: m.media_details?.sizes?.medium?.source_url || m.source_url,
    bio: m.caption?.rendered || "",
  }));

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
