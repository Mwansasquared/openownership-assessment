package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/openownership/assessment/internal/auth"
	"github.com/openownership/assessment/internal/model"
	"github.com/openownership/assessment/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	users *repository.UserRepo
	jwt   *auth.JWTService
}

func NewAuthHandler(users *repository.UserRepo, jwt *auth.JWTService) *AuthHandler {
	return &AuthHandler{users: users, jwt: jwt}
}

type registerRequest struct {
	Email    string     `json:"email"`
	Password string     `json:"password"`
	Role     model.Role `json:"role"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}
	if req.Role == "" {
		req.Role = model.RoleSubmitter
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	user, err := h.users.Create(r.Context(), req.Email, string(hash), req.Role)
	if err != nil {
		if errors.Is(err, repository.ErrConflict) {
			writeError(w, http.StatusConflict, "email already registered")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	h.setTokenCookie(w, user)
	writeJSON(w, http.StatusCreated, user)
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, err := h.users.FindByEmail(r.Context(), req.Email)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	h.setTokenCookie(w, user)
	writeJSON(w, http.StatusOK, user)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     auth.CookieName(),
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:	  true,
		SameSite: http.SameSiteNoneMode,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	})
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromCtx(r.Context())
	user, err := h.users.FindByID(r.Context(), claims.UserID)
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (h *AuthHandler) setTokenCookie(w http.ResponseWriter, user *model.User) {
	token, _ := h.jwt.Sign(user.ID, user.Role)
	http.SetCookie(w, &http.Cookie{
		Name:     auth.CookieName(),
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:	  true,
		SameSite: http.SameSiteNoneMode,
		MaxAge:   int((24 * time.Hour).Seconds()),
	})
}
