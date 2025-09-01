import { motion } from "framer-motion";
import Panel from "../components/Panel";

export default function Connect() {
  return (
    <Panel id="CONNECT">
      <motion.h1
        layoutId="CONNECT"
        className="text-black font-bold uppercase text-[clamp(3rem,8vw,10rem)]"
      >
        CONNECT
      </motion.h1>
    </Panel>
  );
}
