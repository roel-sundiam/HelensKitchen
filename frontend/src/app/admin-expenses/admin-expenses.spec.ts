import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminExpenses } from './admin-expenses';

describe('AdminExpenses', () => {
  let component: AdminExpenses;
  let fixture: ComponentFixture<AdminExpenses>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminExpenses]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminExpenses);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
