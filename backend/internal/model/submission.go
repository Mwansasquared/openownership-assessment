package model

import (
	"time"

	"github.com/google/uuid"
)

type State string

const (
	StateDraft       State = "DRAFT"
	StateSubmitted   State = "SUBMITTED"
	StateUnderReview State = "UNDER_REVIEW"
	StateApproved    State = "APPROVED"
	StateRejected    State = "REJECTED"
)

type Action string

const (
	ActionSubmit           Action = "submit"
	ActionStartReview      Action = "start_review"
	ActionApprove          Action = "approve"
	ActionReject           Action = "reject"
	ActionReturnForChanges Action = "return_for_changes"
	ActionResubmit         Action = "resubmit"
	// Non-transition actions logged for full audit coverage.
	ActionCreate Action = "create"
	ActionUpdate Action = "update"
)

// ValidCategories is the fixed list applicants choose from.
var ValidCategories = []string{
	"technology", "retail", "manufacturing", "services", "healthcare", "finance", "other",
}

type Submission struct {
	ID               uuid.UUID `json:"id"                db:"id"`
	UserID           uuid.UUID `json:"user_id"           db:"user_id"`
	OwnerEmail       string    `json:"owner_email"       db:"owner_email"`
	Title            string    `json:"title"             db:"title"`
	Content          string    `json:"content"           db:"content"`
	Category         string    `json:"category"          db:"category"`
	RegistrationDate string    `json:"registration_date" db:"registration_date"`
	State            State     `json:"state"             db:"state"`
	CreatedAt        time.Time `json:"created_at"        db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"        db:"updated_at"`
}

type SubmissionEvent struct {
	ID           uuid.UUID  `json:"id"            db:"id"`
	SubmissionID uuid.UUID  `json:"submission_id"  db:"submission_id"`
	ActorID      uuid.UUID  `json:"actor_id"       db:"actor_id"`
	ActorEmail   string     `json:"actor_email"    db:"actor_email"`
	ActorRole    Role       `json:"actor_role"     db:"actor_role"`
	Action       Action     `json:"action"         db:"action"`
	FromState    State      `json:"from_state"     db:"from_state"`
	ToState      State      `json:"to_state"       db:"to_state"`
	Comment      string     `json:"comment"        db:"comment"`
	CreatedAt    time.Time  `json:"created_at"     db:"created_at"`
}
