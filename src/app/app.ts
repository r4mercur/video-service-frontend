import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AgeGateService } from '@core/age-gate/age-gate';
import { AgeGateDialog } from '@shared/age-gate-dialog/age-gate-dialog';

@Component({
  imports: [RouterOutlet, AgeGateDialog],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly ageGate = inject(AgeGateService);
}
