import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Panel from "../components/Panel";
import { fetchJson } from "../utils/fetchJson";

export default function Connect() {
  const [content, setContent] = useState(null);

  useEffect(() => {
    fetchJson("/content/connect.json").then(setContent);
  }, []);

  if (!content) {
    return null;
  }

  const {
    panel,
    hero: { heading },
  } = content;

  return (
    <Panel id={panel.main.id}>
      <motion.h1 layoutId={heading.layoutId} className={heading.className}>
        {heading.text}
      </motion.h1>
    </Panel>
  );
}
