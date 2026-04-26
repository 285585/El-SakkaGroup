import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { OwnerAuthService } from '../../services/owner-auth.service';

@Component({
  selector: 'app-owner-login',
  templateUrl: './owner-login.component.html',
  styleUrls: ['./owner-login.component.scss'],
})
export class OwnerLoginComponent implements OnInit {
  authMode: 'login' | 'register' = 'login';

  username = '';
  password = '';
  registerEmail = '';
  registerUsername = '';
  registerPassword = '';
  registerPasswordConfirm = '';

  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly ownerAuthService: OwnerAuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.ownerAuthService.isSessionValid().subscribe((isValid) => {
      if (isValid) {
        this.redirectByRole();
      }
    });
  }

  setAuthMode(mode: 'login' | 'register'): void {
    this.authMode = mode;
    this.errorMessage = '';
    this.successMessage = '';
  }

  submit(): void {
    if (this.authMode === 'register') {
      this.submitRegistration();
      return;
    }

    this.submitLogin();
  }

  private submitLogin(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.username || !this.password) {
      this.errorMessage = 'من فضلك أدخل اسم المستخدم وكلمة المرور.';
      return;
    }

    this.isSubmitting = true;

    this.ownerAuthService
      .login(this.username.trim(), this.password)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          this.redirectByRole();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.resolveAuthError(error);
        },
      });
  }

  private submitRegistration(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.registerEmail || !this.registerUsername || !this.registerPassword) {
      this.errorMessage = 'من فضلك أكمل البريد الإلكتروني واسم المستخدم وكلمة المرور.';
      return;
    }

    if (!this.isGmailAddress(this.registerEmail)) {
      this.errorMessage = 'لازم التسجيل يكون بإيميل Gmail صحيح.';
      return;
    }

    if (this.registerUsername.trim().length < 3) {
      this.errorMessage = 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل.';
      return;
    }

    if (this.registerPassword.length < 6) {
      this.errorMessage = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
      return;
    }

    if (this.registerPassword !== this.registerPasswordConfirm) {
      this.errorMessage = 'تأكيد كلمة المرور غير مطابق.';
      return;
    }

    this.isSubmitting = true;
    this.ownerAuthService
      .register(
        this.registerEmail.trim(),
        this.registerUsername.trim(),
        this.registerPassword
      )
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          this.successMessage = 'تم إنشاء الحساب وتسجيل الدخول بنجاح.';
          this.redirectByRole();
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.resolveAuthError(error);
        },
      });
  }

  private redirectByRole(): void {
    const user = this.ownerAuthService.getCurrentUser();
    if (user?.role === 'owner') {
      this.router.navigate(['/owner/dashboard']);
      return;
    }

    this.router.navigate(['/']);
  }

  private isGmailAddress(value: string): boolean {
    return /^[^\s@]+@gmail\.com$/i.test(value.trim());
  }

  private resolveAuthError(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'تعذر الوصول للسيرفر. تأكد من تشغيل npm run api ثم حاول مرة أخرى.';
    }

    if (error.status === 401) {
      return 'بيانات الدخول غير صحيحة.';
    }

    if (error.status === 409) {
      return 'الإيميل أو اسم المستخدم مستخدم بالفعل.';
    }

    if (typeof error.error?.message === 'string' && error.error.message.trim()) {
      return error.error.message;
    }

    return 'حصل خطأ غير متوقع، حاول مرة أخرى.';
  }
}
