import { motion } from "framer-motion";
import Panel from "../components/Panel";

export default function Buy() {
  return (
    <Panel id="BUY">
      <motion.h1
        layoutId="BUY"
        className="text-black font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
      >
        BUY
      </motion.h1>
    </Panel>
  );
}
