import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.2, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: -10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

export default function BioInfoPanel({ bio }) {
  if (!bio) {
    return null;
  }

  const works = Array.isArray(bio.works)
    ? bio.works
    : bio.works
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean);

  return (
    <motion.div
      key={bio.id}
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-4 mt-6 w-full"
    >
      <motion.h1 variants={itemVariants} className="text-3xl font-bold text-center">
        {bio.name}
      </motion.h1>
      {bio.biography && (
        <motion.p variants={itemVariants} className="text-left text-black">
          {bio.biography}
        </motion.p>
      )}
      {works.length > 0 && (
        <motion.ul
          variants={itemVariants}
          className="text-left text-gray-500 list-disc pl-5"
        >
          {works.map((work, idx) => (
            <li key={idx}>{work}</li>
          ))}
        </motion.ul>
      )}
    </motion.div>
  );
}

