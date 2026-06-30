package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openownership/assessment/internal/model"
)

type NotificationRepo struct {
	db *pgxpool.Pool
}

func NewNotificationRepo(db *pgxpool.Pool) *NotificationRepo {
	return &NotificationRepo{db: db}
}

// CreateForTransition inserts notifications for all users who should hear about this transition.
// Errors are non-fatal — the caller should log and continue.
func (r *NotificationRepo) CreateForTransition(ctx context.Context, sub *model.Submission, action model.Action) error {
	msg := notificationMessage(action, sub.Title)
	if msg == "" {
		return nil
	}

	switch action {
	case model.ActionSubmit, model.ActionResubmit:
		// Notify every reviewer in one statement — avoids holding a cursor open
		// while executing inserts on the same pool.
		_, err := r.db.Exec(ctx,
			`INSERT INTO notifications (user_id, submission_id, message)
			 SELECT id, $1, $2 FROM users WHERE role = 'reviewer'`,
			sub.ID, msg,
		)
		return err

	default:
		// Notify the submission owner.
		_, err := r.db.Exec(ctx,
			`INSERT INTO notifications (user_id, submission_id, message) VALUES ($1, $2, $3)`,
			sub.UserID, sub.ID, msg,
		)
		return err
	}
}

// ListForUser returns all notifications for a user, newest first.
func (r *NotificationRepo) ListForUser(ctx context.Context, userID uuid.UUID) ([]*model.Notification, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, user_id, submission_id, message, read, created_at
		 FROM notifications
		 WHERE user_id = $1
		 ORDER BY created_at DESC
		 LIMIT 50`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*model.Notification
	for rows.Next() {
		n := &model.Notification{}
		if err := rows.Scan(&n.ID, &n.UserID, &n.SubmissionID, &n.Message, &n.Read, &n.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, n)
	}
	return list, rows.Err()
}

// MarkAllRead marks every unread notification for a user as read.
func (r *NotificationRepo) MarkAllRead(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE`,
		userID,
	)
	return err
}

// notificationMessage returns the human-readable message for a given action, or "" to skip.
func notificationMessage(action model.Action, title string) string {
	switch action {
	case model.ActionSubmit:
		return fmt.Sprintf("New application submitted: %s", title)
	case model.ActionResubmit:
		return fmt.Sprintf("Application resubmitted for review: %s", title)
	case model.ActionStartReview:
		return fmt.Sprintf("Your application \"%s\" is now under review", title)
	case model.ActionApprove:
		return fmt.Sprintf("Your application \"%s\" has been approved", title)
	case model.ActionReject:
		return fmt.Sprintf("Your application \"%s\" was rejected", title)
	case model.ActionReturnForChanges:
		return fmt.Sprintf("Changes requested on your application \"%s\"", title)
	default:
		return ""
	}
}
