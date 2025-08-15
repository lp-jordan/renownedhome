import PanelContent from "../components/PanelContent";
import { motion } from "framer-motion";

export default function Buy() {
  return (
    <PanelContent>
      <motion.h1
        layoutId="BUY"
        className="text-4xl font-bold uppercase"
      >
        BUY
      </motion.h1>
    </PanelContent>
  );
}
