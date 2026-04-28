import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, map } from 'rxjs';
import { OwnerAuthService } from '../services/owner-auth.service';

@Injectable({
  providedIn: 'root',
})
export class UserAuthGuard implements CanActivate {
  constructor(
    private readonly ownerAuthService: OwnerAuthService,
    private readonly router: Router
  ) {}

  canActivate(
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    return this.ownerAuthService.isSessionValid().pipe(
      map((isValid) =>
        isValid
          ? true
          : this.router.createUrlTree(['/login'], {
              queryParams: { returnUrl: state.url },
            })
      )
    );
  }
}
