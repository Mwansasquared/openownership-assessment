package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/openownership/assessment/internal/auth"
	"github.com/openownership/assessment/internal/model"
	"github.com/openownership/assessment/internal/repository"
	"github.com/openownership/assessment/internal/workflow"
)

type SubmissionHandler struct {
	subs   repository.SubmissionRepository
	notifs *repository.NotificationRepo
}

func NewSubmissionHandler(subs repository.SubmissionRepository, notifs *repository.NotificationRepo) *SubmissionHandler {
	return &SubmissionHandler{subs: subs, notifs: notifs}
}

// POST /api/submissions
func (h *SubmissionHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromCtx(r.Context())
	var body struct {
		Title            string `json:"title"`
		Content          string `json:"content"`
		Category         string `json:"category"`
		RegistrationDate string `json:"registration_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}
	if !isValidCategory(body.Category) {
		writeError(w, http.StatusBadRequest, "category must be one of: technology, retail, manufacturing, services, healthcare, finance, other")
		return
	}
	if !isValidDate(body.RegistrationDate) {
		writeError(w, http.StatusBadRequest, "registration_date is required and must be in YYYY-MM-DD format")
		return
	}

	sub, err := h.subs.Create(r.Context(), claims.UserID, body.Title, body.Content, body.Category, body.RegistrationDate)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusCreated, sub)
}

// GET /api/submissions
func (h *SubmissionHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromCtx(r.Context())

	var (
		list []*model.Submission
		err  error
	)
	if claims.Role == model.RoleReviewer || claims.Role == model.RoleAdmin {
		stateFilter := r.URL.Query().Get("state")
		list, err = h.subs.ListAll(r.Context(), stateFilter)
	} else {
		list, err = h.subs.ListForUser(r.Context(), claims.UserID)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if list == nil {
		list = []*model.Submission{}
	}
	writeJSON(w, http.StatusOK, list)
}

// GET /api/submissions/{id}
func (h *SubmissionHandler) Get(w http.ResponseWriter, r *http.Request) {
	sub, ok := h.loadAndAuthorize(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, sub)
}

// PUT /api/submissions/{id}
func (h *SubmissionHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromCtx(r.Context())
	sub, ok := h.loadAndAuthorize(w, r)
	if !ok {
		return
	}
	if sub.State != model.StateDraft {
		writeError(w, http.StatusConflict, "only DRAFT submissions can be edited")
		return
	}

	var body struct {
		Title            string `json:"title"`
		Content          string `json:"content"`
		Category         string `json:"category"`
		RegistrationDate string `json:"registration_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}
	if !isValidCategory(body.Category) {
		writeError(w, http.StatusBadRequest, "category must be one of: technology, retail, manufacturing, services, healthcare, finance, other")
		return
	}
	if !isValidDate(body.RegistrationDate) {
		writeError(w, http.StatusBadRequest, "registration_date is required and must be in YYYY-MM-DD format")
		return
	}

	updated, err := h.subs.UpdateDraft(r.Context(), sub.ID, claims.UserID, body.Title, body.Content, body.Category, body.RegistrationDate)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			writeError(w, http.StatusConflict, "submission is no longer in DRAFT")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

// DELETE /api/submissions/{id}
func (h *SubmissionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	sub, ok := h.loadAndAuthorize(w, r)
	if !ok {
		return
	}
	if sub.State != model.StateDraft {
		writeError(w, http.StatusConflict, "only DRAFT submissions can be deleted")
		return
	}
	if err := h.subs.Delete(r.Context(), sub.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// POST /api/submissions/{id}/actions/{action}
func (h *SubmissionHandler) PerformAction(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid submission id")
		return
	}
	action := model.Action(chi.URLParam(r, "action"))

	if !workflow.RoleCanAct(claims.Role, action) {
		writeError(w, http.StatusForbidden, "your role cannot perform this action")
		return
	}

	sub, err := h.subs.FindByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			writeError(w, http.StatusNotFound, "submission not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	// Submitters can only act on their own submissions
	if claims.Role == model.RoleSubmitter && sub.UserID != claims.UserID {
		writeError(w, http.StatusForbidden, "not your submission")
		return
	}

	nextState, err := workflow.Transition(sub.State, action)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	var body struct {
		Comment string `json:"comment"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	// reject and return_for_changes require a non-empty comment.
	if (action == model.ActionReject || action == model.ActionReturnForChanges) && strings.TrimSpace(body.Comment) == "" {
		writeError(w, http.StatusBadRequest, "a comment is required when rejecting or returning for changes")
		return
	}

	updated, err := h.subs.Transition(r.Context(), sub.ID, claims.UserID, action, sub.State, nextState, body.Comment)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			writeError(w, http.StatusConflict, "state changed concurrently, please retry")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if h.notifs != nil {
		if err := h.notifs.CreateForTransition(r.Context(), updated, action); err != nil {
			slog.Error("notification creation failed", "action", action, "submission_id", updated.ID, "err", err)
		}
	}

	writeJSON(w, http.StatusOK, updated)
}

// GET /api/submissions/{id}/events
func (h *SubmissionHandler) ListEvents(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid submission id")
		return
	}

	events, err := h.subs.ListEvents(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if events == nil {
		events = []*model.SubmissionEvent{}
	}
	writeJSON(w, http.StatusOK, events)
}

// loadAndAuthorize fetches the submission and verifies the caller owns it
// (reviewers and admins bypass the ownership check).
func (h *SubmissionHandler) loadAndAuthorize(w http.ResponseWriter, r *http.Request) (*model.Submission, bool) {
	claims := auth.ClaimsFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid submission id")
		return nil, false
	}

	sub, err := h.subs.FindByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			writeError(w, http.StatusNotFound, "submission not found")
			return nil, false
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return nil, false
	}

	if claims.Role == model.RoleSubmitter && sub.UserID != claims.UserID {
		writeError(w, http.StatusForbidden, "not your submission")
		return nil, false
	}
	return sub, true
}

func isValidCategory(c string) bool {
	for _, v := range model.ValidCategories {
		if v == c {
			return true
		}
	}
	return false
}

func isValidDate(d string) bool {
	_, err := time.Parse("2006-01-02", d)
	return err == nil
}
