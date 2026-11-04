import { Pipe, PipeTransform } from '@angular/core';
import { Task } from '../../features/board/board-data';

const STATUS_LABELS: Record<Task['status'], string> = {
  todo: 'To do',
  doing: 'In progress',
  done: 'Done',
};

// Turns a task's status key into its display label. Unknown or missing values render as an empty
// string rather than leaking the raw key or throwing.
@Pipe({ name: 'statusLabel' })
export class StatusLabelPipe implements PipeTransform {
  transform(status: string | null | undefined): string {
    return Object.hasOwn(STATUS_LABELS, status ?? '') ? STATUS_LABELS[status as Task['status']] : '';
  }
}
