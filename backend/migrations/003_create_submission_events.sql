-- Append-only audit trail; rows are never updated or deleted.
CREATE TABLE submission_events (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID        NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    actor_id      UUID        NOT NULL REFERENCES users(id),
    action        TEXT        NOT NULL,
    from_state    TEXT        NOT NULL,
    to_state      TEXT        NOT NULL,
    comment       TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_submission_id ON submission_events (submission_id);
CREATE INDEX idx_events_created_at    ON submission_events (submission_id, created_at);
