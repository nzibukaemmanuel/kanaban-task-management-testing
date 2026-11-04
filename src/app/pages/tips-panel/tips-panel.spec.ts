import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TipsPanel } from './tips-panel';

describe('TipsPanel', () => {
  let component: TipsPanel;
  let fixture: ComponentFixture<TipsPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TipsPanel],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TipsPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
