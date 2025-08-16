import fs from "fs";
import path from "path";
import type { FileItem, TokenCounts } from "../types";
import { getFileTokenCount, calculateFolderTokenCount } from "./tokenCounting";
import { shouldIgnore } from "./ignorePatterns";

export function readDirectory(
  dirPath: string,
  depth: number = 0,
  parent?: FileItem,
  tokenCounts: TokenCounts = {}
): FileItem[] {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => {
        // Filter out ignored files and directories
        const itemPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(".", itemPath);
        return !shouldIgnore(relativePath);
      })
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((entry): FileItem => {
        const itemPath = path.join(dirPath, entry.name);
        const tokenCount = entry.isDirectory() 
          ? 0 // Will be calculated later for folders
          : getFileTokenCount(itemPath, tokenCounts);
        
        return {
          name: entry.name,
          path: itemPath,
          isDirectory: entry.isDirectory(),
          isExpanded: false,
          isSelected: false,
          children: entry.isDirectory() ? [] : undefined,
          parent,
          depth,
          tokenCount,
          selectedTokenCount: 0,
        };
      });
  } catch {
    return [];
  }
}

export function flattenItems(items: FileItem[]): FileItem[] {
  const result: FileItem[] = [];

  const traverse = (itemList: FileItem[]) => {
    for (const item of itemList) {
      result.push(item);
      if (item.isDirectory && item.isExpanded && item.children) {
        traverse(item.children);
      }
    }
  };

  traverse(items);
  return result;
}
