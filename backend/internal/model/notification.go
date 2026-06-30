package model

import (
	"time"

	"github.com/google/uuid"
)

type Notification struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	SubmissionID uuid.UUID `json:"submission_id"`
	Message      string    `json:"message"`
	Read         bool      `json:"read"`
	CreatedAt    time.Time `json:"created_at"`
}
