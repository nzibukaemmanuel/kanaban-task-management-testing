import { Task } from '../../features/board/board-data';

// Wire formats shared by the data services and the mock backend, so both sides of the HTTP
// boundary agree on one shape.
export interface BoardDto {
  id: string;
}

export interface TaskDto extends Task {
  boardId: string;
}

export type TaskCreateDto = Omit<TaskDto, 'id'>;
export type TaskPatchDto = Partial<Omit<TaskDto, 'id'>>;
