import { Component, input } from '@angular/core';

@Component({
  selector: 'app-tag',
  templateUrl: './tag.html',
  styleUrl: './tag.scss',
})
export class Tag {
  readonly variant = input<'badge' | 'chip'>('chip');
}
