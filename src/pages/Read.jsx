import PanelContent from "../components/PanelContent";
import { motion } from "framer-motion";
import IssueCarousel from "../components/IssueCarousel";

export default function Read() {
  return (
    <PanelContent>
      <div className="flex flex-col items-center justify-center w-full h-full space-y-8">
        <motion.h1
          layoutId="READ"
          className="text-4xl font-bold uppercase"
        >
          READ
        </motion.h1>
        <IssueCarousel />
      </div>
    </PanelContent>
  );
}

