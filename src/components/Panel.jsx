import { motion } from "framer-motion";

export default function Panel({ id, children, centerChildren = true }) {
  return (
    <motion.div
      layoutId={`panel-${id}`}
      className="w-full h-full border border-[var(--border)] rounded-lg overflow-hidden"
    >
      <div className="h-full overflow-y-auto flex flex-col px-6 pt-10 pb-6">
        <div
          className={["flex-1", centerChildren ? "flex items-center justify-center" : ""].join(" ")}
        >
          {children}
        </div>
      </div>
    </motion.div>
  );
}
