import { Box, Text, useInput, useStdout } from "ink";
import { useCallback, useState } from "react";
import type { FileItem } from "../types";
import { useFileExplorer } from "../hooks/useFileExplorer";
import {
  getSelectedFilePaths,
  runRepomixWithSelection,
} from "../utils/repomixRunner";
import { LoadingScreen } from "./LoadingScreen";

export function FileExplorer() {
  const {
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
  } = useFileExplorer();

  const { stdout } = useStdout();
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<string | null>(null);

  const navigateToParent = useCallback(() => {
    const flatItems = flattenItems(state.items);
    const currentItem = flatItems[state.currentIndex];

    if (currentItem && currentItem.depth > 0) {
      // Find the parent folder in the flat list
      for (let i = state.currentIndex - 1; i >= 0; i--) {
        const item = flatItems[i];
        if (!item) {
          continue;
        }

        if (item.depth < currentItem.depth) {
          navigateToIndex(i);
          return true;
        }
      }
    }
    return false;
  }, [state.currentIndex, state.items, navigateToIndex]);

  const executeRepomix = useCallback(async () => {
    try {
      setIsExecuting(true);
      setExecutionResult(null);

      const selectedFiles = getSelectedFilePaths(state.items);
      if (selectedFiles.length === 0) {
        setExecutionResult("❌ No files selected");
        return;
      }

      await runRepomixWithSelection({
        selectedFiles,
        cwd: currentDir,
      });

      setExecutionResult("✅ Complete");
    } catch (error) {
      setExecutionResult(
        `❌ ${error instanceof Error ? error.message : "Error"}`
      );
    } finally {
      setIsExecuting(false);
    }
  }, [state.items, currentDir]);

  useInput((input, key) => {
    // If showing execution result, any key dismisses it
    if (executionResult) {
      setExecutionResult(null);
      return;
    }

    if (state.items.length === 0 || isExecuting) return;

    const flatItems = flattenItems(state.items);
    const currentItem = flatItems[state.currentIndex];

    if (key.return) {
      // Execute repomix with selected files
      executeRepomix();
    } else if (key.upArrow) {
      moveUp();
    } else if (key.downArrow) {
      moveDown();
    } else if (key.rightArrow) {
      if (currentItem?.isDirectory && !currentItem.isExpanded) {
        // Expand folder if it's a collapsed directory
        handleExpandFolder(currentItem);
      } else {
        // Move down if it's a file or already expanded folder
        moveDown();
      }
    } else if (key.leftArrow) {
      // Smart left arrow behavior
      if (currentItem?.isDirectory && currentItem.isExpanded) {
        // If current item is an expanded folder, collapse it
        handleCollapseFolder(currentItem);
      } else if (currentItem && currentItem.depth > 0) {
        // If inside a folder (depth > 0), navigate to parent
        navigateToParent();
      }
    } else if (input === " " && currentItem) {
      handleToggleSelection(currentItem);
    } else if (input === "a") {
      handleToggleAll();
    }
  });

  const formatTokenCount = (count: number): string => {
    if (count === 0) return "";
    if (count < 1000) return `${count}`;
    if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
    return `${(count / 1000000).toFixed(1)}m`;
  };

  const renderItem = (item: FileItem, index: number, isActive: boolean) => {
    const indent = "  ".repeat(item.depth);

    // Different checkbox states for selection
    let checkbox = "[ ]";
    let checkboxColor = undefined;

    if (item.isSelected) {
      checkbox = "[✓]";
      checkboxColor = "green";
    } else if (item.isPartiallySelected) {
      checkbox = "[◐]"; // Half-filled circle for partial selection
      checkboxColor = "yellow";
    }

    const icon = item.isDirectory ? (item.isExpanded ? "▾" : "▸") : "·";
    const cursor = isActive ? "▍ " : "  ";

    // Show appropriate token count with better UX for partial selections
    let tokenDisplay = "";

    if (item.isDirectory && item.isPartiallySelected) {
      // For partially selected folders, show selected/total format
      const selectedTokens = formatTokenCount(item.selectedTokenCount);
      const totalTokens = formatTokenCount(item.tokenCount);
      tokenDisplay = `${selectedTokens}/${totalTokens}`;
    } else if (item.isDirectory && item.isSelected) {
      // For fully selected folders, show just the total
      tokenDisplay = formatTokenCount(item.selectedTokenCount);
    } else {
      // For unselected items or files, show total tokens
      tokenDisplay = formatTokenCount(item.tokenCount);
    }

    // Color based on selection state
    const tokenColor =
      item.isSelected || item.isPartiallySelected ? "cyan" : "gray";
    const nameColor = item.isSelected ? "white" : undefined;

    return (
      <Text
        key={`${item.path}-${index}-${item.isSelected}-${item.isPartiallySelected}`}
      >
        {cursor}
        <Text color={checkboxColor}>{checkbox}</Text> {indent}
        <Text color={nameColor}>
          {icon} {item.name}
        </Text>
        {tokenDisplay && <Text color={tokenColor}> ({tokenDisplay})</Text>}
      </Text>
    );
  };

  const flatItems = flattenItems(state.items);
  const visibleHeight = (stdout?.rows || 24) - 3;
  const startIndex = Math.max(
    0,
    Math.min(
      state.currentIndex - Math.floor(visibleHeight / 2),
      flatItems.length - visibleHeight
    )
  );
  const endIndex = Math.min(flatItems.length, startIndex + visibleHeight);
  const visibleItems = flatItems.slice(startIndex, endIndex);

  const getTotalAvailableTokens = () => {
    return flatItems.reduce((total, item) => {
      // Don't count expanded directories - their children are already counted separately
      if (item.isDirectory && item.isExpanded) {
        return total;
      }
      return total + item.tokenCount;
    }, 0);
  };

  const totalAvailable = getTotalAvailableTokens();
  const selectedTokens = state.totalSelectedTokens;

  const statusLine = `${state.selectedCount} selected • ${formatTokenCount(
    selectedTokens
  )}/${formatTokenCount(totalAvailable)} tokens • ${state.currentIndex + 1}/${
    flatItems.length
  } • ${currentDir}`;

  // Show loading screen while data is being fetched
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Show execution status if active
  if (isExecuting) {
    return (
      <Box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        height={stdout?.rows || 24}
      >
        <Text color="yellow">Processing...</Text>
      </Box>
    );
  }

  // Show execution result if available
  if (executionResult) {
    return (
      <Box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        height={stdout?.rows || 24}
      >
        <Text>{executionResult}</Text>
        <Text> </Text>
        <Text color="gray">Press any key to continue...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={stdout?.rows || 24}>
      <Text color="gray">
        ↑/↓ move • → expand • ← collapse/parent • Space select • a toggle all •
        Enter execute
      </Text>
      <Text> </Text>

      <Box flexDirection="column" flexGrow={1}>
        {visibleItems.map((item, index) => {
          const actualIndex = startIndex + index;
          return renderItem(
            item,
            actualIndex,
            actualIndex === state.currentIndex
          );
        })}
      </Box>

      <Text color="gray">{statusLine}</Text>
    </Box>
  );
}
