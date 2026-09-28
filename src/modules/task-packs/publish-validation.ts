export interface PublishableTaskDescription {
  position: number;
  description: string;
}

export interface TaskContentIssues {
  duplicateItemPositions: number[];
  placeholderItemPositions: number[];
}

function isObviousPlaceholder(description: string): boolean {
  const compact = description.trim();
  return /^[a-z]{6,}$/.test(compact) && !/[aeiouy]/.test(compact);
}

export function findTaskContentIssues(items: PublishableTaskDescription[]): TaskContentIssues {
  const seenDescriptions = new Map<string, number>();
  const duplicateItemPositions: number[] = [];
  const placeholderItemPositions: number[] = [];

  for (const item of items) {
    const normalized = item.description.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
    if (seenDescriptions.has(normalized)) duplicateItemPositions.push(item.position);
    else seenDescriptions.set(normalized, item.position);
    if (isObviousPlaceholder(item.description)) placeholderItemPositions.push(item.position);
  }

  return { duplicateItemPositions, placeholderItemPositions };
}
