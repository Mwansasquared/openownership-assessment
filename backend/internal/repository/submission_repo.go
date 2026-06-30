package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/openownership/assessment/internal/model"
)

// SubmissionRepository is the interface handlers depend on, enabling mock testing.
type SubmissionRepository interface {
	Create(ctx context.Context, userID uuid.UUID, title, content, category, registrationDate string) (*model.Submission, error)
	FindByID(ctx context.Context, id uuid.UUID) (*model.Submission, error)
	ListForUser(ctx context.Context, userID uuid.UUID) ([]*model.Submission, error)
	ListAll(ctx context.Context, stateFilter string) ([]*model.Submission, error)
	UpdateDraft(ctx context.Context, id, actorID uuid.UUID, title, content, category, registrationDate string) (*model.Submission, error)
	Transition(ctx context.Context, submissionID, actorID uuid.UUID, action model.Action, from, to model.State, comment string) (*model.Submission, error)
	Delete(ctx context.Context, id uuid.UUID) error
	ListEvents(ctx context.Context, submissionID uuid.UUID) ([]*model.SubmissionEvent, error)
}

type SubmissionRepo struct {
	db *pgxpool.Pool
}

func NewSubmissionRepo(db *pgxpool.Pool) *SubmissionRepo { return &SubmissionRepo{db: db} }

