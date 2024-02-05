import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatSnackBarModule, MatSnackBarRef } from '@angular/material/snack-bar';

@Component({
  selector: 'app-generic-snackbar-message',
  templateUrl: './generic-snackbar-message.component.html',
  styleUrls: ['./generic-snackbar-message.component.scss']
})
export class GenericSnackbarMessageComponent {
  snackBarRef = inject(MatSnackBarRef);
}
