import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import Panel from "../components/Panel";
import ImageWithFallback from "../components/ImageWithFallback";
import BioInfoPanel from "../components/BioInfoPanel";
import content from "../../content/meet.json";

export default function BioDetail() {
  const { bioId } = useParams();
  const bio = content.bios?.[Number(bioId)];

  if (!bio) {
    return (
      <Panel id={`bio-${bioId}`}>
        <div className="text-center">Bio not found.</div>
      </Panel>
    );
  }

  return (
    <Panel id={`bio-${bioId}`} centerChildren={false}>
      <div className="flex flex-col">
        {bio.image && (
          <motion.div
            layoutId={`bio-image-${bioId}`}
            className="w-full h-[50vh] overflow-hidden"
          >
            <ImageWithFallback
              src={bio.image}
              alt={bio.name}
              className="w-full h-full object-cover"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to bottom, black 50%, transparent 100%)",
                maskImage:
                  "linear-gradient(to bottom, black 50%, transparent 100%)",
              }}
            />
          </motion.div>
        )}
        <BioInfoPanel bio={bio} />
      </div>
    </Panel>
  );
}

