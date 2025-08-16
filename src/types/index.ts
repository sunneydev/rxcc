export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  children?: FileItem[];
  parent?: FileItem;
  depth: number;
  tokenCount: number;
  selectedTokenCount: number;
  isPartiallySelected?: boolean; // For folders with some children selected
}

export interface FileExplorerState {
  items: FileItem[];
  currentIndex: number;
  selectedCount: number;
  totalSelectedTokens: number;
}

export interface TokenCounts {
  [path: string]: number;
}