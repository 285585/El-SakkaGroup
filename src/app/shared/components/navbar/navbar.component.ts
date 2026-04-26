import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { OwnerAuthService } from 'src/app/features/home/services/owner-auth.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent implements OnInit {
  ownerMode$!: Observable<boolean>;

  constructor(private readonly ownerAuthService: OwnerAuthService) {}

  ngOnInit(): void {
    this.ownerMode$ = this.ownerAuthService.ownerMode$;
    this.ownerAuthService.isSessionValid().subscribe();
  }

  logout(): void {
    this.ownerAuthService.logout();
  }
}
