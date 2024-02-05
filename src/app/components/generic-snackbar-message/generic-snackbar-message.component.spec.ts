import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenericSnackbarMessageComponent } from './generic-snackbar-message.component';

describe('GenericSnackbarMessageComponent', () => {
  let component: GenericSnackbarMessageComponent;
  let fixture: ComponentFixture<GenericSnackbarMessageComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GenericSnackbarMessageComponent]
    });
    fixture = TestBed.createComponent(GenericSnackbarMessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
