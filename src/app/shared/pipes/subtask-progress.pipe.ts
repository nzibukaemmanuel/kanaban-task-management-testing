import { Pipe, PipeTransform } from '@angular/core';
import { Subtask } from '../../features/board/board-data';

// Summarises subtask completion as '2 of 3 subtasks'. Returns an empty string when there are no
// subtasks (or no list at all) so templates can skip rendering it.
@Pipe({ name: 'subtaskProgress' })
export class SubtaskProgressPipe implements PipeTransform {
  transform(subtasks: readonly Pick<Subtask, 'completed'>[] | null | undefined): string {
    if (!subtasks?.length) {
      return '';
    }
    const done = subtasks.filter((subtask) => subtask.completed).length;
    return `${done} of ${subtasks.length} ${subtasks.length === 1 ? 'subtask' : 'subtasks'}`;
  }
}
