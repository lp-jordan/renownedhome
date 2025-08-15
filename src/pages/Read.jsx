import PanelContent from "../components/PanelContent";
import { motion } from "framer-motion";

export default function Read() {
  return (
    <PanelContent>
      <motion.h1
        layoutId="READ"
        className="text-4xl font-bold uppercase"
      >
        READ
      </motion.h1>
    </PanelContent>
  );
}
