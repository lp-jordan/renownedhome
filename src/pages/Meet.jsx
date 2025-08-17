import PanelContent from "../components/PanelContent";
import { motion } from "framer-motion";

export default function Meet() {
  return (
    <PanelContent>
      <motion.h1
        layoutId="MEET"
        className="text-4xl font-bold uppercase"
      >
        MEET
      </motion.h1>
    </PanelContent>
  );
}
