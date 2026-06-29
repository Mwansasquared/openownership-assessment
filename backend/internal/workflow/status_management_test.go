package workflow_test

import (
	"errors"
	"testing"

	"github.com/openownership/assessment/internal/model"
	"github.com/openownership/assessment/internal/workflow"
)

func TestTransition(t *testing.T) {
	tests := []struct {
		name      string
		current   model.State
		action    model.Action
		wantNext  model.State
		wantErr   bool
		errTarget error
	}{
		// Happy-path: full linear flow
		{
			name:     "draft → submitted via submit",
			current:  model.StateDraft,
			action:   model.ActionSubmit,
			wantNext: model.StateSubmitted,
		},
		{
			name:     "submitted → under_review via start_review",
			current:  model.StateSubmitted,
			action:   model.ActionStartReview,
			wantNext: model.StateUnderReview,
		},
		{
			name:     "under_review → approved via approve",
			current:  model.StateUnderReview,
			action:   model.ActionApprove,
			wantNext: model.StateApproved,
		},
		{
			name:     "under_review → rejected via reject",
			current:  model.StateUnderReview,
			action:   model.ActionReject,
			wantNext: model.StateRejected,
		},
		{
			name:     "rejected → submitted via resubmit",
			current:  model.StateRejected,
			action:   model.ActionResubmit,
			wantNext: model.StateSubmitted,
		},

		// Error cases: action not allowed from state
		{
			name:      "cannot approve a draft",
			current:   model.StateDraft,
			action:    model.ActionApprove,
			wantErr:   true,
			errTarget: workflow.ErrInvalidTransition,
		},
		{
			name:      "cannot submit from under_review",
			current:   model.StateUnderReview,
			action:    model.ActionSubmit,
			wantErr:   true,
			errTarget: workflow.ErrInvalidTransition,
		},
		{
			name:      "cannot reject an already-approved submission",
			current:   model.StateApproved,
			action:    model.ActionReject,
			wantErr:   true,
			errTarget: workflow.ErrInvalidTransition,
		},
		{
			name:      "cannot resubmit from under_review",
			current:   model.StateUnderReview,
			action:    model.ActionResubmit,
			wantErr:   true,
			errTarget: workflow.ErrInvalidTransition,
		},
		{
			name:      "cannot start_review from draft",
			current:   model.StateDraft,
			action:    model.ActionStartReview,
			wantErr:   true,
			errTarget: workflow.ErrInvalidTransition,
		},
		{
			name:      "unknown state returns error",
			current:   model.State("UNKNOWN"),
			action:    model.ActionSubmit,
			wantErr:   true,
			errTarget: workflow.ErrInvalidTransition,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := workflow.Transition(tc.current, tc.action)

			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error but got nil (next state: %q)", got)
				}
				if tc.errTarget != nil && !errors.Is(err, tc.errTarget) {
					t.Fatalf("expected error %v, got %v", tc.errTarget, err)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.wantNext {
				t.Fatalf("Transition(%q, %q) = %q, want %q", tc.current, tc.action, got, tc.wantNext)
			}
		})
	}
}

func TestAllowedActions(t *testing.T) {
	tests := []struct {
		state   model.State
		allowed []model.Action
	}{
		{model.StateDraft, []model.Action{model.ActionSubmit}},
		{model.StateSubmitted, []model.Action{model.ActionStartReview}},
		{model.StateUnderReview, []model.Action{model.ActionApprove, model.ActionReject}},
		{model.StateRejected, []model.Action{model.ActionResubmit}},
		{model.StateApproved, []model.Action{}},
		{model.State("BOGUS"), nil},
	}

	for _, tc := range tests {
		t.Run(string(tc.state), func(t *testing.T) {
			got := workflow.AllowedActions(tc.state)

			if tc.allowed == nil {
				if got != nil {
					t.Fatalf("expected nil, got %v", got)
				}
				return
			}

			gotSet := toSet(got)
			for _, a := range tc.allowed {
				if !gotSet[a] {
					t.Errorf("missing expected action %q for state %q", a, tc.state)
				}
			}
			if len(gotSet) != len(tc.allowed) {
				t.Errorf("got %d actions, want %d: %v", len(gotSet), len(tc.allowed), got)
			}
		})
	}
}

func TestRoleCanAct(t *testing.T) {
	tests := []struct {
		role   model.Role
		action model.Action
		want   bool
	}{
		// Submitter permissions
		{model.RoleSubmitter, model.ActionSubmit, true},
		{model.RoleSubmitter, model.ActionResubmit, true},
		{model.RoleSubmitter, model.ActionApprove, false},
		{model.RoleSubmitter, model.ActionReject, false},
		{model.RoleSubmitter, model.ActionStartReview, false},

		// Reviewer permissions
		{model.RoleReviewer, model.ActionStartReview, true},
		{model.RoleReviewer, model.ActionApprove, true},
		{model.RoleReviewer, model.ActionReject, true},
		{model.RoleReviewer, model.ActionSubmit, false},
		{model.RoleReviewer, model.ActionResubmit, false},

		// Admin can do everything
		{model.RoleAdmin, model.ActionSubmit, true},
		{model.RoleAdmin, model.ActionResubmit, true},
		{model.RoleAdmin, model.ActionStartReview, true},
		{model.RoleAdmin, model.ActionApprove, true},
		{model.RoleAdmin, model.ActionReject, true},
	}

	for _, tc := range tests {
		t.Run(string(tc.role)+"/"+string(tc.action), func(t *testing.T) {
			got := workflow.RoleCanAct(tc.role, tc.action)
			if got != tc.want {
				t.Errorf("RoleCanAct(%q, %q) = %v, want %v", tc.role, tc.action, got, tc.want)
			}
		})
	}
}

func toSet(actions []model.Action) map[model.Action]bool {
	m := make(map[model.Action]bool, len(actions))
	for _, a := range actions {
		m[a] = true
	}
	return m
}
