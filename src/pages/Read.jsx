import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PanelContent from "../components/PanelContent";
import IssueCarousel from "../components/IssueCarousel";
import IssueInfoPanel from "../components/IssueInfoPanel";

const issues = [
  {
    id: 1,
    cover: "https://via.placeholder.com/400x600?text=Issue+1",
    title: "Issue 1",
    subtitle: "The Beginning",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt.",
    credits: "Written by The Team",
    link: "#",
  },
  {
    id: 2,
    cover: "https://via.placeholder.com/400x600?text=Issue+2",
    title: "Issue 2",
    subtitle: "The Sequel",
    description:
      "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo.",
    credits: "Written by The Team",
    link: "#",
  },
  {
    id: 3,
    cover: "https://via.placeholder.com/400x600?text=Issue+3",
    title: "Issue 3",
    subtitle: "The Finale",
    description:
      "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
    credits: "Written by The Team",
    link: "#",
  },
];

export default function Read() {
  const [selectedIssue, setSelectedIssue] = useState(null);

  const handleSelect = (issue) => {
    setSelectedIssue((prev) => (prev?.id === issue.id ? null : issue));
  };

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
        <div className="flex w-full gap-4 overflow-x-auto pb-4 justify-center">
          {issues.map((issue) => (
            <button
              key={issue.id}
              type="button"
              onClick={() => handleSelect(issue)}
              className="flex-shrink-0 focus:outline-none"
            >
              <img
                src={issue.cover}
                alt={issue.title}
                className={`h-40 w-28 object-cover border rounded ${
                  selectedIssue?.id === issue.id
                    ? "border-blue-500"
                    : "border-transparent"
                }`}
              />
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {selectedIssue && <IssueInfoPanel issue={selectedIssue} key={selectedIssue.id} />}
        </AnimatePresence>
      </div>
    </PanelContent>
  );
}

