import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StorefrontComponent } from './storefront.component';
import { ProductDetailsComponent } from './product-details.component';
import { OwnerLoginComponent } from './owner-login.component';
import { OwnerDashboardComponent } from './owner-dashboard.component';
import { ContactComponent } from './contact.component';
import { OwnerAuthGuard } from '../../guards/owner-auth.guard';
import { CartComponent } from './cart.component';
import { CheckoutComponent } from './checkout.component';
import { ProfileComponent } from './profile.component';
import { UserAuthGuard } from '../../guards/user-auth.guard';
import { WishlistComponent } from './wishlist.component';

const routes: Routes = [
  { path: '', component: StorefrontComponent, pathMatch: 'full' },
  { path: 'products/:id', component: ProductDetailsComponent },
  { path: 'cart', component: CartComponent, canActivate: [UserAuthGuard] },
  { path: 'checkout', component: CheckoutComponent, canActivate: [UserAuthGuard] },
  { path: 'wishlist', component: WishlistComponent },
  { path: 'profile', component: ProfileComponent, canActivate: [UserAuthGuard] },
  { path: 'login', component: OwnerLoginComponent },
  { path: 'owner/login', redirectTo: 'login', pathMatch: 'full' },
  { path: 'owner/dashboard', component: OwnerDashboardComponent, canActivate: [OwnerAuthGuard] },
  { path: 'contact', component: ContactComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class StorefrontRoutingModule { }
