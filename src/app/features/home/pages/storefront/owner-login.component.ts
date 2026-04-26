import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { OwnerAuthService } from '../../services/owner-auth.service';

@Component({
  selector: 'app-owner-login',
  templateUrl: './owner-login.component.html',
  styleUrls: ['./owner-login.component.scss'],
})
export class OwnerLoginComponent implements OnInit {
  username = '';
  password = '';

  setupToken = '';
  googleEmail = '';
  suggestedUsername = '';
  setupUsername = '';
  setupPassword = '';
  setupPasswordConfirm = '';
  showSetupForm = false;

  isSubmitting = false;
  isSettingUp = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly ownerAuthService: OwnerAuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.ownerAuthService.isSessionValid().subscribe((isValid) => {
      if (isValid) {
        this.redirectByRole();
      }
    });

    this.route.queryParamMap.subscribe((params) => {
      const googleStatus = params.get('google') || '';
      const setupToken = params.get('setupToken') || '';
      const email = params.get('email') || '';
      const suggestedUsername = params.get('suggestedUsername') || '';

      if (googleStatus === 'setup-required' && setupToken && email) {
        this.showSetupForm = true;
        this.setupToken = setupToken;
        this.googleEmail = email;
        this.suggestedUsername = suggestedUsername;
        this.setupUsername = suggestedUsername;
        this.successMessage = 'تم تأكيد Gmail بنجاح. الآن اختر اسم مستخدم وكلمة مرور.';
        this.errorMessage = '';
        return;
      }

      this.showSetupForm = false;
      if (googleStatus === 'existing-account') {
        this.successMessage = 'هذا البريد مفعّل بالفعل. استخدم اسم المستخدم وكلمة المرور لتسجيل الدخول.';
      } else if (googleStatus === 'config-missing') {
        this.errorMessage = 'تفعيل Gmail غير مُعد على السيرفر حالياً.';
      } else if (googleStatus && googleStatus !== 'setup-required') {
        this.errorMessage = 'تعذر إكمال تفعيل Gmail. حاول مرة أخرى.';
      }

      if (googleStatus) {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      }
    });
  }

  submit(): void {
    if (this.showSetupForm) {
      this.submitGoogleSetup();
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

  startGoogleActivation(): void {
    this.errorMessage = '';
    this.successMessage = '';
    window.location.href = '/api/auth/google/start';
  }

  private submitGoogleSetup(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.setupToken || !this.googleEmail) {
      this.errorMessage = 'جلسة تفعيل Gmail غير صالحة. أعد التفعيل مرة أخرى.';
      return;
    }

    if (!this.setupUsername || !this.setupPassword) {
      this.errorMessage = 'من فضلك أدخل اسم المستخدم وكلمة المرور لإكمال التفعيل.';
      return;
    }

    if (this.setupUsername.trim().length < 3) {
      this.errorMessage = 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل.';
      return;
    }

    if (this.setupPassword.length < 6) {
      this.errorMessage = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.';
      return;
    }

    if (this.setupPassword !== this.setupPasswordConfirm) {
      this.errorMessage = 'تأكيد كلمة المرور غير مطابق.';
      return;
    }

    this.isSettingUp = true;
    this.ownerAuthService
      .completeGoogleSignup(this.setupToken, this.setupUsername.trim(), this.setupPassword)
      .pipe(finalize(() => (this.isSettingUp = false)))
      .subscribe({
        next: () => {
          this.successMessage = 'تم تفعيل الحساب عبر Gmail وإنشاء بيانات الدخول بنجاح.';
          this.showSetupForm = false;
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
