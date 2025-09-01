import { motion } from "framer-motion";
import Breadcrumbs from "./Breadcrumbs";

export default function Panel({ id, children }) {
  return (
    <motion.div
      layoutId={`panel-${id}`}
      className="w-full h-full border border-black rounded-lg overflow-hidden"
    >
      <div className="h-full overflow-y-auto flex flex-col px-6 pt-6 pb-6">
        <Breadcrumbs className="sticky top-6" />
        <div className="flex-1 flex items-center justify-center">{children}</div>
      </div>
    </motion.div>
  );
}
