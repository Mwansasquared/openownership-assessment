package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/openownership/assessment/internal/auth"
	"github.com/openownership/assessment/internal/handler"
	"github.com/openownership/assessment/internal/model"
)

// ── Mock repository ───────────────────────────────────────────────────────

type mockSubmissionRepo struct {
	submission *model.Submission
}

func (m *mockSubmissionRepo) Create(_ context.Context, _ uuid.UUID, _, _, _, _ string) (*model.Submission, error) {
	return m.submission, nil
}
func (m *mockSubmissionRepo) FindByID(_ context.Context, _ uuid.UUID) (*model.Submission, error) {
	if m.submission == nil {
		return nil, nil
	}
	return m.submission, nil
}
func (m *mockSubmissionRepo) ListForUser(_ context.Context, _ uuid.UUID) ([]*model.Submission, error) {
	return nil, nil
}
func (m *mockSubmissionRepo) ListAll(_ context.Context, _ string) ([]*model.Submission, error) {
	return nil, nil
}
func (m *mockSubmissionRepo) UpdateDraft(_ context.Context, _, _ uuid.UUID, _, _, _, _ string) (*model.Submission, error) {
	return m.submission, nil
}
func (m *mockSubmissionRepo) Transition(_ context.Context, _, _ uuid.UUID, _ model.Action, _, _ model.State, _ string) (*model.Submission, error) {
	return m.submission, nil
}
func (m *mockSubmissionRepo) Delete(_ context.Context, _ uuid.UUID) error   { return nil }
func (m *mockSubmissionRepo) ListEvents(_ context.Context, _ uuid.UUID) ([]*model.SubmissionEvent, error) {
	return nil, nil
}

// ── Test helpers ──────────────────────────────────────────────────────────

const testSecret = "test-secret-for-auth-tests"

func newTestRouter(repo *mockSubmissionRepo) (http.Handler, *auth.JWTService) {
	jwtSvc := auth.NewJWTService(testSecret, time.Hour)
	subH := handler.NewSubmissionHandler(repo, nil) // nil: notifications non-fatal, not needed in unit tests

	r := chi.NewRouter()
	r.Group(func(r chi.Router) {
		r.Use(jwtSvc.Authenticate)
		r.Get("/api/submissions", subH.List)
		r.Post("/api/submissions", subH.Create)
		r.Route("/api/submissions/{id}", func(r chi.Router) {
			r.Get("/", subH.Get)
			r.Put("/", subH.Update)
			r.Delete("/", subH.Delete)
			r.Get("/events", subH.ListEvents)
			r.Post("/actions/{action}", subH.PerformAction)
		})
	})
	return r, jwtSvc
}

func tokenCookie(t *testing.T, jwtSvc *auth.JWTService, userID uuid.UUID, role model.Role) *http.Cookie {
	t.Helper()
	tok, err := jwtSvc.Sign(userID, role)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return &http.Cookie{Name: auth.CookieName(), Value: tok}
}

func doAction(t *testing.T, router http.Handler, cookie *http.Cookie, submissionID uuid.UUID, action, comment string) *httptest.ResponseRecorder {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"comment": comment})
	req := httptest.NewRequest(http.MethodPost,
		"/api/submissions/"+submissionID.String()+"/actions/"+action,
		bytes.NewReader(body),
	)
	req.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		req.AddCookie(cookie)
	}
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	return rr
}

// ── Tests ─────────────────────────────────────────────────────────────────

// A submitter calling approve (a reviewer-only action) must get 403.
func TestSubmitterCannotApprove(t *testing.T) {
	submitterID := uuid.New()
	submissionID := uuid.New()

	repo := &mockSubmissionRepo{
		submission: &model.Submission{
			ID:     submissionID,
			UserID: submitterID,
			State:  model.StateUnderReview,
		},
	}
	router, jwtSvc := newTestRouter(repo)
	cookie := tokenCookie(t, jwtSvc, submitterID, model.RoleSubmitter)

	rr := doAction(t, router, cookie, submissionID, "approve", "")
	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden, got %d: %s", rr.Code, rr.Body.String())
	}
}

