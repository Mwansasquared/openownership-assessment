CREATE TABLE submissions (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT        NOT NULL,
    content    TEXT        NOT NULL,
    category          TEXT        NOT NULL DEFAULT 'other'
                               CHECK (category IN ('technology','retail','manufacturing','services','healthcare','finance','other')),
    registration_date DATE        NOT NULL DEFAULT CURRENT_DATE,
    state      TEXT        NOT NULL DEFAULT 'DRAFT'
                           CHECK (state IN ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_submissions_user_id ON submissions (user_id);
CREATE INDEX idx_submissions_state   ON submissions (state);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_submissions_updated_at
    BEFORE UPDATE ON submissions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
