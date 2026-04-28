import { Component } from '@angular/core';
import { PUBLIC_CONTACT_FOR_PRICING } from '../../constants/public-pricing.message';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss'],
})
export class ContactComponent {
  readonly publicPricingHint = PUBLIC_CONTACT_FOR_PRICING;
}
