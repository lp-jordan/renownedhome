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

export default function IssueInfoPanel({ issue }) {
  if (!issue) {
    return null;
  }

  const title = issue.title?.rendered || issue.title;

  return (
    <motion.div
      key={issue.id}
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-4 mt-6 w-full"
    >
      <motion.h1 variants={itemVariants} className="text-3xl font-bold text-center">
        {title}
      </motion.h1>
      {(issue.writer || issue.artist || issue.colorist) && (
        <motion.div
          variants={itemVariants}
          className="mt-2 text-sm text-gray-500 text-center"
        >
          {issue.writer && <p>Writer: {issue.writer}</p>}
          {issue.artist && <p>Artist: {issue.artist}</p>}
          {issue.colorist && <p>Colorist: {issue.colorist}</p>}
        </motion.div>
      )}
      {issue.subtitle && (
        <motion.h2 variants={itemVariants} className="text-gray-500 text-left">
          {issue.subtitle}
        </motion.h2>
      )}
      {issue.description && (
        <motion.p variants={itemVariants} className="text-left text-black">
          {issue.description}
        </motion.p>
      )}
    </motion.div>
  );
}
