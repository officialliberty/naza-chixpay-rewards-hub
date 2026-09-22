# Fix ChixPay login

## What will change
- Correct the registration flow so users are not shown the tutorial or wallet before their email is confirmed.
- Add a clear “Check your email” confirmation screen after registration.
- When login is blocked because the email is unconfirmed, show a friendly explanation and a working button to resend the confirmation email.
- Restore an authenticated session after the confirmation link returns to ChixPay, then open the dashboard with the saved account details.
- Keep the existing blue, green, yellow, and glass design unchanged.

## Verification
- Test failed login messaging and confirmation-email resend on mobile.
- Confirm the login form submits correctly and the app opens the dashboard only for a valid signed-in user.
- Check that there are no browser errors.

## Technical details
- Continue using Lovable Cloud email authentication and the existing profile fields.
- Use the authentication session listener for confirmation-link returns instead of treating signup as immediate login.
