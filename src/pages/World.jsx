import PanelContent from "../components/PanelContent";
import { motion } from "framer-motion";

export default function World() {
  return (
    <PanelContent>
      <motion.h1
        layoutId="WORLD"
        className="text-4xl font-bold uppercase"
      >
        WORLD
      </motion.h1>
    </PanelContent>
  );
}
