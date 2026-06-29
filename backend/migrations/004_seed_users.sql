-- Seed one user per role. All passwords are: password123
-- Generated with bcrypt cost 10 (matches bcrypt.DefaultCost in Go).
INSERT INTO users (email, password_hash, role) VALUES
  ('applicant@example.com', '$2a$10$9IZCgf66toGkEvk1a.DYqeyLWu95rep1OpR0CFLw5NPI.5JD9P7ZG', 'submitter'),
  ('reviewer@example.com',  '$2a$10$Jg5LwEWJKyQoc/EAI3ukBuTig9J5YB8VAlCUClb/jjf3W3LrABxQi', 'reviewer'),
  ('admin@example.com',     '$2a$10$GAP6.T9dt77Pou8Cg.PJ..XW1wYkZJV0iSrdDMM/tYD.8QTdeAPwG', 'admin')
ON CONFLICT (email) DO NOTHING;
