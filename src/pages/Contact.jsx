import PanelContent from "../components/PanelContent";
import { motion } from "framer-motion";

export default function Contact() {
  return (
    <PanelContent>
      <motion.h1
        layoutId="REACH"
        className="relative z-50 text-4xl font-bold uppercase"
      >
        REACH
      </motion.h1>
    </PanelContent>
  );
}
