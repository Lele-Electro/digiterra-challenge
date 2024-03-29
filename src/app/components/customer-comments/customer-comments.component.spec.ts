import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomerCommentsComponent } from './customer-comments.component';

describe('CustomerCommentsComponent', () => {
  let component: CustomerCommentsComponent;
  let fixture: ComponentFixture<CustomerCommentsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CustomerCommentsComponent]
    });
    fixture = TestBed.createComponent(CustomerCommentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
