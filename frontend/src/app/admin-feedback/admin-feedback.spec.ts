import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminFeedback } from './admin-feedback';

describe('AdminFeedback', () => {
  let component: AdminFeedback;
  let fixture: ComponentFixture<AdminFeedback>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminFeedback]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminFeedback);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
