import type { FileItem, TokenCounts } from "../types";
import { readDirectory, flattenItems } from "./fileSystem";
import { propagateSelectionTokenCounts, getTotalSelectedTokens } from "./tokenCounting";

// Helper function to recursively select/deselect all children
function selectAllChildren(item: FileItem, isSelected: boolean): FileItem {
  const updatedItem = { ...item, isSelected };
  
  if (updatedItem.children) {
    updatedItem.children = updatedItem.children.map(child => 
      selectAllChildren(child, isSelected)
    );
  }
  
  return updatedItem;
}

// Helper function to update parent selection state based on children
function updateParentSelectionState(item: FileItem): FileItem {
  if (!item.children || item.children.length === 0) {
    return { ...item, isPartiallySelected: false };
  }
  
  // First, recursively update all children
  const updatedChildren = item.children.map(updateParentSelectionState);
  
  // Check if all children are selected
  const allChildrenSelected = updatedChildren.every(child => child.isSelected);
  // Check if any children are selected (including partially selected)
  const anyChildrenSelected = updatedChildren.some(child => 
    child.isSelected || child.isPartiallySelected
  );
  
  return {
    ...item,
    children: updatedChildren,
    isSelected: allChildrenSelected, // Parent is selected only if ALL children are selected
    isPartiallySelected: !allChildrenSelected && anyChildrenSelected, // Partially selected if some but not all children are selected
  };
}

export function expandFolder(item: FileItem, items: FileItem[], tokenCounts: TokenCounts = {}): FileItem[] {
  if (!item.isDirectory || item.isExpanded) return items;

  const children = readDirectory(item.path, item.depth + 1, item, tokenCounts);
  
  // If the parent folder is selected, inherit selection to all children
  const inheritedChildren = item.isSelected 
    ? children.map(child => selectAllChildren(child, true))
    : children;

  const updateItems = (itemList: FileItem[]): FileItem[] => {
    return itemList.map((currentItem) => {
      if (currentItem === item) {
        return {
          ...currentItem,
          isExpanded: true,
          children: inheritedChildren,
        };
      }
      if (currentItem.children) {
        return {
          ...currentItem,
          children: updateItems(currentItem.children),
        };
      }
      return currentItem;
    });
  };

  return updateItems(items);
}

export function collapseFolder(item: FileItem, items: FileItem[]): FileItem[] {
  if (!item.isDirectory || !item.isExpanded) return items;

  const updateItems = (itemList: FileItem[]): FileItem[] => {
    return itemList.map((currentItem) => {
      if (currentItem === item) {
        return {
          ...currentItem,
          isExpanded: false,
        };
      }
      if (currentItem.children) {
        return {
          ...currentItem,
          children: updateItems(currentItem.children),
        };
      }
      return currentItem;
    });
  };

  return updateItems(items);
}

export function toggleSelection(
  item: FileItem,
  items: FileItem[],
  tokenCounts: TokenCounts = {}
): [FileItem[], number, number] {
  
  const updateItems = (itemList: FileItem[]): FileItem[] => {
    return itemList.map((currentItem) => {
      if (currentItem === item) {
        // Toggle the current item and all its children
        const newSelectionState = !currentItem.isSelected;
        return selectAllChildren(currentItem, newSelectionState);
      }
      
      if (currentItem.children) {
        // Recursively process children
        const updatedItem = {
          ...currentItem,
          children: updateItems(currentItem.children),
        };
        
        // Update parent selection state based on children
        return updateParentSelectionState(updatedItem);
      }
      
      return currentItem;
    });
  };

  let updatedItems = updateItems(items);
  
  // Apply parent state updates at root level
  updatedItems = updatedItems.map(updateParentSelectionState);
  
  // Calculate token counts
  const updatedItemsWithTokens = propagateSelectionTokenCounts(updatedItems, tokenCounts);
  const totalSelectedTokens = getTotalSelectedTokens(updatedItemsWithTokens, tokenCounts);
  
  // Count selected items
  const flatItems = flattenItems(updatedItemsWithTokens);
  const selectedCount = flatItems.filter(item => item.isSelected).length;
  
  return [updatedItemsWithTokens, selectedCount, totalSelectedTokens];
}

export function toggleAll(items: FileItem[], tokenCounts: TokenCounts = {}): [FileItem[], number, number] {
  const flatItems = flattenItems(items);
  const allSelected = flatItems.every((item) => item.isSelected);
  let selectedCount = 0;

  const updateItems = (itemList: FileItem[]): FileItem[] => {
    return itemList.map((item) => {
      const newItem = { ...item, isSelected: !allSelected };
      if (newItem.isSelected) selectedCount++;

      if (item.children) {
        return {
          ...newItem,
          children: updateItems(item.children),
        };
      }
      return newItem;
    });
  };

  const updatedItems = updateItems(items);
  const updatedItemsWithTokens = propagateSelectionTokenCounts(updatedItems, tokenCounts);
  const totalSelectedTokens = getTotalSelectedTokens(updatedItemsWithTokens, tokenCounts);
  return [updatedItemsWithTokens, selectedCount, totalSelectedTokens];
}
