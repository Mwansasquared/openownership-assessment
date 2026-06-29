package model

import (
	"time"

	"github.com/google/uuid"
)

type Role string

const (
	RoleSubmitter Role = "submitter"
	RoleReviewer  Role = "reviewer"
	RoleAdmin     Role = "admin"
)

type User struct {
	ID           uuid.UUID `json:"id"         db:"id"`
	Email        string    `json:"email"       db:"email"`
	PasswordHash string    `json:"-"           db:"password_hash"`
	Role         Role      `json:"role"        db:"role"`
	CreatedAt    time.Time `json:"created_at"  db:"created_at"`
}
