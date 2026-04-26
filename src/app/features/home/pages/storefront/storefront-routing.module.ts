import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StorefrontComponent } from './storefront.component';
import { ProductDetailsComponent } from './product-details.component';
import { OwnerLoginComponent } from './owner-login.component';
import { OwnerDashboardComponent } from './owner-dashboard.component';
import { ContactComponent } from './contact.component';
import { OwnerAuthGuard } from '../../guards/owner-auth.guard';

const routes: Routes = [
  { path: '', component: StorefrontComponent, pathMatch: 'full' },
  { path: 'products/:id', component: ProductDetailsComponent },
  { path: 'owner/login', component: OwnerLoginComponent },
  { path: 'owner/dashboard', component: OwnerDashboardComponent, canActivate: [OwnerAuthGuard] },
  { path: 'contact', component: ContactComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class StorefrontRoutingModule { }
