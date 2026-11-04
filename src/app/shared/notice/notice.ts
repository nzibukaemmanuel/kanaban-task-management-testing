import { Component, inject } from '@angular/core';
import { NotificationService } from '../../core/notification.service';

// Mounted once in the app shell; reads NotificationService so any component can post a notice
// without needing a reference to this one.
@Component({
  selector: 'app-notice',
  imports: [],
  templateUrl: './notice.html',
})
export class Notice {
  protected readonly notificationService = inject(NotificationService);

  protected dismiss(): void {
    this.notificationService.dismiss();
  }
}
