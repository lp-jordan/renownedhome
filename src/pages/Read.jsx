import { motion } from "framer-motion";
import Panel from "../components/Panel";

export default function Read() {
  return (
    <Panel id="READ">
      <motion.h1
        layoutId="READ"
        className="text-black font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
      >
        READ
      </motion.h1>
    </Panel>
  );
}
