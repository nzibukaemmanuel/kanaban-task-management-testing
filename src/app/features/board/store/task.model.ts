import { Task } from '../board-data';

// The store normalizes tasks into one flat EntityAdapter collection (keyed by task id, unique
// across every board) rather than mirroring TaskService's Record<boardId, Task[]> shape — so
// each task carries its own boardId instead of relying on which bucket it happens to sit in.
export interface TaskEntity extends Task {
  boardId: string;
}
