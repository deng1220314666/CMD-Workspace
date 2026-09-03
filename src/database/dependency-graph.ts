export interface TaskDependencyEdge {
  taskId: string
  prerequisiteTaskId: string
}

export function assertAcyclicDependencies(
  taskIds: readonly string[],
  edges: readonly TaskDependencyEdge[],
): void {
  const known = new Set(taskIds)
  const prerequisites = new Map<string, string[]>()
  for (const taskId of taskIds) prerequisites.set(taskId, [])
  for (const edge of edges) {
    if (edge.taskId === edge.prerequisiteTaskId)
      throw new Error('A task cannot depend on itself')
    if (!known.has(edge.taskId) || !known.has(edge.prerequisiteTaskId))
      throw new Error('Task dependency references a task outside the project')
    prerequisites.get(edge.taskId)?.push(edge.prerequisiteTaskId)
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (taskId: string) => {
    if (visiting.has(taskId))
      throw new Error('Task dependencies contain a cycle')
    if (visited.has(taskId)) return
    visiting.add(taskId)
    for (const prerequisite of prerequisites.get(taskId) ?? [])
      visit(prerequisite)
    visiting.delete(taskId)
    visited.add(taskId)
  }
  for (const taskId of taskIds) visit(taskId)
}
