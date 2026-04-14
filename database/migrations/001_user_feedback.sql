-- Migration: add user_feedback table to physlibsearch schema
-- Run this against the same database used by the backend.

CREATE TABLE IF NOT EXISTS physlibsearch.user_feedback (
    id          BIGSERIAL PRIMARY KEY,
    tab_name    VARCHAR(50)  NOT NULL,
    rating      SMALLINT     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    feedback_type VARCHAR(50) NOT NULL DEFAULT 'general',
    message     TEXT         NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_tab_name
    ON physlibsearch.user_feedback (tab_name);

CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at
    ON physlibsearch.user_feedback (created_at);
