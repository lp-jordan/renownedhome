import { motion } from "framer-motion";
import Breadcrumbs from "./Breadcrumbs";

export default function Panel({ id, children }) {
  return (
    <motion.div
      layoutId={`panel-${id}`}
      className="w-full h-full border border-black rounded-lg overflow-hidden"
    >
      <div className="h-full overflow-y-auto p-6 flex flex-col">
        <Breadcrumbs className="sticky top-6" />
        <div className="flex-1 flex items-center justify-center">{children}</div>
      </div>
    </motion.div>
  );
}
