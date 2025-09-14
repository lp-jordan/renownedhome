import { motion } from "framer-motion";

export default function Panel({ id, children, centerChildren = true }) {
  return (
    <div className="w-full h-full relative rounded-lg overflow-hidden">
      <motion.div
        layoutId={`panel-${id}`}
        className="absolute inset-0 border border-black rounded-lg pointer-events-none"
      />
      <div className="h-full overflow-y-auto flex flex-col px-6 pt-10 pb-6">
        <div
          className={["flex-1", centerChildren ? "flex items-center justify-center" : ""].join(" ")}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
