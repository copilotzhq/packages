import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "../../src/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../../src/components/ui/dialog";

function Fixture() {
  const [open, setOpen] = useState(false);
  const [nested, setNested] = useState(false);
  const [outsideCount, setOutsideCount] = useState(0);
  const [insideCount, setInsideCount] = useState(0);
  const side = new URLSearchParams(location.search).get("side") || "left";
  useEffect(() => {
    window.sheetFixture = { close: () => setOpen(false), open: () => setOpen(true), outsideCount, insideCount };
  }, [outsideCount, insideCount]);
  return <>
    <button id="outside" onClick={() => setOutsideCount(n => n + 1)} style={{ position: "fixed", inset: 0 }}>Underlying action</button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger id="trigger" style={{ position: "relative" }}>Open Sheet</SheetTrigger>
      <SheetContent side={side}>
        <SheetTitle>Layer regression</SheetTitle>
        <button id="inside" onClick={() => setInsideCount(n => n + 1)}>Inside action</button>
        <Dialog open={nested} onOpenChange={setNested}>
          <DialogTrigger>Open nested dialog</DialogTrigger>
          <DialogContent><DialogTitle>Nested regression</DialogTitle><button id="nested-action">Nested action</button></DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  </>;
}
createRoot(document.getElementById("root")).render(<Fixture />);
