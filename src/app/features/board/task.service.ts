import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, API_ENDPOINTS } from '../../core/api/api.config';
import { TaskCreateDto, TaskDto } from '../../core/api/api.models';
import { Task } from './board-data';

// The only place that knows how tasks are fetched and persisted. Every method is a thin,
// cold Observable over one REST call — no state is kept here. TaskEffects subscribes, the NgRx
// store holds the result, and components read the store, so a request is made exactly once per
// user action and the UI can't drift from what the server last confirmed.
@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/${API_ENDPOINTS.tasks}`;

  list(boardId?: string): Observable<TaskDto[]> {
    return this.http.get<TaskDto[]>(this.url, boardId ? { params: { boardId } } : {});
  }

  get(taskId: string): Observable<TaskDto> {
    return this.http.get<TaskDto>(this.taskUrl(taskId));
  }

  create(boardId: string, task: Omit<Task, 'id'>): Observable<TaskDto> {
    const body: TaskCreateDto = { ...task, boardId };
    return this.http.post<TaskDto>(this.url, body);
  }

  // PUT: replaces the whole task with the edited version (the edit form always submits every
  // field), so what the server stores is exactly what the form showed.
  update(boardId: string, taskId: string, task: Omit<Task, 'id'>): Observable<TaskDto> {
    const body: TaskDto = { ...task, id: taskId, boardId };
    return this.http.put<TaskDto>(this.taskUrl(taskId), body);
  }

  delete(taskId: string): Observable<void> {
    return this.http.delete<void>(this.taskUrl(taskId));
  }

  private taskUrl(taskId: string): string {
    return `${this.url}/${encodeURIComponent(taskId)}`;
  }
}