// A submitter calling start_review (a reviewer-only action) must get 403.
func TestSubmitterCannotStartReview(t *testing.T) {
	submitterID := uuid.New()
	submissionID := uuid.New()

	repo := &mockSubmissionRepo{
		submission: &model.Submission{
			ID:     submissionID,
			UserID: submitterID,
			State:  model.StateSubmitted,
		},
	}
	router, jwtSvc := newTestRouter(repo)
	cookie := tokenCookie(t, jwtSvc, submitterID, model.RoleSubmitter)

	rr := doAction(t, router, cookie, submissionID, "start_review", "")
	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden, got %d: %s", rr.Code, rr.Body.String())
	}
}

// A submitter calling return_for_changes (a reviewer-only action) must get 403.
func TestSubmitterCannotReturnForChanges(t *testing.T) {
	submitterID := uuid.New()
	submissionID := uuid.New()

	repo := &mockSubmissionRepo{
		submission: &model.Submission{
			ID:     submissionID,
			UserID: submitterID,
			State:  model.StateUnderReview,
		},
	}
	router, jwtSvc := newTestRouter(repo)
	cookie := tokenCookie(t, jwtSvc, submitterID, model.RoleSubmitter)

	rr := doAction(t, router, cookie, submissionID, "return_for_changes", "needs work")
	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden, got %d: %s", rr.Code, rr.Body.String())
	}
}

// A submitter must not be able to act on another user's submission.
func TestSubmitterCannotActOnOthersSubmission(t *testing.T) {
	ownerID := uuid.New()
	attackerID := uuid.New()
	submissionID := uuid.New()

	// Submission belongs to ownerID, not attackerID.
	repo := &mockSubmissionRepo{
		submission: &model.Submission{
			ID:     submissionID,
			UserID: ownerID,
			State:  model.StateDraft,
		},
	}
	router, jwtSvc := newTestRouter(repo)
	// Attacker is a legitimate submitter but not the owner.
	cookie := tokenCookie(t, jwtSvc, attackerID, model.RoleSubmitter)

	rr := doAction(t, router, cookie, submissionID, "submit", "")
	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden, got %d: %s", rr.Code, rr.Body.String())
	}
}

// An unauthenticated request (no cookie) must be rejected with 401.
func TestUnauthenticatedRequestIsRejected(t *testing.T) {
	router, _ := newTestRouter(&mockSubmissionRepo{})

	req := httptest.NewRequest(http.MethodGet, "/api/submissions", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d: %s", rr.Code, rr.Body.String())
	}
}

// reject action requires a non-empty comment; missing one must return 400.
func TestRejectRequiresComment(t *testing.T) {
	reviewerID := uuid.New()
	submissionID := uuid.New()

	repo := &mockSubmissionRepo{
		submission: &model.Submission{
			ID:     submissionID,
			UserID: uuid.New(), // owned by someone else
			State:  model.StateUnderReview,
		},
	}
	router, jwtSvc := newTestRouter(repo)
	cookie := tokenCookie(t, jwtSvc, reviewerID, model.RoleReviewer)

	rr := doAction(t, router, cookie, submissionID, "reject", "") // empty comment
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request, got %d: %s", rr.Code, rr.Body.String())
	}
}

// return_for_changes action requires a non-empty comment; missing one must return 400.
func TestReturnForChangesRequiresComment(t *testing.T) {
	reviewerID := uuid.New()
	submissionID := uuid.New()

	repo := &mockSubmissionRepo{
		submission: &model.Submission{
			ID:     submissionID,
			UserID: uuid.New(),
			State:  model.StateUnderReview,
		},
	}
	router, jwtSvc := newTestRouter(repo)
	cookie := tokenCookie(t, jwtSvc, reviewerID, model.RoleReviewer)

	rr := doAction(t, router, cookie, submissionID, "return_for_changes", "")
	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request, got %d: %s", rr.Code, rr.Body.String())
	}
}
