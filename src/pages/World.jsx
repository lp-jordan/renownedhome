import PanelContent from "../components/PanelContent";
import { motion } from "framer-motion";

export default function World() {
  return (
    <PanelContent>
      <motion.h1
        layoutId="EXPLORE"
        className="relative z-50 text-4xl font-bold uppercase"
      >
        EXPLORE
      </motion.h1>
    </PanelContent>
  );
}
