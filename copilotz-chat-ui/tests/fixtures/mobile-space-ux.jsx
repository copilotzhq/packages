import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { SidebarProvider, useSidebar } from "../../src/components/ui/sidebar";
import { Sidebar } from "../../src/components/chat/Sidebar";
import { SpaceView } from "../../src/components/chat/SpaceView";

const spaces = [
  { id: "source", name: "Original Space", status: "active" },
  ...Array.from({ length: 30 }, (_, index) => ({ id: `space-${index + 1}`, name: `Destination ${index + 1}`, status: "active" })),
  { id: "archived", name: "Archived Space", status: "archived" },
];
const initialThreads = () => Array.from({ length: 45 }, (_, index) => ({
  id: `thread-${index}`, title: `Conversation ${index}`, spaceId: "source",
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [],
}));
const sections = ["Overview", "Chats", "Members", "Kanbans", "Documents", "Schedules", "Files"].map((label) => ({
  id: label.toLowerCase(), label, content: <p>{label} fixture</p>,
}));
function SidebarFixture() {
  const { setOpenMobile, openMobile } = useSidebar();
  useEffect(() => { setOpenMobile(true); }, [setOpenMobile]);
  const [threads, setThreads] = useState(initialThreads);
  const [selected, setSelected] = useState("thread-0");
  const [availableSpaces, setAvailableSpaces] = useState(spaces);
  const [dragEnabled, setDragEnabled] = useState(true);
  const [spaceOpened, setSpaceOpened] = useState(null);
  window.fixture = {
    threads, selected, spaceOpened, openMobile,
    reset: () => { window.moves = []; setThreads(initialThreads()); },
    removeSource: () => setThreads((values) => values.filter((thread) => thread.id !== "thread-0")),
    changeSource: () => setThreads((values) => values.map((thread) => thread.id === "thread-0" ? { ...thread, spaceId: "space-3" } : thread)),
    removeTarget: () => setAvailableSpaces((values) => values.filter((space) => space.id !== "space-2")),
    archiveTarget: () => setAvailableSpaces((values) => values.map((space) => space.id === "space-2" ? { ...space, status: "archived" } : space)),
    resetSpaces: () => setAvailableSpaces(spaces),
    disableDrag: () => setDragEnabled(false), enableDrag: () => setDragEnabled(true),
    close: () => setOpenMobile(false), open: () => setOpenMobile(true),
  };
  const move = async (threadId, spaceId) => {
    window.moves.push({ threadId, spaceId });
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (window.moveFailure === "false") return false;
    if (window.moveFailure === "throw") throw new Error("Fixture move rejected");
    setThreads((values) => values.map((thread) => thread.id === threadId ? { ...thread, spaceId } : thread));
    return true;
  };
  return <>
    <button onClick={() => setOpenMobile(true)}>Open sidebar fixture</button>
    <Sidebar threads={threads} spaces={availableSpaces} currentThreadId={selected}
      config={{ features: { spaces: { enabled: true, allowDrag: dragEnabled } } }}
      onSelectThread={setSelected} onOpenSpace={setSpaceOpened} onMoveThreadToSpace={move} />
  </>;
}
function NavigationFixture() {
  const [values, setValues] = useState(sections);
  window.fixture = { compact: () => setValues(sections.slice(0, 2)), expand: () => setValues(sections) };
  return <SpaceView space={spaces[0]} sections={values} defaultSelectedSection="kanbans" className="h-full w-full" />;
}
window.moves = [];
window.moveFailure = null;
window.lastTouchPointer = null;
document.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch" && event.isPrimary) window.lastTouchPointer = event.pointerId;
}, true);
const nav = new URLSearchParams(location.search).get("mode") === "nav";
createRoot(document.getElementById("root")).render(nav ? <NavigationFixture /> : <SidebarProvider><SidebarFixture /></SidebarProvider>);
