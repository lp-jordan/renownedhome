import { motion } from "framer-motion";
import Panel from "../components/Panel";

export default function Meet() {
  return (
    <Panel id="MEET">
      <motion.h1
        layoutId="MEET"
        className="text-black font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
      >
        MEET
      </motion.h1>
    </Panel>
  );
}
