import PanelContent from "../components/PanelContent";
import { motion } from "framer-motion";

export default function Team() {
  return (
    <PanelContent>
      <motion.h1
        layoutId="TEAM"
        className="text-4xl font-bold uppercase"
      >
        TEAM
      </motion.h1>
    </PanelContent>
  );
}
