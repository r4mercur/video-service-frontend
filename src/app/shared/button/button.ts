import { Component, input } from '@angular/core';

@Component({
  selector: 'app-button',
  templateUrl: './button.html',
  styleUrl: './button.scss',
})
export class Button {
  readonly variant = input<'primary' | 'ghost'>('primary');
  readonly size = input<'sm' | 'md'>('md');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
}
