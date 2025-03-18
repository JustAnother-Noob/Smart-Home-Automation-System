
---

**Email, Password, and Form Validation Testing Document**

**1. Email Field Validation**

|Test Case ID|Test Case Name|Action|Expected Result|Pass/Fail|Comments|
|---|---|---|---|---|---|
|TC1|Empty Email Field|Leave the email field empty.|The field should highlight with an error message like "Email is required."|||
|TC2|Invalid Email Format|Enter an invalid email format (e.g., test@com, test.com, @gmail.com).|The email field should show an error message like "Invalid email address."|||
|TC3|Valid Email Format|Enter a valid email format (e.g., [test@example.com](mailto:test@example.com)).|The email field should turn green with no error message.|||
|TC4|Email with Disposable Domain|Enter an email with a disposable domain (e.g., [test@mailinator.com](mailto:test@mailinator.com)).|The field should show an error message like "Disposable email addresses are not allowed."|||
|TC5|Email Already Exists|Enter an email that already exists in the database.|The error message "Email already exists" should appear, handled by the server.|||

---

**2. Password Field Validation**

|Test Case ID|Test Case Name|Action|Expected Result|Pass/Fail|Comments|
|---|---|---|---|---|---|
|TC6|Empty Password Field|Leave the password field empty.|The field should show an error message like "Password is required."|||
|TC7|Password Too Short|Enter a password with fewer than 8 characters (e.g., abc12).|The password requirements list should show "Length" unmet, and the password field should highlight with a red border.|||
|TC8|Password Missing Uppercase|Enter a password without uppercase letters (e.g., password123!).|The password requirements list should show "Uppercase" unmet, and the password field should highlight with a red border.|||
|TC9|Password Missing Lowercase|Enter a password without lowercase letters (e.g., PASSWORD123!).|The password requirements list should show "Lowercase" unmet, and the password field should highlight with a red border.|||
|TC10|Password Missing Number|Enter a password without any numbers (e.g., Password!).|The password requirements list should show "Number" unmet, and the password field should highlight with a red border.|||
|TC11|Password Missing Special Character|Enter a password without special characters (e.g., Password123).|The password requirements list should show "Special character" unmet, and the password field should highlight with a red border.|||
|TC12|Valid Password|Enter a valid password (e.g., Password123!).|The password field should turn green with no error message, and all requirements should be highlighted in green.|||

---

**3. Confirm Password Validation**

|Test Case ID|Test Case Name|Action|Expected Result|Pass/Fail|Comments|
|---|---|---|---|---|---|
|TC13|Empty Confirm Password Field|Leave the confirm password field empty.|The confirm password field should show an error message like "Confirm Password is required."|||
|TC14|Confirm Password Does Not Match|Enter a password and a different value in the confirm password field.|The confirm password field should turn red, with an error message like "Passwords do not match."|||
|TC15|Confirm Password Matches|Enter the same value in both password and confirm password fields.|The confirm password field should turn green with no error message.|||

---

**4. Overall Form Submission**

|Test Case ID|Test Case Name|Action|Expected Result|Pass/Fail|Comments|
|---|---|---|---|---|---|
|TC16|Form Submission with Invalid Data (Empty Fields)|Leave one or more required fields empty (e.g., email, password, confirm password).|The form should not submit, and error messages should appear for the missing fields.|||
|TC17|Form Submission with Invalid Data (Weak Password)|Enter an email and a password that does not meet the requirements (e.g., password too short or missing special characters).|The form should not submit, and the password field should highlight the unmet requirements with a red border.|||
|TC18|Form Submission with Mismatched Passwords|Enter matching passwords and a mismatched confirm password.|The form should not submit, and the confirm password field should turn red with an error message.|||
|TC19|Form Submission with Valid Data|Enter a valid email, password, and matching confirm password.|The form should submit successfully, and the user should be redirected to the login page.|||
|TC20|Client-Side Validation Messages After Submit|Submit the form without filling in valid data.|Error messages should appear for each field with invalid input, and the form should not submit until all errors are corrected.|||

---

**5. UI/UX Testing**

|Test Case ID|Test Case Name|Action|Expected Result|Pass/Fail|Comments|
|---|---|---|---|---|---|
|TC21|Highlighting Requirements in Green When Met|Enter a valid password that meets all the requirements.|The password requirements list should turn green for all items, indicating they are met.|||
|TC22|Password Requirements List Visibility|Focus on the password field.|The password requirements list should be visible below the password input field, clearly showing the requirements.|||

---

**6. Error Handling**

|Test Case ID|Test Case Name|Action|Expected Result|Pass/Fail|Comments|
|---|---|---|---|---|---|
|TC23|Server Error Handling (Client-Side)|Simulate server-side errors (e.g., network failure, server down, etc.).|Display an error message like "An unexpected error occurred" on the client side.|||

---

**7. Edge Cases**

|Test Case ID|Test Case Name|Action|Expected Result|Pass/Fail|Comments|
|---|---|---|---|---|---|
|TC24|Maximum Length for Password|Enter the longest allowed password (e.g., 255 characters).|The password should be validated correctly, and the form should handle large passwords.|||
|TC25|Email with Maximum Length|Enter a very long email address (e.g., 320 characters).|The email should be validated correctly, and no issues should arise with very long emails.|||

---

This document ensures all edge cases and functional requirements are tested for validation fields, form submission, and error handling.