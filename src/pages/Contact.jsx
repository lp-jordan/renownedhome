import PanelContent from "../components/PanelContent";
import { motion } from "framer-motion";

export default function Contact() {
  return (
    <PanelContent>
      <motion.h1
        layoutId="CONTACT"
        className="text-4xl font-bold uppercase"
      >
        CONTACT
      </motion.h1>
    </PanelContent>
  );
}
