import { runCli, setLogLevel } from "repomix";
import type { CliOptions } from "repomix";
import type { FileItem } from "../types";

export interface RunRepomixOptions {
  selectedFiles: string[];
  cwd: string;
}

/**
 * Get all selected file paths from the file tree
 */
export function getSelectedFilePaths(items: FileItem[]): string[] {
  const selectedPaths: string[] = [];

  function traverse(items: FileItem[]) {
    for (const item of items) {
      if (item.isSelected) {
        selectedPaths.push(item.path);
      }
      if (item.children) {
        traverse(item.children);
      }
    }
  }

  traverse(items);
  return selectedPaths;
}

/**
 * Run repomix with the selected files
 */
export async function runRepomixWithSelection({
  selectedFiles,
  cwd,
}: RunRepomixOptions): Promise<void> {
  if (selectedFiles.length === 0) {
    throw new Error("No files selected");
  }

  const options: CliOptions = {
    include: selectedFiles.join(","),
    copy: true,
    quiet: true,
  };

  // Change to the target directory and set quiet mode
  const originalCwd = process.cwd();
  try {
    setLogLevel(-1); // Silent mode
    process.chdir(cwd);
    await runCli([cwd], cwd, options);
  } finally {
    // Restore original directory
    process.chdir(originalCwd);
  }
}
