export const getNextSelectedIndices = (selectedIndices, index, allowToggle) => {
  if (index === null || index === undefined) {
    return [];
  }

  if (!allowToggle) {
    return [index];
  }

  if (selectedIndices.includes(index)) {
    return selectedIndices.filter(selectedIndex => selectedIndex !== index);
  }

  return [...selectedIndices, index];
};