package workflow

import (
	"errors"
	"fmt"

	"github.com/openownership/assessment/internal/model"
)

// ErrInvalidTransition is returned when an action is not allowed from the current state.
var ErrInvalidTransition = errors.New("invalid state transition")

// transitionMap defines every legal (state, action) → nextState combination.
var transitionMap = map[model.State]map[model.Action]model.State{
	model.StateDraft: {
		model.ActionSubmit: model.StateSubmitted,
	},
	model.StateSubmitted: {
		model.ActionStartReview: model.StateUnderReview,
	},
	model.StateUnderReview: {
		model.ActionApprove: model.StateApproved,
		model.ActionReject:  model.StateRejected,
	},
	model.StateRejected: {
		model.ActionResubmit: model.StateSubmitted,
	},
	// Terminal states — no outbound transitions.
	model.StateApproved: {},
}

// Transition returns the next state for a given current state and action, or an
// error if the transition is not permitted.
func Transition(current model.State, action model.Action) (model.State, error) {
	actions, ok := transitionMap[current]
	if !ok {
		return "", fmt.Errorf("%w: unknown state %q", ErrInvalidTransition, current)
	}

	next, ok := actions[action]
	if !ok {
		return "", fmt.Errorf("%w: action %q not allowed in state %q", ErrInvalidTransition, action, current)
	}

	return next, nil
}

// AllowedActions returns the set of actions available from the given state.
func AllowedActions(current model.State) []model.Action {
	actions, ok := transitionMap[current]
	if !ok {
		return nil
	}

	result := make([]model.Action, 0, len(actions))
	for a := range actions {
		result = append(result, a)
	}
	return result
}

// RoleCanAct enforces which roles are permitted to trigger each action.
func RoleCanAct(role model.Role, action model.Action) bool {
	switch action {
	case model.ActionSubmit, model.ActionResubmit:
		return role == model.RoleSubmitter || role == model.RoleAdmin
	case model.ActionStartReview, model.ActionApprove, model.ActionReject:
		return role == model.RoleReviewer || role == model.RoleAdmin
	default:
		return false
	}
}
