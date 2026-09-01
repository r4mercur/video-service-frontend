import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdultContentPreferenceService } from '@core/adult-content-preference/adult-content-preference';
import { AdultContentDialog } from '@shared/adult-content-dialog/adult-content-dialog';

@Component({
  imports: [RouterOutlet, AdultContentDialog],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly adultContentPreference = inject(AdultContentPreferenceService);
}
