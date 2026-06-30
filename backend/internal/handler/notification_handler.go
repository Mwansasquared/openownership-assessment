package handler

import (
	"log/slog"
	"net/http"

	"github.com/openownership/assessment/internal/auth"
	"github.com/openownership/assessment/internal/model"
	"github.com/openownership/assessment/internal/repository"
)

type NotificationHandler struct {
	notifs *repository.NotificationRepo
}

func NewNotificationHandler(notifs *repository.NotificationRepo) *NotificationHandler {
	return &NotificationHandler{notifs: notifs}
}

// GET /api/notifications
func (h *NotificationHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromCtx(r.Context())
	list, err := h.notifs.ListForUser(r.Context(), claims.UserID)
	if err != nil {
		slog.Error("list notifications failed", "user_id", claims.UserID, "err", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	if list == nil {
		list = []*model.Notification{}
	}
	writeJSON(w, http.StatusOK, list)
}

// POST /api/notifications/read-all
func (h *NotificationHandler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromCtx(r.Context())
	if err := h.notifs.MarkAllRead(r.Context(), claims.UserID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
