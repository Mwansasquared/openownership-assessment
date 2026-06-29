package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/openownership/assessment/internal/auth"
	"github.com/openownership/assessment/internal/handler"
	"github.com/openownership/assessment/internal/model"
	"github.com/openownership/assessment/internal/repository"
)

func main() {
	// Load .env if present; silently ignored in production where env vars are set directly.
	_ = godotenv.Load()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	dbURL := mustEnv("DATABASE_URL")
	jwtSecret := mustEnv("JWT_SECRET")
	port := envOr("PORT", "8080")
	frontendOrigin := envOr("FRONTEND_ORIGIN", "http://localhost:5173")

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		logger.Error("failed to connect to database", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	if err := pool.Ping(context.Background()); err != nil {
		logger.Error("database ping failed", "err", err)
		os.Exit(1)
	}

	jwtSvc := auth.NewJWTService(jwtSecret, 24*time.Hour)

	userRepo := repository.NewUserRepo(pool)
	subRepo := repository.NewSubmissionRepo(pool)

	authH := handler.NewAuthHandler(userRepo, jwtSvc)
	subH := handler.NewSubmissionHandler(subRepo)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{frontendOrigin},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type"},
		AllowCredentials: true,
	}))

	r.Route("/api", func(r chi.Router) {
		// Public auth routes
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", authH.Register)
			r.Post("/login", authH.Login)
			r.With(jwtSvc.Authenticate).Post("/logout", authH.Logout)
			r.With(jwtSvc.Authenticate).Get("/me", authH.Me)
		})

		// Protected submission routes
		r.Group(func(r chi.Router) {
			r.Use(jwtSvc.Authenticate)

			r.Get("/submissions", subH.List)

			r.Route("/submissions/{id}", func(r chi.Router) {
				r.Get("/", subH.Get)
				r.Put("/", subH.Update)
				r.Delete("/", subH.Delete)
				r.Get("/events", subH.ListEvents)
				r.Post("/actions/{action}", subH.PerformAction)
			})

			// Submitter-only: create new submissions
			r.With(auth.RequireRole(model.RoleSubmitter, model.RoleAdmin)).
				Post("/submissions", subH.Create)
		})
	})

	addr := fmt.Sprintf(":%s", port)
	logger.Info("starting server", "addr", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		logger.Error("server error", "err", err)
		os.Exit(1)
	}
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		fmt.Fprintf(os.Stderr, "required env var %s is not set\n", key)
		os.Exit(1)
	}
	return v
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
