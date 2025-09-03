import { useParams } from "react-router-dom";
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
      <div className="flex flex-col items-center">
        {issue.thumbnail && (
          <ImageWithFallback
            src={issue.thumbnail}
            alt={issue.title}
            className="w-full h-auto"
          />
        )}
        <IssueInfoPanel issue={issue} />
      </div>
    </Panel>
  );
}

