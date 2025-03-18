#Client-Side
**Validation:** 
- email validation using regex and don't allowing temp emails
- Password validation:
	- client side validation for minimum 8 letters, at least one uppercase, lowercase, number and special character
	- real time client side validation below pwd box saying which requirement is met and which is not. 
- Sign-up with google
- Terms and condition button
**UX:**
- Spinning loading icon after clicking sign up button
- show password button
**Enhancement:**
- proper error message
- Captcha if possible

#Server-side
- Email verification after sign-up
- Rate-limiting to limit sign-up actions to prevent brute-force
- Password Hashing
- Server-side email and password Validation
- Two-factor-Auth (2FA)
- Proper error logs