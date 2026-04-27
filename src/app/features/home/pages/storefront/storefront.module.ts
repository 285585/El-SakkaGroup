import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { StorefrontRoutingModule } from './storefront-routing.module';
import { StorefrontComponent } from './storefront.component';
import { RippleModule } from 'primeng/ripple';
import { ProductDetailsComponent } from './product-details.component';
import { OwnerLoginComponent } from './owner-login.component';
import { OwnerDashboardComponent } from './owner-dashboard.component';
import { ContactComponent } from './contact.component';
import { CartComponent } from './cart.component';
import { CheckoutComponent } from './checkout.component';
import { ProfileComponent } from './profile.component';
import { WishlistComponent } from './wishlist.component';
import { ProductImageDirective } from 'src/app/shared/directives/product-image.directive';

@NgModule({
  declarations: [
    StorefrontComponent,
    ProductDetailsComponent,
    OwnerLoginComponent,
    OwnerDashboardComponent,
    ContactComponent,
    CartComponent,
    CheckoutComponent,
    ProfileComponent,
    WishlistComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    StorefrontRoutingModule,
    RippleModule,
    ProductImageDirective,
  ]
})
export class StorefrontModule { }
