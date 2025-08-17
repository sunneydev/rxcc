#!/usr/bin/env node

import { useEffect } from "react";
import { FileExplorer } from "./components/FileExplorer";
import { render } from "ink";

export function App() {
  useEffect(() => {
    process.stdout.write("\x1B[2J\x1B[3J\x1B[H");
  }, []);

  return <FileExplorer />;
}

render(<App />);
