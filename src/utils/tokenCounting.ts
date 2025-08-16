import { runDefaultAction, setLogLevel } from "repomix";
import type { FileItem, TokenCounts } from "../types";
import path from "path";

let tokenCountsCache: TokenCounts | null = null;

export async function getTokenCounts(cwd: string = "."): Promise<TokenCounts> {
  if (tokenCountsCache) {
    return tokenCountsCache;
  }

  try {
    // Set log level to silent to suppress all output
    setLogLevel(-1);
    
    // Use runDefaultAction with proper config
    const result = await runDefaultAction(["."], cwd, {
      tokenCountTree: true,
      quiet: true,
    });

    if (!result || !result.packResult || !result.packResult.fileTokenCounts) {
      throw new Error("No token counts from repomix");
    }

    tokenCountsCache = result.packResult.fileTokenCounts;
    return tokenCountsCache;
  } catch (error) {
    console.error("Failed to get token counts:", error);
    // Return empty token counts as fallback
    tokenCountsCache = {};
    return tokenCountsCache;
  }
}

export function getFileTokenCount(
  filePath: string,
  tokenCounts: TokenCounts
): number {
  const relativePath = path.relative(".", filePath);
  const normalizedPath = relativePath.replace(/\\/g, "/"); // Normalize path separators
  
  // Try different path variations
  const result = (
    tokenCounts[normalizedPath] || 
    tokenCounts[relativePath] || 
    tokenCounts[filePath] || 
    tokenCounts[`./${normalizedPath}`] ||
    0
  );
  
  
  return result;
}

export function calculateFolderTokenCount(
  item: FileItem,
  tokenCounts: TokenCounts
): number {
  if (!item.isDirectory) {
    return getFileTokenCount(item.path, tokenCounts);
  }

  let total = 0;
  if (item.children) {
    for (const child of item.children) {
      total += calculateFolderTokenCount(child, tokenCounts);
    }
  }
  return total;
}

export function calculateDirectoryTokensFromTokenCounts(
  dirPath: string,
  tokenCounts: TokenCounts
): number {
  const relativeDirPath = path.relative(".", dirPath);
  const normalizedDirPath = relativeDirPath.replace(/\\/g, "/");
  
  let total = 0;
  for (const [filePath, tokens] of Object.entries(tokenCounts)) {
    // Check if this file is inside the directory
    if (filePath.startsWith(normalizedDirPath + "/") || 
        filePath.startsWith(relativeDirPath + "/") ||
        filePath.startsWith(dirPath + "/")) {
      total += tokens;
    }
  }
  return total;
}

export function calculateSelectedTokenCount(item: FileItem, tokenCounts?: TokenCounts): number {
  if (!item.isSelected) {
    return 0;
  }

  if (!item.isDirectory) {
    return item.tokenCount;
  }

  // For directories, if we have children loaded, count only from them
  if (item.children && item.children.length > 0) {
    let total = 0;
    for (const child of item.children) {
      total += calculateSelectedTokenCount(child, tokenCounts);
    }
    return total;
  }
  
  // If directory is selected but children not loaded, 
  // calculate total from all files in that directory
  if (tokenCounts) {
    return calculateDirectoryTokensFromTokenCounts(item.path, tokenCounts);
  }
  
  return 0;
}

export function updateTokenCountsRecursively(
  items: FileItem[],
  tokenCounts: TokenCounts
): FileItem[] {
  return items.map((item) => {
    const updatedItem = { ...item };

    if (item.isDirectory) {
      // For directories, always calculate total tokens from repomix data
      // This ensures folders show correct token counts even when not expanded
      updatedItem.tokenCount = calculateDirectoryTokensFromTokenCounts(item.path, tokenCounts);
      
      // If children are loaded, update them recursively
      if (item.children) {
        updatedItem.children = updateTokenCountsRecursively(
          item.children,
          tokenCounts
        );
      }
    } else {
      // For files, get individual token count
      updatedItem.tokenCount = getFileTokenCount(item.path, tokenCounts);
    }

    updatedItem.selectedTokenCount = calculateSelectedTokenCount(updatedItem, tokenCounts);
    return updatedItem;
  });
}

export function propagateSelectionTokenCounts(items: FileItem[], tokenCounts: TokenCounts = {}): FileItem[] {
  const updateParentTokenCounts = (item: FileItem): number => {
    if (!item.isDirectory) {
      return item.isSelected ? item.tokenCount : 0;
    }

    let selectedTokens = 0;
    if (item.children && item.children.length > 0) {
      // If children are loaded, count from them
      for (const child of item.children) {
        selectedTokens += updateParentTokenCounts(child);
      }
    } else if (item.isSelected) {
      // If directory is selected but children not loaded, count all files in directory
      selectedTokens = calculateDirectoryTokensFromTokenCounts(item.path, tokenCounts);
    }

    item.selectedTokenCount = selectedTokens;
    return selectedTokens;
  };

  const updatedItems = [...items];
  for (const item of updatedItems) {
    updateParentTokenCounts(item);
  }

  return updatedItems;
}

export function getTotalSelectedTokens(items: FileItem[], tokenCounts: TokenCounts = {}): number {
  let total = 0;

  const traverse = (itemList: FileItem[]) => {
    for (const item of itemList) {
      if (item.isSelected && !item.isDirectory) {
        // Only count selected files directly
        total += item.tokenCount;
      } else if (item.isSelected && item.isDirectory && (!item.children || item.children.length === 0)) {
        // Only count selected directories that are NOT expanded (no children loaded)
        total += calculateDirectoryTokensFromTokenCounts(item.path, tokenCounts);
      }
      
      // Always traverse children if they exist (for both selected and unselected directories)
      if (item.children && item.children.length > 0) {
        traverse(item.children);
      }
    }
  };

  traverse(items);
  return total;
}