// Create inserts the submission and atomically appends the initial "create" audit event.
func (r *SubmissionRepo) Create(ctx context.Context, userID uuid.UUID, title, content, category, registrationDate string) (*model.Submission, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	s := &model.Submission{}
	err = tx.QueryRow(ctx,
		`WITH ins AS (
		   INSERT INTO submissions (user_id, title, content, category, registration_date)
		   VALUES ($1, $2, $3, $4, $5)
		   RETURNING id, user_id, title, content, category, registration_date, state, created_at, updated_at
		 )
		 SELECT ins.id, ins.user_id, u.email, ins.title, ins.content, ins.category,
		        ins.registration_date::text, ins.state, ins.created_at, ins.updated_at
		 FROM ins
		 JOIN users u ON u.id = ins.user_id`,
		userID, title, content, category, registrationDate,
	).Scan(&s.ID, &s.UserID, &s.OwnerEmail, &s.Title, &s.Content, &s.Category,
		&s.RegistrationDate, &s.State, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO submission_events (submission_id, actor_id, action, from_state, to_state)
		 VALUES ($1, $2, 'create', '', 'DRAFT')`,
		s.ID, userID,
	)
	if err != nil {
		return nil, err
	}

	return s, tx.Commit(ctx)
}

func (r *SubmissionRepo) FindByID(ctx context.Context, id uuid.UUID) (*model.Submission, error) {
	s := &model.Submission{}
	err := r.db.QueryRow(ctx,
		`SELECT s.id, s.user_id, u.email, s.title, s.content, s.category,
		        s.registration_date::text, s.state, s.created_at, s.updated_at
		 FROM submissions s
		 JOIN users u ON u.id = s.user_id
		 WHERE s.id = $1`,
		id,
	).Scan(&s.ID, &s.UserID, &s.OwnerEmail, &s.Title, &s.Content, &s.Category,
		&s.RegistrationDate, &s.State, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s, nil
}

// ListForUser returns submissions owned by a specific user.
func (r *SubmissionRepo) ListForUser(ctx context.Context, userID uuid.UUID) ([]*model.Submission, error) {
	rows, err := r.db.Query(ctx,
		`SELECT s.id, s.user_id, u.email, s.title, s.content, s.category,
		        s.registration_date::text, s.state, s.created_at, s.updated_at
		 FROM submissions s
		 JOIN users u ON u.id = s.user_id
		 WHERE s.user_id = $1
		 ORDER BY s.created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSubmissions(rows)
}

// ListAll returns submissions for reviewer/admin, optionally filtered by state.
func (r *SubmissionRepo) ListAll(ctx context.Context, stateFilter string) ([]*model.Submission, error) {
	var rows pgx.Rows
	var err error

	if stateFilter != "" {
		rows, err = r.db.Query(ctx,
			`SELECT s.id, s.user_id, u.email, s.title, s.content, s.category,
			        s.registration_date::text, s.state, s.created_at, s.updated_at
			 FROM submissions s
			 JOIN users u ON u.id = s.user_id
			 WHERE s.state = $1
			 ORDER BY s.created_at DESC`,
			stateFilter,
		)
	} else {
		rows, err = r.db.Query(ctx,
			`SELECT s.id, s.user_id, u.email, s.title, s.content, s.category,
			        s.registration_date::text, s.state, s.created_at, s.updated_at
			 FROM submissions s
			 JOIN users u ON u.id = s.user_id
			 ORDER BY s.created_at DESC`,
		)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSubmissions(rows)
}

// UpdateDraft updates fields for a DRAFT and appends an "update" audit event.
func (r *SubmissionRepo) UpdateDraft(ctx context.Context, id, actorID uuid.UUID, title, content, category, registrationDate string) (*model.Submission, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	s := &model.Submission{}
	err = tx.QueryRow(ctx,
		`WITH upd AS (
		   UPDATE submissions SET title = $2, content = $3, category = $4, registration_date = $5
		   WHERE id = $1 AND state = 'DRAFT'
		   RETURNING id, user_id, title, content, category, registration_date, state, created_at, updated_at
		 )
		 SELECT upd.id, upd.user_id, u.email, upd.title, upd.content, upd.category,
		        upd.registration_date::text, upd.state, upd.created_at, upd.updated_at
		 FROM upd
		 JOIN users u ON u.id = upd.user_id`,
		id, title, content, category, registrationDate,
	).Scan(&s.ID, &s.UserID, &s.OwnerEmail, &s.Title, &s.Content, &s.Category,
		&s.RegistrationDate, &s.State, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO submission_events (submission_id, actor_id, action, from_state, to_state)
		 VALUES ($1, $2, 'update', 'DRAFT', 'DRAFT')`,
		id, actorID,
	)
	if err != nil {
		return nil, err
	}

	return s, tx.Commit(ctx)
}

// Transition atomically advances state and appends a transition event.
func (r *SubmissionRepo) Transition(
	ctx context.Context,
	submissionID, actorID uuid.UUID,
	action model.Action,
	from, to model.State,
	comment string,
) (*model.Submission, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	s := &model.Submission{}
	err = tx.QueryRow(ctx,
		`WITH upd AS (
		   UPDATE submissions SET state = $2
		   WHERE id = $1 AND state = $3
		   RETURNING id, user_id, title, content, category, registration_date, state, created_at, updated_at
		 )
		 SELECT upd.id, upd.user_id, u.email, upd.title, upd.content, upd.category,
		        upd.registration_date::text, upd.state, upd.created_at, upd.updated_at
		 FROM upd
		 JOIN users u ON u.id = upd.user_id`,
		submissionID, to, from,
	).Scan(&s.ID, &s.UserID, &s.OwnerEmail, &s.Title, &s.Content, &s.Category,
		&s.RegistrationDate, &s.State, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO submission_events (submission_id, actor_id, action, from_state, to_state, comment)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		submissionID, actorID, action, from, to, comment,
	)
	if err != nil {
		return nil, err
	}

	return s, tx.Commit(ctx)
}

// Delete removes a DRAFT submission.
func (r *SubmissionRepo) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx,
		`DELETE FROM submissions WHERE id = $1 AND state = 'DRAFT'`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListEvents returns the full audit trail with actor identity joined in.
func (r *SubmissionRepo) ListEvents(ctx context.Context, submissionID uuid.UUID) ([]*model.SubmissionEvent, error) {
	rows, err := r.db.Query(ctx,
		`SELECT e.id, e.submission_id, e.actor_id, u.email, u.role,
		        e.action, e.from_state, e.to_state, COALESCE(e.comment, ''), e.created_at
		 FROM submission_events e
		 JOIN users u ON u.id = e.actor_id
		 WHERE e.submission_id = $1
		 ORDER BY e.created_at ASC`,
		submissionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []*model.SubmissionEvent
	for rows.Next() {
		e := &model.SubmissionEvent{}
		if err := rows.Scan(
			&e.ID, &e.SubmissionID, &e.ActorID, &e.ActorEmail, &e.ActorRole,
			&e.Action, &e.FromState, &e.ToState, &e.Comment, &e.CreatedAt,
		); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

func scanSubmissions(rows pgx.Rows) ([]*model.Submission, error) {
	var list []*model.Submission
	for rows.Next() {
		s := &model.Submission{}
		if err := rows.Scan(
			&s.ID, &s.UserID, &s.OwnerEmail, &s.Title, &s.Content, &s.Category,
			&s.RegistrationDate, &s.State, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}
