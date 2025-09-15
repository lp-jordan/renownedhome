import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import Panel from "../components/Panel";
import ImageWithFallback from "../components/ImageWithFallback";
import IssueInfoPanel from "../components/IssueInfoPanel";
import content from "../../content/read.json";

export default function IssueDetail() {
  const { issueId } = useParams();
  const issue = content.issues?.find((i) => String(i.order) === issueId);

  if (!issue) {
    return (
      <Panel id={`issue-${issueId}`}>
        <div className="text-center">Issue not found.</div>
      </Panel>
    );
  }

  return (
    <Panel id={`issue-${issueId}`} centerChildren={false}>
      <div className="flex flex-col">
        {issue.heroImage && (
          <motion.div
            layoutId={`issue-image-${issue.order}`}
            className="w-full h-[50vh] overflow-hidden"
          >
            <ImageWithFallback
              src={issue.heroImage}
              alt={issue.title}
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
        <IssueInfoPanel issue={issue} />
      </div>
    </Panel>
  );
}

