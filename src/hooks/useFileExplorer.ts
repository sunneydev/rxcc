import { useState, useEffect, useCallback } from "react";
import type { FileExplorerState, FileItem, TokenCounts } from "../types";
import { readDirectory, flattenItems } from "../utils/fileSystem";
import {
  expandFolder,
  collapseFolder,
  toggleSelection,
  toggleAll,
} from "../utils/itemOperations";
import { getTokenCounts, updateTokenCountsRecursively } from "../utils/tokenCounting";

export function useFileExplorer() {
  const [state, setState] = useState<FileExplorerState>({
    items: [],
    currentIndex: 0,
    selectedCount: 0,
    totalSelectedTokens: 0,
  });
  const [tokenCounts, setTokenCounts] = useState<TokenCounts>({});
  const [isLoading, setIsLoading] = useState(true);

  const currentDir = process.cwd();

  useEffect(() => {
    const initializeData = async () => {
      try {
        const tokenData = await getTokenCounts(currentDir);
        setTokenCounts(tokenData);
        
        const initialItems = readDirectory(currentDir, 0, undefined, tokenData);
        const itemsWithTokens = updateTokenCountsRecursively(initialItems, tokenData);
        
        setState({
          items: itemsWithTokens,
          currentIndex: 0,
          selectedCount: 0,
          totalSelectedTokens: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeData();
  }, [currentDir]);

  const handleExpandFolder = useCallback(
    (item: FileItem) => {
      const updatedItems = expandFolder(item, state.items, tokenCounts);
      const itemsWithTokens = updateTokenCountsRecursively(updatedItems, tokenCounts);
      setState((prev) => ({
        ...prev,
        items: itemsWithTokens,
      }));
    },
    [state.items, tokenCounts]
  );

  const handleCollapseFolder = useCallback(
    (item: FileItem) => {
      const updatedItems = collapseFolder(item, state.items);
      setState((prev) => ({
        ...prev,
        items: updatedItems,
      }));
    },
    [state.items]
  );

  const handleToggleSelection = useCallback(
    (item: FileItem) => {
      const [updatedItems, newSelectedCount, newTotalSelectedTokens] = toggleSelection(
        item,
        state.items,
        tokenCounts
      );
      setState((prev) => ({
        ...prev,
        items: updatedItems,
        selectedCount: newSelectedCount,
        totalSelectedTokens: newTotalSelectedTokens,
      }));
    },
    [state.items, tokenCounts]
  );

  const handleToggleAll = useCallback(() => {
    const [updatedItems, newSelectedCount, newTotalSelectedTokens] = toggleAll(state.items, tokenCounts);
    setState((prev) => ({
      ...prev,
      items: updatedItems,
      selectedCount: newSelectedCount,
      totalSelectedTokens: newTotalSelectedTokens,
    }));
  }, [state.items, tokenCounts]);

  const moveUp = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentIndex: Math.max(0, prev.currentIndex - 1),
    }));
  }, []);

  const moveDown = useCallback(() => {
    const flatItems = flattenItems(state.items);
    setState((prev) => ({
      ...prev,
      currentIndex: Math.min(flatItems.length - 1, prev.currentIndex + 1),
    }));
  }, [state.items]);

  const navigateToIndex = useCallback((index: number) => {
    const flatItems = flattenItems(state.items);
    const clampedIndex = Math.max(0, Math.min(flatItems.length - 1, index));
    setState((prev) => ({
      ...prev,
      currentIndex: clampedIndex,
    }));
  }, [state.items]);

  return {
    state,
    currentDir,
    flattenItems,
    handleExpandFolder,
    handleCollapseFolder,
    handleToggleSelection,
    handleToggleAll,
    moveUp,
    moveDown,
    navigateToIndex,
    isLoading,
  };
}
