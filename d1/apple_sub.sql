ALTER TABLE users ADD COLUMN apple_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_sub ON users(apple_sub);
